"""
Executive Insights Router - Heuristic and Gemini-powered SWOT analysis
"""
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.utils.auth import get_current_user
from app.models import Dataset, ExecutiveInsight, ActivityLog
from app.services.insights_engine import SmartInsightsEngine

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate,
        Paragraph,
        Spacer,
        Table,
        TableStyle,
    )
    from reportlab.lib.styles import getSampleStyleSheet

    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

logger = logging.getLogger(__name__)
router = APIRouter()
_engine = SmartInsightsEngine()


class SWOT(BaseModel):
    strengths: List[str]
    weaknesses: List[str]
    opportunities: List[str]
    threats: List[str]


class InsightsResponse(BaseModel):
    dataset_id: str
    swot: SWOT
    opportunities: List[str]
    risks: List[str]
    recommendations: List[str]
    executive_summary: str


def generate_heuristic_insights(meta: Dict[str, Any]) -> InsightsResponse:
    """Generate detailed SWOT and insights using statistical heuristics"""
    row_count = meta.get("row_count", 0)
    col_count = meta.get("column_count", 0)
    quality_score = meta.get("quality_score", 0.0)
    missing_values = meta.get("missing_values", 0)
    duplicate_rows = meta.get("duplicate_rows", 0)

    # 1. SWOT Elements
    strengths = [
        f"Substantial size with {row_count:,} data points and {col_count} attributes",
        f"Data quality health index stands at a solid {quality_score}%"
        if quality_score >= 80
        else "Data structure supports multivariate analysis",
    ]
    if missing_values == 0:
        strengths.append("High completeness: 0% missing value ratio across all columns")
    if duplicate_rows == 0:
        strengths.append("High integrity: No duplicate records found")

    weaknesses = []
    if quality_score < 75:
        weaknesses.append(
            f"Suboptimal data quality index of {quality_score}% needs remediation"
        )
    if missing_values > 0:
        weaknesses.append(
            f"Presence of {missing_values} missing data entries may introduce analytical bias"
        )
    if duplicate_rows > 0:
        weaknesses.append(
            f"Identified {duplicate_rows} duplicate rows, which may skew distribution calculations"
        )

    opportunities = [
        "Perform predictive regression to forecast target columns",
        "Perform segmentation clustering to discover latent groups",
    ]

    threats = [
        "Incomplete data values can lead to skewed modeling or overfitting",
        "Outliers in numeric indicators might distort business projections",
    ]

    # 2. Recommendations & Opportunities lists
    recommendations = [
        "Initiate automated data cleaning to handle missing metrics"
        if missing_values > 0
        else "Proceed directly to statistical modeling",
        "Examine high-correlation columns to perform dimensional reduction",
    ]

    risks = []
    for col in meta.get("columns", []):
        if col.get("null_pct", 0) > 10:
            risks.append(
                f"High risk in column '{col['name']}' which contains {col['null_pct']}% null entries"
            )
    if not risks:
        risks.append("No major column integrity risks detected")

    executive_summary = (
        f"Executive analysis of '{meta.get('name')}' reveals a data collection of {row_count:,} records. "
        f"The data is structured across {col_count} fields with an overall quality index of {quality_score}%. "
        f"Based on the profiling parameters, the dataset is "
        f"{'well-suited for immediate machine learning' if quality_score >= 80 else 'a candidate for automated cleaning prior to modeling'}."
    )

    return InsightsResponse(
        dataset_id=meta.get("id", ""),
        swot=SWOT(
            strengths=strengths,
            weaknesses=weaknesses,
            opportunities=opportunities,
            threats=threats,
        ),
        opportunities=opportunities,
        risks=risks,
        recommendations=recommendations,
        executive_summary=executive_summary,
    )


# ---------------------------------------------------------------------------
# Helper: load DataFrame from Dataset ORM record
# ---------------------------------------------------------------------------

def _load_df(d: Dataset) -> pd.DataFrame:
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
    raise HTTPException(status_code=400, detail="Unsupported file type")


