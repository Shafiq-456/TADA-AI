"""
Visualization routes - generates dynamic chart data from uploaded datasets
"""
import json
from pathlib import Path
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np

from app.database import get_db
from app.utils.auth import get_current_user
from app.models import Dataset

router = APIRouter()


@router.get("/{dataset_id}")
async def get_visualizations(
    dataset_id: str,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Generate actual dataset-driven chart details for the frontend to render"""
    d = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        # Load dataset
        ext = d.file_type
        file_path = d.file_path

        # If a cleaned version exists, use it
        cleaned_file = Path(file_path).parent / "cleaned.csv"
        if cleaned_file.exists():
            file_path = str(cleaned_file)
            ext = 'csv'

        if ext == 'csv':
            df = pd.read_csv(file_path)
        elif ext in ('xlsx', 'xls'):
            df = pd.read_excel(file_path)
        elif ext == 'json':
            df = pd.read_json(file_path)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")

        if len(df) == 0:
            return {"dataset_id": dataset_id, "charts": {}}

        # Identify column types
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        
        # Look for date columns
        date_col = None
        for col in df.columns:
            if 'date' in col.lower() or 'time' in col.lower():
                try:
                    pd.to_datetime(df[col].head(5))
                    date_col = col
                    break
                except Exception:
                    pass

        # 1. Bar Chart Data: group by a categorical column and sum/count a numeric column
        bar_data = []
        bar_title = "Data Counts"
        if cat_cols:
            group_col = cat_cols[0]
            val_col = numeric_cols[0] if numeric_cols else None
            
            if val_col:
                grouped = df.groupby(group_col)[val_col].sum().reset_index()
                bar_title = f"Sum of {val_col} by {group_col}"
            else:
                grouped = df.groupby(group_col).size().reset_index(name='count')
                val_col = 'count'
                bar_title = f"Count by {group_col}"
                
            grouped = grouped.sort_values(by=val_col, ascending=False).head(8)
            bar_data = [
                {"name": str(row[group_col]), "value": round(float(row[val_col]), 2) if not pd.isna(row[val_col]) else 0}
                for _, row in grouped.iterrows()
            ]

        # 2. Line / Area Chart Data: Trend over date or index
        trend_data = []
        trend_title = "Trend Analysis"
        if numeric_cols:
            val_col = numeric_cols[0]
            if date_col:
                df_temp = df[[date_col, val_col]].dropna().copy()
                df_temp[date_col] = pd.to_datetime(df_temp[date_col])
                grouped = df_temp.groupby(df_temp[date_col].dt.to_period('M'))[val_col].mean().reset_index()
                grouped[date_col] = grouped[date_col].dt.strftime('%b %Y')
                trend_title = f"Monthly Avg {val_col}"
                trend_data = [
                    {"name": str(row[date_col]), "value": round(float(row[val_col]), 2)}
                    for _, row in grouped.head(15).iterrows()
                ]
            else:
                # Use index or sampling
                sample_df = df[[val_col]].dropna().head(20)
                trend_title = f"{val_col} Sequence Profile"
                trend_data = [
                    {"name": f"P-{i+1}", "value": round(float(val), 2)}
                    for i, val in enumerate(sample_df[val_col].tolist())
                ]

        # 3. Pie Chart Data: top category shares
        pie_data = []
        pie_title = "Category Breakdown"
        if cat_cols:
            group_col = cat_cols[0]
            counts = df[group_col].value_counts().head(5)
            total = len(df)
            pie_title = f"Top {group_col} Distribution"
            pie_data = [
                {"name": str(k), "value": round((int(v) / total) * 100, 1)}
                for k, v in counts.items()
            ]

        # 4. Scatter Plot Data: x vs y
        scatter_data = []
        scatter_title = "Correlation Scatter"
        if len(numeric_cols) >= 2:
            x_col, y_col = numeric_cols[0], numeric_cols[1]
            scatter_title = f"{x_col} vs {y_col} Distribution"
            sample_df = df[[x_col, y_col]].dropna().head(80)
            scatter_data = [
                {"x": round(float(row[x_col]), 2), "y": round(float(row[y_col]), 2)}
                for _, row in sample_df.iterrows()
            ]

        # 5. Histogram Data: Frequency bins for a numeric column
        histogram_data = []
        histogram_title = "Distribution Frequency"
        if numeric_cols:
            val_col = numeric_cols[0]
            histogram_title = f"{val_col} Frequency Distribution"
            counts, bins = np.histogram(df[val_col].dropna(), bins=10)
            for i in range(len(counts)):
                bin_range = f"{round(bins[i], 1)}-{round(bins[i+1], 1)}"
                histogram_data.append({"name": bin_range, "count": int(counts[i])})

        # 6. Heatmap Data: Correlation Matrix grid
        heatmap_data = []
        heatmap_title = "Attribute Correlation Matrix"
        if len(numeric_cols) > 1:
            corr_df = df[numeric_cols[:6]].corr()  # limit to top 6 cols
            for col_x in corr_df.columns:
                for col_y in corr_df.index:
                    val = corr_df.loc[col_y, col_x]
                    heatmap_data.append({
                        "x": col_x,
                        "y": col_y,
                        "value": round(float(val), 3) if not pd.isna(val) else 0.0
                    })

        # 7. Box Plot Data: Summary Box Stats
        boxplot_data = []
        boxplot_title = "Variable Dispersion (Box Stats)"
        for col in numeric_cols[:4]:  # top 4 columns
            col_data = df[col].dropna()
            if len(col_data) > 0:
                boxplot_data.append({
                    "column": col,
                    "min": round(float(col_data.min()), 2),
                    "q1": round(float(col_data.quantile(0.25)), 2),
                    "median": round(float(col_data.median()), 2),
                    "q3": round(float(col_data.quantile(0.75)), 2),
                    "max": round(float(col_data.max()), 2)
                })

        return {
            "dataset_id": dataset_id,
            "charts": {
                "bar": {"title": bar_title, "data": bar_data},
                "line": {"title": trend_title, "data": trend_data},
                "pie": {"title": pie_title, "data": pie_data},
                "scatter": {"title": scatter_title, "data": scatter_data},
                "histogram": {"title": histogram_title, "data": histogram_data},
                "heatmap": {"title": heatmap_title, "data": heatmap_data},
                "boxplot": {"title": boxplot_title, "data": boxplot_data}
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate charts: {str(e)}")
