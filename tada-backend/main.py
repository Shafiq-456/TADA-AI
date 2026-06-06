"""
TADA AI - FastAPI Backend
Main application entry point
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routes import auth, datasets, analytics, visualizations, forecasts, ai_analyst, reports, users, executive_insights


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    yield
    # Shutdown


app = FastAPI(
    title="TADA AI API",
    description="Autonomous Data Analyst & Business Intelligence Agent",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(datasets.router, prefix="/api/datasets", tags=["Datasets"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(visualizations.router, prefix="/api/visualizations", tags=["Visualizations"])
app.include_router(forecasts.router, prefix="/api/forecasts", tags=["Forecasts"])
app.include_router(ai_analyst.router, prefix="/api/ai", tags=["AI Analyst"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(executive_insights.router, prefix="/api/insights", tags=["Executive Insights"])


# Serve compiled frontend SPA static files
frontend_dist = "/Users/shafiq/Desktop/TADA/tada-ai/dist"
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/health")
    async def health():
        return {"status": "healthy"}

    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            from fastapi.responses import FileResponse
            return FileResponse(index_file)
        return {"detail": "Frontend index.html not found"}
else:
    @app.get("/")
    async def root():
        return {"message": "TADA AI API is running (frontend not built)", "version": "1.0.0"}

    @app.get("/health")
    async def health():
        return {"status": "healthy"}
