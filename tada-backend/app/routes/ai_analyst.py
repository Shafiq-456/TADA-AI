"""
AI Analyst Routes - Gemini-powered conversational data analysis with PostgreSQL persistence
"""
import uuid
import json
from pathlib import Path
from typing import Any, Dict, Optional, List

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.utils.auth import get_current_user
from app.models import Dataset, ChatHistory, ActivityLog

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    dataset_id: Optional[str] = None
    session_id: Optional[str] = None
    history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    response: str
    session_id: str
    charts: Optional[list] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_df(d: Dataset) -> pd.DataFrame:
    """Load a Dataset ORM record into a pandas DataFrame."""
    file_path = d.file_path
    ext = d.file_type
    cleaned_file = Path(file_path).parent / "cleaned.csv"
    if cleaned_file.exists():
        file_path = str(cleaned_file)
        ext = "csv"
    if ext == "csv":
        return pd.read_csv(file_path)
    elif ext in ("xlsx", "xls"):
        return pd.read_excel(file_path)
    elif ext == "json":
        return pd.read_json(file_path)
    raise ValueError(f"Unsupported file type: {ext}")


def get_dataset_context(dataset_id: str, db: Session) -> str:
    """Load dataset summary + 5-row data sample for AI context."""
    if not dataset_id:
        return "No specific dataset selected."

    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        return "Dataset details not found."

    context = f"""
Dataset: {d.name}
Rows: {d.row_count}
Columns: {d.column_count}
File Type: {d.file_type}
Quality Score: {d.quality_score}%
Missing Values: {d.missing_values}
Duplicate Rows: {d.duplicate_rows}

Columns:
"""
    if d.columns:
        for col in d.columns[:10]:
            context += (
                f"  - {col.get('name')} ({col.get('type')}): "
                f"{col.get('null_count')} nulls, {col.get('unique_count')} unique values\n"
            )

    # Append live data sample
    try:
        df = _load_df(d)
        sample_csv = df.head(5).to_csv(index=False)
        context += f"\nData Sample (first 5 rows, CSV):\n{sample_csv}"
    except Exception:
        pass  # Silently skip if file is unavailable

    return context