def _load_meta(d: Dataset) -> Dict[str, Any]:
    meta_path = Path(settings.UPLOAD_DIR) / d.id / "metadata.json"
    if meta_path.exists():
        try:
            with open(meta_path) as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "id": d.id,
        "name": d.name,
        "row_count": d.row_count,
        "column_count": d.column_count,
        "quality_score": d.quality_score or 0,
        "missing_values": d.missing_values or 0,
        "duplicate_rows": d.duplicate_rows or 0,
        "columns": d.columns or [],
    }


# ---------------------------------------------------------------------------
# Existing endpoint
# ---------------------------------------------------------------------------

@router.post("/{dataset_id}/generate", response_model=InsightsResponse)
async def generate_insights(
    dataset_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Generate executive insights for a dataset"""
    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")

    meta = _load_meta(d)

    insights_res = None
    if not settings.GROQ_API_KEY:
        # Fallback to heuristic insights
        insights_res = generate_heuristic_insights(meta)
    else:
        # Use Groq to generate insights
        try:
            from groq import AsyncGroq

            groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)

            # Build prompt from metadata
            columns_info = ""
            for col in meta.get("columns", [])[:15]:
                columns_info += f"- {col['name']} ({col['type']}): nulls={col.get('null_count', 0)}, uniques={col.get('unique_count', 0)}\n"

            prompt = f"""
You are an expert Chief Data Officer and Management Consultant.
Analyze the following dataset metadata and generate an executive insights payload in JSON format.

Dataset: {meta.get('name')}
Rows: {meta.get('row_count')}
Columns count: {meta.get('column_count')}
Quality score: {meta.get('quality_score')}%
Missing cells: {meta.get('missing_values')}
Duplicate rows: {meta.get('duplicate_rows')}

Columns structure:
{columns_info}

You MUST return a JSON object matches this JSON Schema EXACTLY:
{{
  "dataset_id": "{dataset_id}",
  "swot": {{
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"],
    "opportunities": ["opp1", "opp2"],
    "threats": ["threat1", "threat2"]
  }},
  "opportunities": ["strategic opportunity 1", "strategic opportunity 2"],
  "risks": ["operational risk 1", "operational risk 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "executive_summary": "executive paragraph summary"
}}

Respond ONLY with valid, parsable JSON. No comments, no markdown codeblocks, just raw JSON.
"""
            completion = await groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a data analyst. Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=2048,
                temperature=0.3,
            )
            text = completion.choices[0].message.content.strip()

            # Clean markdown wrappers if any
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            insights_dict = json.loads(text)
            insights_res = InsightsResponse(**insights_dict)

        except Exception as e:
            logger.warning(
                f"Groq insights generation failed: {e}. Falling back to heuristics."
            )
            insights_res = generate_heuristic_insights(meta)

    # Save to PostgreSQL database
    try:
        db_insight = (
            db.query(ExecutiveInsight)
            .filter(ExecutiveInsight.dataset_id == dataset_id)
            .first()
        )
        if not db_insight:
            db_insight = ExecutiveInsight(
                dataset_id=dataset_id,
                swot=insights_res.swot.model_dump(),
                opportunities=insights_res.opportunities,
                risks=insights_res.risks,
                recommendations=insights_res.recommendations,
                executive_summary=insights_res.executive_summary,
            )
            db.add(db_insight)
        else:
            db_insight.swot = insights_res.swot.model_dump()
            db_insight.opportunities = insights_res.opportunities
            db_insight.risks = insights_res.risks
            db_insight.recommendations = insights_res.recommendations
            db_insight.executive_summary = insights_res.executive_summary

        # Log activity
        log = ActivityLog(
            user_id=user.id,
            action="insights",
            details=f"Generated executive SWOT insights for dataset: {d.name}",
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to save insights to database: {e}")

    return insights_res


# ---------------------------------------------------------------------------
# NEW: POST /{dataset_id}/recommendations
# ---------------------------------------------------------------------------

@router.post("/{dataset_id}/recommendations")
async def get_recommendations(
    dataset_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Return a structured list of 4-6 prioritised recommendations derived from
    actual dataset statistics.  Uses Gemini when available, falls back to
    heuristics otherwise.
    """
    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")

    meta = _load_meta(d)

    # Try loading the DataFrame for richer stats
    df_stats: Dict[str, Any] = {}
    try:
        df = _load_df(d)
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        df_stats = {
            "row_count": len(df),
            "col_count": len(df.columns),
            "numeric_col_count": len(numeric_cols),
            "missing_pct": round(df.isnull().mean().mean() * 100, 2),
            "duplicate_count": int(df.duplicated().sum()),
            "numeric_cols": numeric_cols[:5],
        }
    except Exception:
        df_stats = {
            "row_count": meta.get("row_count", 0),
            "col_count": meta.get("column_count", 0),
            "numeric_col_count": 0,
            "missing_pct": 0,
            "duplicate_count": meta.get("duplicate_rows", 0),
            "numeric_cols": [],
        }

    # --- Try Groq ---
    if settings.GROQ_API_KEY:
        try:
            from groq import AsyncGroq

            groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)

            prompt = f"""
You are a senior business intelligence consultant. Based on the dataset statistics below,
generate 4-6 actionable business recommendations in valid JSON array format.

Dataset name: {meta.get('name')}
Rows: {df_stats['row_count']:,}
Columns: {df_stats['col_count']}
Numeric columns: {df_stats['numeric_col_count']} ({', '.join(df_stats['numeric_cols'])})
Missing data: {df_stats['missing_pct']}%
Duplicate rows: {df_stats['duplicate_count']}
Data quality score: {meta.get('quality_score', 'N/A')}%

Return ONLY a JSON array, no markdown:
[
  {{
    "id": "1",
    "priority": "critical|high|medium|low",
    "title": "Short action title",
    "description": "Two-sentence description of the recommendation.",
    "impact": "high|medium|low",
    "effort": "high|medium|low",
    "timeline": "Q1 2026",
    "category": "revenue|operations|data_quality|analytics|compliance|growth",
    "icon": "emoji",
    "roi_estimate": "$X potential or X% improvement"
  }}
]
"""
            completion = await groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a business intelligence consultant. Return only valid JSON arrays."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=2048,
                temperature=0.3,
            )
            text = completion.choices[0].message.content.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            recommendations = json.loads(text)
            if isinstance(recommendations, list):
                return recommendations
        except Exception as e:
            logger.warning(f"Groq recommendations failed: {e}. Using heuristics.")

    # --- Heuristic fallback ---
    recommendations = []
    rid = 1

    missing_pct = df_stats["missing_pct"]
    dup_count = df_stats["duplicate_count"]
    row_count = df_stats["row_count"]
    quality_score = meta.get("quality_score") or 0

    if missing_pct > 10:
        recommendations.append({
            "id": str(rid),
            "priority": "critical",
            "title": "Resolve Missing Data",
            "description": (
                f"{missing_pct:.1f}% of values are missing across this dataset. "
                "Apply automated imputation or flag these records for review before modeling."
            ),
            "impact": "high",
            "effort": "medium",
            "timeline": "Q1 2026",
            "category": "data_quality",
            "icon": "🔧",
            "roi_estimate": "Up to 30% improvement in model accuracy",
        })
        rid += 1

    if dup_count > 0:
        recommendations.append({
            "id": str(rid),
            "priority": "high",
            "title": "Deduplicate Records",
            "description": (
                f"{dup_count:,} duplicate rows detected. "
                "Deduplication will improve analytical accuracy and reduce storage costs."
            ),
            "impact": "medium",
            "effort": "low",
            "timeline": "Q1 2026",
            "category": "data_quality",
            "icon": "🗑️",
            "roi_estimate": f"{round(dup_count/max(row_count,1)*100,1)}% data reduction",
        })
        rid += 1

    if df_stats["numeric_col_count"] > 0:
        recommendations.append({
            "id": str(rid),
            "priority": "high",
            "title": "Deploy Predictive Forecasting",
            "description": (
                f"The {df_stats['numeric_col_count']} numeric column(s) "
                f"({', '.join(df_stats['numeric_cols'][:3])}) are strong candidates for ML forecasting. "
                "Run time-series or regression models to project future performance."
            ),
            "impact": "high",
            "effort": "medium",
            "timeline": "Q2 2026",
            "category": "analytics",
            "icon": "📈",
            "roi_estimate": "15-25% better decision lead time",
        })
        rid += 1

    if row_count > 1000:
        recommendations.append({
            "id": str(rid),
            "priority": "medium",
            "title": "Implement Customer Segmentation",
            "description": (
                f"With {row_count:,} records, unsupervised clustering (K-Means or DBSCAN) "
                "can uncover hidden segments to personalise offerings and optimise targeting."
            ),
            "impact": "high",
            "effort": "medium",
            "timeline": "Q2 2026",
            "category": "growth",
            "icon": "🎯",
            "roi_estimate": "10-20% uplift in conversion rate",
        })
        rid += 1

    if quality_score < 75:
        recommendations.append({
            "id": str(rid),
            "priority": "high",
            "title": "Improve Overall Data Quality",
            "description": (
                f"Data quality score of {quality_score}% is below the 75% threshold. "
                "Establish data validation pipelines and governance policies."
            ),
            "impact": "high",
            "effort": "high",
            "timeline": "Q1 2026",
            "category": "operations",
            "icon": "🛡️",
            "roi_estimate": "Prevents costly downstream errors",
        })
        rid += 1

    recommendations.append({
        "id": str(rid),
        "priority": "medium",
        "title": "Automate Executive Reporting",
        "description": (
            "Schedule weekly PDF executive reports summarising KPIs, anomalies, and trends. "
            "This eliminates manual reporting effort and ensures leadership alignment."
        ),
        "impact": "medium",
        "effort": "low",
        "timeline": "Q1 2026",
        "category": "operations",
        "icon": "📊",
        "roi_estimate": "4-8 hours saved per week",
    })

    return recommendations[:6]


