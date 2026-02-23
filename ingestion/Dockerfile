# ---------- build stage ----------
FROM python:3.12-slim AS builder

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir .

# ---------- runtime stage ----------
FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY src/ src/

CMD ["python", "-m", "src"]