def _safe_json(val: Any) -> Any:
    """Recursively convert numpy types to Python native for JSON serialisation."""
    if isinstance(val, dict):
        return {k: _safe_json(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_safe_json(v) for v in val]
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        v = float(val)
        return None if (np.isnan(v) or np.isinf(v)) else round(v, 6)
    if isinstance(val, np.ndarray):
        return _safe_json(val.tolist())
    return val


# ---------------------------------------------------------------------------
# /chat endpoint (enhanced)
# ---------------------------------------------------------------------------

@router.post("/chat", response_model=ChatResponse)
async def chat_with_analyst(
    request: ChatRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Chat with AI data analyst and store history in PostgreSQL"""
    session_id = request.session_id or str(uuid.uuid4())
    dataset_context = get_dataset_context(request.dataset_id or "", db)

    # Save user message to database
    user_msg = ChatHistory(
        session_id=session_id,
        dataset_id=request.dataset_id,
        role="user",
        content=request.message,
    )
    db.add(user_msg)
    db.commit()

    # Log user action
    log = ActivityLog(
        user_id=user.id,
        action="chat",
        details=f"Asked AI Analyst about dataset: {request.message[:50]}...",
    )
    db.add(log)
    db.commit()

    # Retrieve history from database if not supplied in request
    history_list = request.history
    if not history_list:
        db_history = (
            db.query(ChatHistory)
            .filter(ChatHistory.session_id == session_id)
            .order_by(ChatHistory.created_at.asc())
            .all()
        )
        # Exclude user's current message which was just inserted
        history_list = [
            ChatMessage(role=msg.role, content=msg.content)
            for msg in db_history[:-1]
        ]

    try:
        if not settings.GEMINI_API_KEY:
            # Return a detailed mock response if no API key is configured
            ai_text = f"""I'm TADA AI, your autonomous data analyst! 🤖

**Note**: To enable full AI capabilities, please configure your Gemini API key in Settings.

Based on your question: *"{request.message}"*

Here's what I can tell you from the dataset context:
{dataset_context}

**To get real AI-powered analysis:**
1. Go to Settings → API Configuration
2. Enter your Google Gemini API key
3. Save and return to this chat

I'll then be able to provide:
- Deep statistical analysis
- Anomaly detection
- Revenue predictions  
- Business recommendations
- Custom chart generation"""

            ai_msg = ChatHistory(
                session_id=session_id,
                dataset_id=request.dataset_id,
                role="assistant",
                content=ai_text,
            )
            db.add(ai_msg)
            db.commit()

            return ChatResponse(response=ai_text, session_id=session_id)

        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-pro")

        # Enhanced structured system prompt
        system_prompt = f"""You are TADA AI, an expert autonomous data analyst and business intelligence agent.
You analyze business data, identify patterns, generate insights, and provide actionable recommendations.

Dataset Context (including real data sample):
{dataset_context}

Instructions:
- Provide concise, actionable business insights
- Use markdown formatting (bold, bullet points, tables)
- When the user asks a tabular or comparative question, respond with a markdown table
- Include specific numbers and percentages when possible
- Reference the actual dataset columns and sample values in your analysis
- Keep responses professional and executive-level
- Suggest follow-up analyses when appropriate
- When asked about distributions, trends, or rankings, summarize from the data sample shown above
- For quantitative questions, show calculated values where feasible"""

        # Build conversation history for Google Generative AI
        history = []
        for msg in history_list[-10:]:  # Last 10 messages for context
            history.append(
                {
                    "role": "user" if msg.role == "user" else "model",
                    "parts": [msg.content],
                }
            )

        chat = model.start_chat(history=history)
        response = await chat.send_message_async(
            f"{system_prompt}\n\nUser question: {request.message}"
        )
        ai_text = response.text

        # Save assistant response to database
        ai_msg = ChatHistory(
            session_id=session_id,
            dataset_id=request.dataset_id,
            role="assistant",
            content=ai_text,
        )
        db.add(ai_msg)
        db.commit()

        return ChatResponse(response=ai_text, session_id=session_id)

    except Exception as e:
        error_msg = f"AI analysis failed: {str(e)}"
        ai_msg = ChatHistory(
            session_id=session_id,
            dataset_id=request.dataset_id,
            role="assistant",
            content=error_msg,
        )
        db.add(ai_msg)
        db.commit()
        raise HTTPException(status_code=500, detail=error_msg)


# ---------------------------------------------------------------------------
# /sessions/{session_id} — existing endpoint
# ---------------------------------------------------------------------------

@router.get("/sessions/{session_id}")
async def get_chat_history(
    session_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get chat history for a session from PostgreSQL"""
    db_history = (
        db.query(ChatHistory)
        .filter(ChatHistory.session_id == session_id)
        .order_by(ChatHistory.created_at.asc())
        .all()
    )

    messages = [
        {
            "role": msg.role,
            "content": msg.content,
            "created_at": msg.created_at.isoformat(),
        }
        for msg in db_history
    ]

    return {"session_id": session_id, "messages": messages}


# ---------------------------------------------------------------------------
# NEW: /query — Enhanced NL query with pandas execution
# ---------------------------------------------------------------------------

@router.post("/query")
async def natural_language_query(
    request: ChatRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Enhanced natural language query that loads the DataFrame and attempts
    to execute pandas operations, returning structured results.

    Returns: {response, result_type ('text'|'table'|'chart'), data, sql_equivalent}
    """
    if not request.dataset_id:
        raise HTTPException(status_code=400, detail="dataset_id is required for /query")

    d = db.query(Dataset).filter(Dataset.id == request.dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Load DataFrame
    try:
        df = _load_df(d)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset file not found on server")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not load dataset: {e}")

    message = request.message.lower().strip()
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

    result_type = "text"
    data: Any = None
    sql_equivalent = ""
    response_text = ""

    # --- Heuristic intent detection ---
    # 1. "top N by column" / "top rows"
    import re

    top_n_match = re.search(r"top\s+(\d+)", message)
    by_col_match = re.search(r"by\s+(\w+)", message)

    if top_n_match:
        n = int(top_n_match.group(1))
        if by_col_match:
            col_name = by_col_match.group(1)
            # Find closest column name
            col_candidates = [c for c in df.columns if col_name in c.lower()]
            sort_col = col_candidates[0] if col_candidates else (numeric_cols[0] if numeric_cols else df.columns[0])
        else:
            sort_col = numeric_cols[0] if numeric_cols else df.columns[0]

        top_df = df.nlargest(n, sort_col) if sort_col in numeric_cols else df.head(n)
        data = _safe_json(top_df.where(top_df.notna(), None).to_dict(orient="records"))
        result_type = "table"
        sql_equivalent = f"SELECT * FROM dataset ORDER BY {sort_col} DESC LIMIT {n};"
        response_text = f"Here are the top {n} rows sorted by **{sort_col}**:"

    # 2. "average / mean of column"
    elif re.search(r"\b(average|mean|avg)\b", message):
        col_candidates = [c for c in numeric_cols if any(word in message for word in c.lower().split("_"))]
        target_col = col_candidates[0] if col_candidates else (numeric_cols[0] if numeric_cols else None)
        if target_col:
            avg_val = df[target_col].mean()
            data = {"column": target_col, "mean": round(float(avg_val), 4)}
            result_type = "text"
            sql_equivalent = f"SELECT AVG({target_col}) FROM dataset;"
            response_text = f"The average of **{target_col}** is **{round(float(avg_val), 4)}**."
        else:
            response_text = "No numeric columns found to compute average."

    # 3. "sum of column"
    elif re.search(r"\bsum\b", message):
        col_candidates = [c for c in numeric_cols if any(word in message for word in c.lower().split("_"))]
        target_col = col_candidates[0] if col_candidates else (numeric_cols[0] if numeric_cols else None)
        if target_col:
            total = df[target_col].sum()
            data = {"column": target_col, "sum": round(float(total), 4)}
            result_type = "text"
            sql_equivalent = f"SELECT SUM({target_col}) FROM dataset;"
            response_text = f"The total sum of **{target_col}** is **{round(float(total), 4)}**."
        else:
            response_text = "No numeric columns found to compute sum."

    # 4. "count / how many"
    elif re.search(r"\b(count|how many)\b", message):
        data = {"total_rows": len(df), "total_columns": len(df.columns)}
        result_type = "text"
        sql_equivalent = "SELECT COUNT(*) FROM dataset;"
        response_text = (
            f"The dataset contains **{len(df):,} rows** and **{len(df.columns)} columns**."
        )

    # 5. "distribution / group by / breakdown"
    elif re.search(r"\b(distribution|group by|breakdown|by category)\b", message):
        if categorical_cols:
            group_col = categorical_cols[0]
            if numeric_cols:
                agg = df.groupby(group_col)[numeric_cols[0]].agg(["count", "mean", "sum"]).reset_index()
                agg.columns = [group_col, "count", "mean", "sum"]
                data = _safe_json(agg.head(20).to_dict(orient="records"))
                result_type = "table"
                sql_equivalent = (
                    f"SELECT {group_col}, COUNT(*), AVG({numeric_cols[0]}), SUM({numeric_cols[0]}) "
                    f"FROM dataset GROUP BY {group_col} ORDER BY COUNT(*) DESC LIMIT 20;"
                )
                response_text = f"Distribution of **{numeric_cols[0]}** by **{group_col}**:"
            else:
                counts = df[group_col].value_counts().reset_index()
                counts.columns = [group_col, "count"]
                data = _safe_json(counts.head(20).to_dict(orient="records"))
                result_type = "table"
                sql_equivalent = f"SELECT {group_col}, COUNT(*) FROM dataset GROUP BY {group_col} ORDER BY COUNT(*) DESC LIMIT 20;"
                response_text = f"Value distribution of **{group_col}**:"
        else:
            response_text = "No categorical columns found for grouping."

    # 6. "describe / summary / statistics"
    elif re.search(r"\b(describe|summary|statistics|stats)\b", message):
        if numeric_cols:
            desc = df[numeric_cols].describe()
            data = _safe_json(desc.to_dict())
            result_type = "table"
            sql_equivalent = "-- Descriptive statistics (not SQL-expressible in one query)"
            response_text = "Descriptive statistics for all numeric columns:"
        else:
            response_text = "No numeric columns available."

    # 7. "missing / null / nulls"
    elif re.search(r"\b(missing|null|nulls|na)\b", message):
        missing = {col: int(df[col].isnull().sum()) for col in df.columns if df[col].isnull().sum() > 0}
        data = [{"column": k, "missing_count": v, "missing_pct": round(v / len(df) * 100, 2)} for k, v in missing.items()]
        result_type = "table"
        sql_equivalent = "-- Missing value check (varies by DB engine)"
        response_text = f"Found **{sum(missing.values()):,}** missing values across **{len(missing)}** column(s):"

    # 8. Fallback — use Gemini if available
    else:
        if settings.GEMINI_API_KEY:
            try:
                import google.generativeai as genai

                genai.configure(api_key=settings.GEMINI_API_KEY)
                gemini_model = genai.GenerativeModel("gemini-1.5-pro")

                dataset_context = get_dataset_context(request.dataset_id, db)
                prompt = f"""You are a data analyst. Answer the following question about the dataset.
Return JSON: {{"response": "...", "result_type": "text|table|chart", "data": null_or_list_of_dicts, "sql_equivalent": "..."}}

Dataset context:
{dataset_context}

User question: {request.message}

Return ONLY valid JSON, no markdown."""
                gemini_resp = await gemini_model.generate_content_async(prompt)
                text = gemini_resp.text.strip()
                if text.startswith("```json"):
                    text = text[7:]
                if text.startswith("```"):
                    text = text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                parsed = json.loads(text.strip())
                return {
                    "response": parsed.get("response", ""),
                    "result_type": parsed.get("result_type", "text"),
                    "data": parsed.get("data"),
                    "sql_equivalent": parsed.get("sql_equivalent", ""),
                }
            except Exception:
                pass

        # Final fallback — describe dataset briefly
        response_text = (
            f"I found the dataset **'{d.name}'** with {len(df):,} rows and {len(df.columns)} columns. "
            f"Numeric columns: {', '.join(numeric_cols[:5]) or 'none'}. "
            f"Categorical columns: {', '.join(categorical_cols[:5]) or 'none'}. "
            f"Try asking: 'top 10 by revenue', 'average sales', 'distribution by category', or 'describe statistics'."
        )
        result_type = "text"
        sql_equivalent = ""

    return {
        "response": response_text,
        "result_type": result_type,
        "data": data,
        "sql_equivalent": sql_equivalent,
    }
