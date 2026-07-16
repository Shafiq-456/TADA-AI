"""
Forecasting Routes - ML-powered time series forecasting
"""
import os
import json
from pathlib import Path
from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import xgboost as xgb
from prophet import Prophet

from app.config import settings
from app.database import get_db
from app.utils.auth import get_current_user
from app.models import Dataset, Forecast, ActivityLog

try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False

router = APIRouter()


class ForecastRequest(BaseModel):
    dataset_id: str
    target_column: str
    date_column: Optional[str] = None
    horizon_days: int = 90
    model_type: str = "linear"  # linear, rf, xgboost, prophet


@router.post("/run")
async def run_forecast(
    request: ForecastRequest,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Run time series forecast on dataset"""
    d = db.query(Dataset).filter(Dataset.id == request.dataset_id).first()
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
        else:
            df = pd.read_json(file_path)

        if request.target_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{request.target_column}' not found")

        # Select target column and drop nulls
        series = df[request.target_column].dropna()
        if len(series) < 10:
            raise HTTPException(status_code=400, detail="Not enough data points in target column for forecasting")

        y = series.values
        X = np.arange(len(y)).reshape(-1, 1)

        train_size = int(len(X) * 0.8)
        X_train, X_test = X[:train_size], X[train_size:]
        y_train, y_test = y[:train_size], y[train_size:]

        # Initialize model variables
        mae = 0
        r2 = 0
        accuracy = 0
        forecast_points = []
        future_preds = []
        std = float(np.std(y)) * 0.1

        if request.model_type == "prophet":
            # Prophet time-series modeling
            try:
                if not PROPHET_AVAILABLE:
                    raise ImportError("Prophet not available")
                pdf = pd.DataFrame()
                if request.date_column and request.date_column in df.columns:
                    pdf['ds'] = pd.to_datetime(df[request.date_column].dropna())
                else:
                    # Create synthetic daily datetime index
                    pdf['ds'] = pd.date_range(end=datetime.now(), periods=len(df), freq='D')
                
                pdf['y'] = df[request.target_column].dropna().values[:len(pdf)]
                
                # Fit Prophet
                m = Prophet(yearly_seasonality=True, weekly_seasonality=True, daily_seasonality=False)
                m.fit(pdf)
                
                # Create future dates
                future_df = m.make_future_dataframe(periods=request.horizon_days)
                forecast_prophet = m.predict(future_df)
                
                # Metrics
                y_pred_full = forecast_prophet['yhat'].values[:len(pdf)]
                mae = float(mean_absolute_error(pdf['y'].values, y_pred_full))
                r2 = float(r2_score(pdf['y'].values, y_pred_full))
                accuracy = max(0, min(100, (1 - mae / (np.mean(np.abs(pdf['y'].values)) + 1e-10)) * 100))
                
                # Future predictions
                future_slice = forecast_prophet.tail(request.horizon_days // 7 + 1)
                for i, row in enumerate(future_slice.iterrows()):
                    row_data = row[1]
                    val = float(row_data['yhat'])
                    lower = float(row_data['yhat_lower'])
                    upper = float(row_data['yhat_upper'])
                    forecast_points.append({
                        "period": i + 1,
                        "value": round(val, 2),
                        "lower": round(lower, 2),
                        "upper": round(upper, 2),
                        "date": row_data['ds'].strftime("%Y-%m-%d")
                    })
                future_preds = [row["value"] for row in forecast_points]
            except Exception as e:
                # Fallback to RF if Prophet errors out
                request.model_type = "rf"
                model = RandomForestRegressor(n_estimators=100, random_state=42)
                model.fit(X_train, y_train)
                y_pred_test = model.predict(X_test)
                mae = float(mean_absolute_error(y_test, y_pred_test)) if len(y_test) > 0 else 0
                r2 = float(r2_score(y_test, y_pred_test)) if len(y_test) > 1 else 0
                accuracy = max(0, min(100, (1 - mae / (np.mean(np.abs(y_test)) + 1e-10)) * 100))
                
                future_X = np.arange(len(X), len(X) + request.horizon_days // 7 + 1).reshape(-1, 1)
                future_preds = model.predict(future_X)
                std = np.std(y - model.predict(X)) if len(y) > 1 else np.std(y) * 0.1

        if request.model_type != "prophet":
            # Classical Sklearn Regression
            if request.model_type == "rf":
                model = RandomForestRegressor(n_estimators=100, random_state=42)
            elif request.model_type == "xgboost":
                model = xgb.XGBRegressor(n_estimators=100, random_state=42)
            else:
                model = LinearRegression()

            model.fit(X_train, y_train)
            y_pred_test = model.predict(X_test)

            mae = float(mean_absolute_error(y_test, y_pred_test)) if len(y_test) > 0 else 0
            r2 = float(r2_score(y_test, y_pred_test)) if len(y_test) > 1 else 0
            accuracy = max(0, min(100, (1 - mae / (np.mean(np.abs(y_test)) + 1e-10)) * 100))

            # Future predictions
            future_X = np.arange(len(X), len(X) + request.horizon_days // 7 + 1).reshape(-1, 1)
            future_preds = model.predict(future_X)
            std = np.std(y - model.predict(X)) if len(y) > 1 else np.std(y) * 0.1

            # Format forecast points
            start_date = datetime.now()
            for i, v in enumerate(future_preds):
                point_date = start_date + timedelta(weeks=i+1)
                forecast_points.append({
                    "period": i + 1,
                    "value": round(float(v), 2),
                    "lower": round(float(v) - 1.96 * float(std), 2),
                    "upper": round(float(v) + 1.96 * float(std), 2),
                    "date": point_date.strftime("%Y-%m-%d")
                })

        # Save to database
        db_forecast = Forecast(
            dataset_id=request.dataset_id,
            target_column=request.target_column,
            model_type=request.model_type,
            horizon_days=request.horizon_days,
            accuracy_score=round(float(accuracy), 1),
            r2_score=round(float(r2), 3),
            mae=round(float(mae), 2),
            forecast_points=forecast_points
        )
        db.add(db_forecast)
        
        # Log activity
        log = ActivityLog(
            user_id=user.id,
            action="forecast",
            details=f"Ran {request.model_type} forecast on column '{request.target_column}' with {round(float(accuracy), 1)}% accuracy"
        )
        db.add(log)
        db.commit()
        db.refresh(db_forecast)

        # -----------------------------------------------------------------------
        # Enhanced response fields
        # -----------------------------------------------------------------------
        trend_direction = "upward" if future_preds[-1] > future_preds[0] else "downward"
        pct_change = ((future_preds[-1] - future_preds[0]) / (abs(future_preds[0]) + 1e-10)) * 100

        # Confidence score based on R²
        if r2 > 0.8:
            confidence_score = int(85 + min(15, (r2 - 0.8) * 75))
        elif r2 > 0.5:
            confidence_score = int(65 + (r2 - 0.5) * 67)
        elif r2 > 0:
            confidence_score = int(40 + r2 * 50)
        else:
            confidence_score = int(max(20, 40 + r2 * 20))
        confidence_score = max(0, min(100, confidence_score))

        # Trend label
        abs_pct = abs(pct_change)
        if abs_pct > 20 and pct_change > 0 and r2 > 0.5:
            trend_label = "Strong Upward Trend"
        elif pct_change > 5 and r2 > 0.3:
            trend_label = "Moderate Growth"
        elif abs_pct <= 5:
            trend_label = "Stable"
        elif pct_change < -5 and r2 > 0.3:
            trend_label = "Declining"
        else:
            trend_label = "Volatile"

        # Model description lookup
        model_descriptions = {
            "linear": {
                "name": "Linear Regression",
                "description": "Fits a straight line to historical data to project future values.",
                "strengths": ["Fast training", "Interpretable coefficients", "Works well with linear trends"],
                "best_for": "Datasets with clear linear growth or decline patterns",
            },
            "rf": {
                "name": "Random Forest Regressor",
                "description": "Ensemble of decision trees that captures non-linear relationships.",
                "strengths": ["Handles non-linearity", "Robust to outliers", "No feature scaling needed"],
                "best_for": "Complex datasets with non-linear patterns and mixed feature types",
            },
            "xgboost": {
                "name": "XGBoost Regressor",
                "description": "Gradient-boosted tree ensemble optimized for speed and accuracy.",
                "strengths": ["High accuracy", "Built-in regularization", "Handles missing values"],
                "best_for": "Structured/tabular data competitions and production forecasting",
            },
            "prophet": {
                "name": "Prophet (Meta)",
                "description": "Additive time series model with trend, seasonality, and holiday effects.",
                "strengths": ["Handles seasonality automatically", "Robust to missing data", "Interpretable components"],
                "best_for": "Business time series with strong seasonal patterns and multiple trends",
            },
        }
        model_description = model_descriptions.get(
            request.model_type,
            {
                "name": request.model_type.title(),
                "description": "Custom regression model.",
                "strengths": ["Flexible", "Configurable"],
                "best_for": "General forecasting",
            },
        )

        # Key drivers
        conf_interval_width = round(float(std) * 1.96 * 2, 2) if std > 0 else 0
        key_drivers = [
            f"Target column '{request.target_column}' shows a {round(abs_pct, 1)}% {trend_label.lower()} "
            f"over the {request.horizon_days}-day horizon",
            f"{model_description['name']} model achieved R²={round(r2, 3)} with MAE={round(mae, 2)}, "
            f"confidence interval width ≈ {conf_interval_width}",
            f"Historical data of {len(y)} observations drives the {trend_direction} projection at "
            f"a {confidence_score}% confidence score",
        ]

        # Richer explanation
        explanation = (
            f"{model_description['name']} projects a {trend_label.lower()} of "
            f"{round(abs_pct, 1)}% ({trend_direction}) over {request.horizon_days} days. "
            f"Model R²={round(r2, 3)}, MAE={round(mae, 2)}. "
            f"95% confidence interval width: ±{round(conf_interval_width / 2, 2)}. "
            f"Confidence score: {confidence_score}/100."
        )

        return {
            "id": db_forecast.id,
            "dataset_id": request.dataset_id,
            "target_column": request.target_column,
            "model_type": request.model_type,
            "horizon_days": request.horizon_days,
            "accuracy_score": db_forecast.accuracy_score,
            "r2_score": db_forecast.r2_score,
            "mae": db_forecast.mae,
            "historical_values": [round(float(v), 2) for v in y[-24:]],
            "forecast_points": forecast_points,
            # --- Enhanced fields ---
            "confidence_score": confidence_score,
            "trend_label": trend_label,
            "key_drivers": key_drivers,
            "explanation": explanation,
            "model_description": model_description,
            "summary": (
                f"Projected {request.target_column} for next {request.horizon_days} days: "
                f"{round(float(np.mean(future_preds)), 2)} average. "
                f"Model accuracy: {db_forecast.accuracy_score}%. Trend: {trend_label}."
            ),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_forecast_history(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Return all past forecast runs for the current user's datasets"""
    dataset_ids = db.query(Dataset.id).filter(Dataset.user_id == user.id).subquery()
    forecasts = (
        db.query(Forecast, Dataset.name)
        .join(Dataset, Forecast.dataset_id == Dataset.id)
        .filter(Forecast.dataset_id.in_(dataset_ids))
        .order_by(Forecast.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": f.id,
            "dataset_id": f.dataset_id,
            "dataset_name": name,
            "target_column": f.target_column,
            "model_type": f.model_type,
            "horizon_days": f.horizon_days,
            "accuracy_score": f.accuracy_score,
            "r2_score": f.r2_score,
            "mae": f.mae,
            "created_at": f.created_at.isoformat(),
        }
        for f, name in forecasts
    ]
