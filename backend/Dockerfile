FROM python:3.11.9-slim

WORKDIR /app

# Install build deps (needed for some packages on slim image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Render injects $PORT at runtime
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
