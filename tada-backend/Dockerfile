# Production Dockerfile for TADA AI FastAPI Backend
FROM python:3.10-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies (needed for compiling certain C extensions like prophet/pystan if wheels aren't available)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend codebase
COPY . .

# Expose port
EXPOSE 8000

# Start server
CMD uvicorn main:app --host 0.0.0.0 --port 8000
