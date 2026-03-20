# Docker runtime for Python scanners + AI 30 Days tools
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /work

# System deps (certs for HTTPS)
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install Python deps for AI30 scripts
COPY scanners/requirements-ai30.txt /opt/requirements-ai30.txt
RUN pip install --no-cache-dir -r /opt/requirements-ai30.txt

# Default command (overridden by docker run args)
CMD ["python", "scanners/scanner.py", "--help"]