# ---------------------------------------------------------------------------
# NEW: GET /{dataset_id}/export-pdf
# ---------------------------------------------------------------------------

@router.get("/{dataset_id}/export-pdf")
async def export_pdf_report(
    dataset_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Generate a PDF executive report and return a download URL.
    Uses reportlab if available; falls back to a plain-text marker file.
    """
    if not REPORTLAB_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="reportlab is not installed. Run: pip install reportlab",
        )

    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")

    meta = _load_meta(d)

    # Load DataFrame (gracefully handle missing file)
    df = pd.DataFrame()
    try:
        df = _load_df(d)
    except Exception:
        pass

    # Compute KPIs
    kpis = _engine.generate_kpis(df, meta) if not df.empty else []

    # Fetch stored SWOT from DB or generate heuristically
    db_insight = (
        db.query(ExecutiveInsight)
        .filter(ExecutiveInsight.dataset_id == dataset_id)
        .first()
    )
    if db_insight and db_insight.swot:
        swot = db_insight.swot  # dict
    else:
        heuristic = generate_heuristic_insights(meta)
        swot = heuristic.swot.model_dump()

    # Prepare output dir
    report_dir = Path(settings.UPLOAD_DIR) / dataset_id / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    pdf_filename = f"executive_{timestamp}.pdf"
    pdf_path = report_dir / pdf_filename

    # Build PDF
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(str(pdf_path), pagesize=letter)
    story = []

    # --- Title page ---
    title_style = styles["Title"]
    story.append(Paragraph(f"Executive Report: {d.name}", title_style))
    story.append(Spacer(1, 12))
    story.append(
        Paragraph(
            f"Generated on {datetime.utcnow().strftime('%B %d, %Y %H:%M UTC')}",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 24))

    # --- Executive Summary ---
    story.append(Paragraph("Executive Summary", styles["Heading1"]))
    story.append(Spacer(1, 6))
    exec_summary = (
        db_insight.executive_summary
        if db_insight and db_insight.executive_summary
        else meta.get(
            "executive_summary",
            f"Analysis of dataset '{d.name}' with {meta.get('row_count', 0):,} records.",
        )
    )
    story.append(Paragraph(exec_summary, styles["BodyText"]))
    story.append(Spacer(1, 18))

    # --- Data Quality Summary ---
    story.append(Paragraph("Data Quality Summary", styles["Heading1"]))
    story.append(Spacer(1, 6))
    quality_data = [
        ["Metric", "Value"],
        ["Total Rows", f"{meta.get('row_count', 'N/A'):,}" if meta.get('row_count') else "N/A"],
        ["Total Columns", str(meta.get("column_count", "N/A"))],
        ["Quality Score", f"{meta.get('quality_score', 'N/A')}%"],
        ["Missing Values", str(meta.get("missing_values", "N/A"))],
        ["Duplicate Rows", str(meta.get("duplicate_rows", "N/A"))],
    ]
    q_table = Table(quality_data, colWidths=[200, 200])
    q_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8f8ff"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("PADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(q_table)
    story.append(Spacer(1, 18))

    # --- KPI Table ---
    if kpis:
        story.append(Paragraph("Key Performance Indicators", styles["Heading1"]))
        story.append(Spacer(1, 6))
        kpi_data = [["KPI", "Current Value", "Prev Value", "% Change", "Trend"]]
        for kpi in kpis:
            unit = kpi.get("unit", "")
            val = f"{unit}{kpi.get('value', '')}"
            prev = f"{unit}{kpi.get('prev_value', '')}"
            chg = f"{kpi.get('change_pct', 0):.1f}%"
            trend = {"up": "▲ Up", "down": "▼ Down", "stable": "→ Stable"}.get(
                kpi.get("trend", "stable"), kpi.get("trend", "")
            )
            kpi_data.append([kpi.get("name", ""), val, prev, chg, trend])

        kpi_table = Table(kpi_data, colWidths=[130, 90, 90, 70, 80])
        kpi_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#10b981")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f0fff4"), colors.white]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("PADDING", (0, 0), (-1, -1), 5),
            ])
        )
        story.append(kpi_table)
        story.append(Spacer(1, 18))

    # --- SWOT Table ---
    story.append(Paragraph("SWOT Analysis", styles["Heading1"]))
    story.append(Spacer(1, 6))

    def _bullet_list(items: List[str]) -> str:
        return "\n".join(f"• {item}" for item in (items or ["N/A"]))

    swot_data = [
        ["Strengths 💪", "Weaknesses ⚠️"],
        [
            _bullet_list(swot.get("strengths", [])),
            _bullet_list(swot.get("weaknesses", [])),
        ],
        ["Opportunities 🚀", "Threats 🔴"],
        [
            _bullet_list(swot.get("opportunities", [])),
            _bullet_list(swot.get("threats", [])),
        ],
    ]
    swot_table = Table(swot_data, colWidths=[230, 230])
    swot_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#6366f1")),
            ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#f59e0b")),
            ("BACKGROUND", (0, 2), (0, 2), colors.HexColor("#10b981")),
            ("BACKGROUND", (1, 2), (1, 2), colors.HexColor("#ef4444")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("TEXTCOLOR", (0, 2), (-1, 2), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("PADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(swot_table)
    story.append(Spacer(1, 18))

    # --- Top Recommendations ---
    story.append(Paragraph("Top Recommendations", styles["Heading1"]))
    story.append(Spacer(1, 6))
    if db_insight and db_insight.recommendations:
        for i, rec in enumerate(db_insight.recommendations[:6], 1):
            story.append(
                Paragraph(f"{i}. {rec}", styles["BodyText"])
            )
            story.append(Spacer(1, 4))

    # Build the PDF
    doc.build(story)

    # Return JSON with download path
    generated_at = datetime.utcnow().isoformat() + "Z"
    relative_url = f"/uploads/{dataset_id}/reports/{pdf_filename}"

    # Log activity
    try:
        log = ActivityLog(
            user_id=user.id,
            action="export_pdf",
            details=f"Exported PDF executive report for dataset: {d.name}",
        )
        db.add(log)
        db.commit()
    except Exception:
        pass

    return {
        "download_url": relative_url,
        "file_path": str(pdf_path),
        "generated_at": generated_at,
        "dataset_name": d.name,
        "file_size_bytes": pdf_path.stat().st_size if pdf_path.exists() else 0,
    }
