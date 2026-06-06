"""
Smart Insights Engine - Automated KPI, Anomaly, and Dashboard Intelligence
"""
import logging
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from scipy import stats

logger = logging.getLogger(__name__)


def _safe_float(val) -> Optional[float]:
    """Convert numpy scalar to Python float safely."""
    if val is None:
        return None
    try:
        v = float(val)
        if np.isnan(v) or np.isinf(v):
            return None
        return round(v, 4)
    except (TypeError, ValueError):
        return None


def _safe_int(val) -> Optional[int]:
    """Convert numpy scalar to Python int safely."""
    if val is None:
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


class SmartInsightsEngine:
    """Automated business intelligence engine for dataset analysis."""

    # -------------------------------------------------------------------------
    # 1. KPI Generation
    # -------------------------------------------------------------------------

    def generate_kpis(self, df: pd.DataFrame, meta: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        For each numeric column compute current value, previous value, % change,
        trend direction, min, max and std.  Return top-6 KPIs as a list of dicts.
        """
        if df is None or df.empty:
            return []

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if not numeric_cols:
            return []

        kpis: List[Dict[str, Any]] = []

        for col in numeric_cols:
            series = df[col].dropna()
            if len(series) == 0:
                continue

            n = len(series)
            half = max(1, n // 2)

            # Current = last row value (or mean of second half if single row)
            if n >= 2:
                current_val = float(series.iloc[-1])
                prev_val = float(series.iloc[:half].mean())
            else:
                current_val = float(series.mean())
                prev_val = current_val

            # Percent change
            if abs(prev_val) > 1e-10:
                change_pct = ((current_val - prev_val) / abs(prev_val)) * 100
            else:
                change_pct = 0.0

            # Trend direction
            if change_pct > 2:
                trend = "up"
            elif change_pct < -2:
                trend = "down"
            else:
                trend = "stable"

            col_min = _safe_float(series.min())
            col_max = _safe_float(series.max())
            col_std = _safe_float(series.std())

            # Infer unit hint from column name
            name_lower = col.lower()
            if any(kw in name_lower for kw in ("revenue", "sales", "price", "cost", "amount", "income", "profit")):
                unit = "$"
            elif any(kw in name_lower for kw in ("pct", "percent", "rate", "ratio")):
                unit = "%"
            else:
                unit = ""

            kpis.append({
                "name": col.replace("_", " ").title(),
                "column": col,
                "value": _safe_float(current_val),
                "prev_value": _safe_float(prev_val),
                "change_pct": round(change_pct, 2),
                "trend": trend,
                "unit": unit,
                "min": col_min,
                "max": col_max,
                "std": col_std,
            })

        # Sort by abs change_pct descending and return top 6
        kpis.sort(key=lambda x: abs(x.get("change_pct") or 0), reverse=True)
        return kpis[:6]

    # -------------------------------------------------------------------------
    # 2. Anomaly Detection
    # -------------------------------------------------------------------------

    def detect_anomalies(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Detect anomalies for each numeric column using Z-score (|z|>2.5) AND IQR method.
        Returns list of anomaly dicts with column, type, severity, value, expected_range,
        row_index, z_score, and description.
        """
        if df is None or df.empty:
            return []

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if not numeric_cols:
            return []

        anomalies: List[Dict[str, Any]] = []

        for col in numeric_cols:
            series = df[col].dropna()
            if len(series) < 4:
                continue

            col_mean = float(series.mean())
            col_std = float(series.std())

            # IQR bounds
            q1 = float(series.quantile(0.25))
            q3 = float(series.quantile(0.75))
            iqr = q3 - q1
            iqr_lower = q1 - 1.5 * iqr
            iqr_upper = q3 + 1.5 * iqr

            # Z-scores for the full series (aligned to original df index)
            if col_std > 0:
                z_scores = np.abs(stats.zscore(series))
            else:
                z_scores = np.zeros(len(series))

            for idx_pos, (orig_idx, val) in enumerate(series.items()):
                z = float(z_scores[idx_pos]) if col_std > 0 else 0.0
                is_zscore_anomaly = z > 2.5
                is_iqr_anomaly = float(val) < iqr_lower or float(val) > iqr_upper

                if not (is_zscore_anomaly or is_iqr_anomaly):
                    continue

                # Type
                if float(val) > col_mean:
                    anomaly_type = "spike"
                else:
                    anomaly_type = "dip"

                if is_zscore_anomaly and is_iqr_anomaly:
                    anomaly_type = "outlier"

                # Severity based on z-score
                if z > 4:
                    severity = "high"
                elif z > 3:
                    severity = "medium"
                else:
                    severity = "low"

                # Guard against too many anomalies per column
                col_anomalies = [a for a in anomalies if a["column"] == col]
                if len(col_anomalies) >= 5:
                    continue

                anomalies.append({
                    "column": col,
                    "type": anomaly_type,
                    "severity": severity,
                    "value": _safe_float(val),
                    "expected_range": [
                        _safe_float(max(iqr_lower, col_mean - 2.5 * col_std)),
                        _safe_float(min(iqr_upper, col_mean + 2.5 * col_std)),
                    ],
                    "row_index": _safe_int(orig_idx),
                    "z_score": round(z, 3),
                    "description": (
                        f"Column '{col}' has a {anomaly_type} at row {orig_idx}: "
                        f"value={round(float(val), 4)}, z-score={round(z, 2)}"
                    ),
                })

        return anomalies

    # -------------------------------------------------------------------------
    # 3. Smart Findings
    # -------------------------------------------------------------------------

    def generate_smart_findings(
        self,
        df: pd.DataFrame,
        meta: Dict[str, Any],
        dataset_name: str = "Dataset",
    ) -> Dict[str, Any]:
        """
        Return {top_findings, risks, opportunities, summary} where each item is
        {title, description, icon, severity, metric}.
        """
        if df is None or df.empty:
            return {
                "top_findings": [],
                "risks": [],
                "opportunities": [],
                "summary": "No data available for analysis.",
            }

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        row_count = len(df)
        col_count = len(df.columns)

        top_findings: List[Dict] = []
        risks: List[Dict] = []
        opportunities: List[Dict] = []

        # --- Missing value analysis ---
        total_cells = row_count * col_count
        missing_count = int(df.isnull().sum().sum())
        missing_pct = (missing_count / max(total_cells, 1)) * 100

        if missing_pct > 20:
            risks.append({
                "title": "High Missing Data Rate",
                "description": f"{round(missing_pct, 1)}% of all values are missing ({missing_count:,} cells). This may bias any ML model trained on this data.",
                "icon": "⚠️",
                "severity": "high",
                "metric": f"{round(missing_pct, 1)}% missing",
            })
        elif missing_pct > 5:
            risks.append({
                "title": "Moderate Missing Data",
                "description": f"{round(missing_pct, 1)}% missing values detected. Consider imputation before modeling.",
                "icon": "🔶",
                "severity": "medium",
                "metric": f"{round(missing_pct, 1)}% missing",
            })

        # --- Duplicate rows ---
        dup_count = int(df.duplicated().sum())
        if dup_count > 0:
            risks.append({
                "title": "Duplicate Records Found",
                "description": f"{dup_count:,} duplicate rows detected, which is {round(dup_count/row_count*100,1)}% of the dataset. Deduplication is recommended.",
                "icon": "🔁",
                "severity": "medium" if dup_count / row_count < 0.1 else "high",
                "metric": f"{dup_count} duplicates",
            })

        # --- Numeric column findings ---
        for col in numeric_cols[:8]:
            series = df[col].dropna()
            if len(series) < 2:
                continue
            col_mean = float(series.mean())
            col_std = float(series.std())
            col_cv = col_std / (abs(col_mean) + 1e-10)

            # High volatility
            if col_cv > 1.0:
                top_findings.append({
                    "title": f"High Volatility in '{col}'",
                    "description": f"Coefficient of variation is {round(col_cv, 2)}, indicating extreme spread relative to the mean ({round(col_mean, 2)}).",
                    "icon": "📉",
                    "severity": "medium",
                    "metric": f"CV={round(col_cv, 2)}",
                })

            # Skewness
            try:
                skewness = float(series.skew())
                if abs(skewness) > 2:
                    top_findings.append({
                        "title": f"Highly Skewed Distribution: '{col}'",
                        "description": f"Skewness of {round(skewness, 2)} suggests a non-normal distribution. Log transformation may improve model performance.",
                        "icon": "📊",
                        "severity": "low",
                        "metric": f"Skewness={round(skewness, 2)}",
                    })
            except Exception:
                pass

        # --- Correlation opportunities ---
        if len(numeric_cols) > 1:
            try:
                corr_matrix = df[numeric_cols].corr().abs()
                np.fill_diagonal(corr_matrix.values, 0)
                max_corr = float(corr_matrix.max().max())
                if max_corr > 0.85:
                    # Find the pair
                    max_idx = corr_matrix.stack().idxmax()
                    opportunities.append({
                        "title": "High Correlation Detected",
                        "description": f"Columns '{max_idx[0]}' and '{max_idx[1]}' have a correlation of {round(max_corr, 2)}. Consider feature engineering or dimensionality reduction.",
                        "icon": "🔗",
                        "severity": "medium",
                        "metric": f"r={round(max_corr, 2)}",
                    })
                elif max_corr > 0.6:
                    max_idx = corr_matrix.stack().idxmax()
                    opportunities.append({
                        "title": "Moderate Correlations Present",
                        "description": f"Strongest correlation: '{max_idx[0]}' ↔ '{max_idx[1]}' at r={round(max_corr, 2)}. Useful for regression or prediction tasks.",
                        "icon": "📈",
                        "severity": "low",
                        "metric": f"r={round(max_corr, 2)}",
                    })
            except Exception:
                pass

        # --- Size-based opportunities ---
        if row_count > 1000:
            opportunities.append({
                "title": "Large Dataset — ML Ready",
                "description": f"With {row_count:,} rows, this dataset has sufficient volume for machine learning. Consider clustering, classification, or regression models.",
                "icon": "🚀",
                "severity": "low",
                "metric": f"{row_count:,} rows",
            })

        if row_count < 100:
            risks.append({
                "title": "Small Dataset — Limited Modeling Power",
                "description": f"Only {row_count} rows available. Statistical significance may be low; avoid over-fitting.",
                "icon": "📉",
                "severity": "medium",
                "metric": f"{row_count} rows",
            })

        # Summary
        quality_score = meta.get("quality_score", 100 - missing_pct)
        summary = (
            f"Analysis of '{dataset_name}' with {row_count:,} records and {col_count} columns. "
            f"Overall data quality index: {round(quality_score, 1)}%. "
            f"Found {len(top_findings)} key finding(s), {len(risks)} risk(s), and {len(opportunities)} opportunity(ies)."
        )

        return {
            "top_findings": top_findings[:6],
            "risks": risks[:6],
            "opportunities": opportunities[:6],
            "summary": summary,
        }

    # -------------------------------------------------------------------------
    # 4. Auto Dashboard Config
    # -------------------------------------------------------------------------

    def build_auto_dashboard_config(
        self, df: pd.DataFrame, meta: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze columns and return chart configs plus KPIs and suggested analysis strings.
        Returns: {charts: [...], kpis: [...], suggested_analysis: [str]}
        """
        if df is None or df.empty:
            return {"charts": [], "kpis": [], "suggested_analysis": []}

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
        datetime_cols = df.select_dtypes(include=["datetime64"]).columns.tolist()

        # Also detect string columns that might be datetime
        for col in categorical_cols:
            try:
                parsed = pd.to_datetime(df[col], infer_datetime_format=True, errors="coerce")
                if parsed.notna().mean() > 0.8:
                    datetime_cols.append(col)
            except Exception:
                pass

        charts = []
        chart_id = 1

        # Helper: safe data payload
        def _chart_data(x_col, y_col, sample_n=100):
            sub = df[[x_col, y_col]].dropna().head(sample_n)
            return [
                {
                    str(x_col): (
                        str(row[x_col]) if not isinstance(row[x_col], (int, float)) else _safe_float(row[x_col])
                    ),
                    str(y_col): _safe_float(row[y_col]),
                }
                for _, row in sub.iterrows()
            ]

        # 1. Line chart — if datetime col present, use for x-axis with first numeric y
        if datetime_cols and numeric_cols:
            x_col = datetime_cols[0]
            y_col = numeric_cols[0]
            try:
                sub = df[[x_col, y_col]].dropna().head(200)
                sub = sub.sort_values(x_col)
                data = [
                    {"x": str(row[x_col]), "y": _safe_float(row[y_col])}
                    for _, row in sub.iterrows()
                ]
                charts.append({
                    "id": f"chart_{chart_id}",
                    "type": "line",
                    "title": f"{y_col.replace('_', ' ').title()} Over Time",
                    "x_col": x_col,
                    "y_col": y_col,
                    "data": data,
                    "color": "#6366f1",
                })
                chart_id += 1
            except Exception:
                pass

        # 2. Bar chart — categorical x, numeric y (mean aggregation)
        if categorical_cols and numeric_cols:
            x_col = categorical_cols[0]
            y_col = numeric_cols[0]
            try:
                n_unique = df[x_col].nunique()
                if 2 <= n_unique <= 30:
                    agg = df.groupby(x_col)[y_col].mean().reset_index()
                    agg = agg.sort_values(y_col, ascending=False).head(15)
                    data = [
                        {
                            str(x_col): str(row[x_col]),
                            str(y_col): _safe_float(row[y_col]),
                        }
                        for _, row in agg.iterrows()
                    ]
                    charts.append({
                        "id": f"chart_{chart_id}",
                        "type": "bar",
                        "title": f"Avg {y_col.replace('_', ' ').title()} by {x_col.replace('_', ' ').title()}",
                        "x_col": x_col,
                        "y_col": y_col,
                        "data": data,
                        "color": "#10b981",
                    })
                    chart_id += 1
            except Exception:
                pass

        # 3. Scatter plot — first two numeric cols
        if len(numeric_cols) >= 2:
            x_col, y_col = numeric_cols[0], numeric_cols[1]
            try:
                data = _chart_data(x_col, y_col, sample_n=200)
                charts.append({
                    "id": f"chart_{chart_id}",
                    "type": "scatter",
                    "title": f"{x_col.replace('_', ' ').title()} vs {y_col.replace('_', ' ').title()}",
                    "x_col": x_col,
                    "y_col": y_col,
                    "data": data,
                    "color": "#f59e0b",
                })
                chart_id += 1
            except Exception:
                pass

        # 4. Pie / donut — first categorical col with low cardinality
        for cat_col in categorical_cols:
            n_unique = df[cat_col].nunique()
            if 2 <= n_unique <= 10:
                try:
                    counts = df[cat_col].value_counts().head(10)
                    data = [{"name": str(k), "value": int(v)} for k, v in counts.items()]
                    charts.append({
                        "id": f"chart_{chart_id}",
                        "type": "pie",
                        "title": f"Distribution of {cat_col.replace('_', ' ').title()}",
                        "x_col": cat_col,
                        "y_col": "count",
                        "data": data,
                        "color": "#8b5cf6",
                    })
                    chart_id += 1
                    break
                except Exception:
                    pass

        # 5. Histogram — third numeric col (if available)
        if len(numeric_cols) >= 3:
            col = numeric_cols[2]
            try:
                series = df[col].dropna()
                counts, bin_edges = np.histogram(series, bins=20)
                data = [
                    {"bin": round(float(bin_edges[i]), 4), "count": int(counts[i])}
                    for i in range(len(counts))
                ]
                charts.append({
                    "id": f"chart_{chart_id}",
                    "type": "histogram",
                    "title": f"Distribution of {col.replace('_', ' ').title()}",
                    "x_col": col,
                    "y_col": "frequency",
                    "data": data,
                    "color": "#ec4899",
                })
                chart_id += 1
            except Exception:
                pass

        # KPIs
        kpis = self.generate_kpis(df, meta)

        # Suggested analyses
        suggested_analysis: List[str] = []
        if numeric_cols:
            suggested_analysis.append(
                f"Run time series forecast on '{numeric_cols[0]}' to predict future trends."
            )
        if len(numeric_cols) >= 2:
            suggested_analysis.append(
                "Perform correlation analysis to identify drivers of key metrics."
            )
        if categorical_cols:
            suggested_analysis.append(
                f"Segment data by '{categorical_cols[0]}' to uncover performance differences."
            )
        if len(df) > 500:
            suggested_analysis.append(
                "Apply clustering (K-Means) to discover latent customer or product segments."
            )
        suggested_analysis.append(
            "Review anomaly detection results to identify data quality issues or business events."
        )

        return {
            "charts": charts,
            "kpis": kpis,
            "suggested_analysis": suggested_analysis,
        }
