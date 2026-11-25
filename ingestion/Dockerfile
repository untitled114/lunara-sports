# ---------- build stage ----------
FROM python:3.12-slim AS builder

WORKDIR /app

COPY pyproject.toml constraints.txt ./
COPY src/ src/
RUN pip install --no-cache-dir -c constraints.txt .

# ---------- runtime stage ----------
FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY src/ src/

RUN adduser --disabled-password --gecos '' appuser && chown -R appuser:appuser /app
USER appuser

CMD ["python", "-m", "src"]
