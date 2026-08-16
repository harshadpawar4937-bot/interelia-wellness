"""Submit OpenAI fine-tune job from exported Interelia JSONL (optional OPENAI_API_KEY)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import settings  # noqa: E402
from app.db.session import SessionLocal, init_db  # noqa: E402
from app.models import AIModelConfig  # noqa: E402


def main() -> None:
    dataset = ROOT / "data" / "interelia_finetune.jsonl"
    if not dataset.exists():
        print("Run export_finetune_dataset.py first.")
        sys.exit(1)

    if not settings.openai_api_key:
        # Offline stub: mark status and print instructions
        init_db()
        db = SessionLocal()
        cfg = db.query(AIModelConfig).first()
        if not cfg:
            cfg = AIModelConfig()
            db.add(cfg)
        cfg.last_train_status = "dataset_ready_no_api_key"
        cfg.last_train_job_id = None
        db.commit()
        db.close()
        print("OPENAI_API_KEY not set.")
        print(f"Dataset ready at {dataset}")
        print("Set OPENAI_API_KEY then re-run to upload & fine-tune.")
        print("Or set FINE_TUNED_MODEL_ID / use Admin → AI → Set model after training elsewhere.")
        return

    import httpx

    print("Uploading training file…")
    with httpx.Client(timeout=120.0) as client:
        with dataset.open("rb") as fh:
            up = client.post(
                f"{settings.openai_base_url}/files",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                files={"file": ("interelia_finetune.jsonl", fh, "application/jsonl")},
                data={"purpose": "fine-tune"},
            )
        up.raise_for_status()
        file_id = up.json()["id"]
        job = client.post(
            f"{settings.openai_base_url}/fine_tuning/jobs",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={"training_file": file_id, "model": settings.openai_chat_model},
        )
        job.raise_for_status()
        payload = job.json()
        job_id = payload["id"]
        print(json.dumps(payload, indent=2))

    init_db()
    db = SessionLocal()
    cfg = db.query(AIModelConfig).first()
    if not cfg:
        cfg = AIModelConfig()
        db.add(cfg)
    cfg.last_train_job_id = job_id
    cfg.last_train_status = payload.get("status", "queued")
    db.commit()
    db.close()
    print(f"Fine-tune job started: {job_id}")
    print("When complete, set the resulting model id in Admin → AI Knowledge.")


if __name__ == "__main__":
    main()
