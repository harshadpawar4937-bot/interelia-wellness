"""Interelia Wellness — FastAPI application entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import engine, init_db

logging.basicConfig(
    level=logging.INFO if settings.environment != "development" else logging.DEBUG,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("interelia")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    init_db()
    try:
        from app.db.session import SessionLocal
        from app.models import KnowledgeChunk
        from app.services.rag import rebuild_knowledge_index

        db = SessionLocal()
        try:
            if db.query(KnowledgeChunk).count() == 0:
                n = rebuild_knowledge_index(db)
                logger.info("Auto-rebuilt empty knowledge index: %s chunks", n)
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Knowledge index bootstrap skipped: %s", exc)
    logger.info("API started environment=%s", settings.environment)
    yield


docs_url = "/api/docs" if settings.enable_api_docs and settings.environment != "production" else None
redoc_url = "/api/redoc" if docs_url else None

app = FastAPI(
    title="Interelia Wellness API",
    description="Enterprise healthcare commerce API — pharmacy, wellness, prescriptions, AI.",
    version="1.0.0",
    docs_url=docs_url,
    redoc_url=redoc_url,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

upload_root = Path(settings.upload_dir)
upload_root.mkdir(parents=True, exist_ok=True)

app.include_router(api_router, prefix="/api/v1")

# Legacy URL shape used in older prescription rows (/uploads/...) — same auth rules.
from app.api.v1.uploads import serve_upload  # noqa: E402

app.add_api_route("/uploads/{file_path:path}", serve_upload, methods=["GET"], tags=["Uploads"])


@app.get("/health")
def health_check():
    db_ok = False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db_ok = True
    except Exception as exc:  # noqa: BLE001
        logger.warning("Health DB check failed: %s", exc)
    status = "ok" if db_ok else "degraded"
    code = 200 if db_ok else 503
    return JSONResponse(
        status_code=code,
        content={
            "status": status,
            "service": "interelia-pharmacy-api",
            "environment": settings.environment,
            "database": "up" if db_ok else "down",
        },
    )
