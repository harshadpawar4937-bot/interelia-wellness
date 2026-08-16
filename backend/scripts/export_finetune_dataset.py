"""Export fine-tune JSONL from live catalog for Interelia product training."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db.session import SessionLocal, init_db  # noqa: E402
from app.models import BlogPost, FAQ, Product  # noqa: E402
from app.services.rag import SYMPTOM_LEXICON, search_inventory_products  # noqa: E402
from sqlalchemy.orm import joinedload  # noqa: E402


SYSTEM = (
    "You are Interelia Wellness pharmacist assistant. "
    "Recommend only from the provided Interelia inventory. Prefer OTC when suitable. "
    "Label prescription products clearly. Educational only — not medical advice."
)


def main() -> None:
    init_db()
    db = SessionLocal()
    out_path = ROOT / "data" / "interelia_finetune.jsonl"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    rows = []

    products = (
        db.query(Product)
        .options(joinedload(Product.brand), joinedload(Product.category))
        .filter(Product.is_active.is_(True))
        .all()
    )
    for p in products:
        facts = (
            f"{p.name} by {p.brand.name if p.brand else 'Interelia'}: "
            f"{p.description or ''} Pack: {p.pack_size}. Price INR {p.price}. "
            f"Ingredients: {p.ingredients or 'See label'}. "
            f"Usage: {p.usage_text or 'As directed'}. Warnings: {p.warnings or 'See label'}. "
            f"{'Prescription required.' if p.requires_prescription else 'OTC.'}"
        )
        rows.append(
            {
                "messages": [
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": f"Tell me about {p.name}"},
                    {
                        "role": "assistant",
                        "content": facts + " Available on Interelia Wellness. Educational guidance only.",
                    },
                ]
            }
        )
        rows.append(
            {
                "messages": [
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": f"How should I use {p.name}?"},
                    {
                        "role": "assistant",
                        "content": (p.usage_text or "Follow the pack directions or ask a healthcare professional.")
                        + " This is educational guidance only.",
                    },
                ]
            }
        )

    # Symptom → inventory recommendation pairs (train on our medicines only)
    for symptom, terms in SYMPTOM_LEXICON.items():
        matches = search_inventory_products(db, terms, limit=5)
        if not matches:
            continue
        lines = []
        for i, p in enumerate(matches, 1):
            rx = "Prescription required" if p.requires_prescription else "OTC"
            lines.append(
                f"{i}. {p.name} ({rx}) — ingredients: {p.ingredients or 'see label'}; "
                f"price INR {p.price}; stock {p.stock_qty}."
            )
        answer = (
            f"For {symptom}, these in-stock Interelia Wellness options fit best based on our inventory:\n"
            + "\n".join(lines)
            + "\nPrefer OTC unless a clinician advised otherwise. "
            "Seek medical care for severe or prolonged symptoms. Educational guidance only."
        )
        rows.append(
            {
                "messages": [
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": f"I have {symptom}. What medicine should I take?"},
                    {"role": "assistant", "content": answer},
                ]
            }
        )
        rows.append(
            {
                "messages": [
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": f"Suggest products for {symptom}"},
                    {"role": "assistant", "content": answer},
                ]
            }
        )

    for b in db.query(BlogPost).filter(BlogPost.is_published.is_(True)).all():
        rows.append(
            {
                "messages": [
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": f"Summarize: {b.title}"},
                    {
                        "role": "assistant",
                        "content": (b.excerpt or b.content[:400]) + " Read more in Interelia Health Hub.",
                    },
                ]
            }
        )

    for f in db.query(FAQ).all():
        rows.append(
            {
                "messages": [
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": f.question},
                    {"role": "assistant", "content": f.answer},
                ]
            }
        )

    with out_path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"Wrote {len(rows)} examples → {out_path}")
    db.close()


if __name__ == "__main__":
    main()
