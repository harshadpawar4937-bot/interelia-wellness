"""Inventory-grounded RAG: symptom → in-stock products → pharmacist-style chat."""

from __future__ import annotations

import hashlib
import json
import logging
import math
import re
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

import httpx
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models import AIModelConfig, BlogPost, FAQ, KnowledgeChunk, Product
from app.services.serializers import product_to_out

logger = logging.getLogger(__name__)

# Symptom / need → search tokens (generics, brands, ingredients) for inventory matching.
SYMPTOM_LEXICON: Dict[str, List[str]] = {
    "fever": ["paracetamol", "acetaminophen", "dolo", "crocin", "calpol", "ibuprofen", "meftal", "nimesulide"],
    "temperature": ["paracetamol", "dolo", "crocin", "ibuprofen"],
    "pyrexia": ["paracetamol", "dolo", "crocin"],
    "headache": ["paracetamol", "ibuprofen", "aspirin", "saridon", "disprin", "dolo", "crocin"],
    "migraine": ["sumatriptan", "naproxen", "ibuprofen", "paracetamol"],
    "pain": ["paracetamol", "ibuprofen", "diclofenac", "aceclofenac", "tramadol", "dolo"],
    "body pain": ["paracetamol", "ibuprofen", "diclofenac", "dolo"],
    "backache": ["diclofenac", "aceclofenac", "ibuprofen", "paracetamol"],
    "toothache": ["ibuprofen", "paracetamol", "diclofenac"],
    "cold": ["cetirizine", "levocetirizine", "phenylephrine", "ambroxol", "vicks", "sinarest", "okacet"],
    "flu": ["paracetamol", "cetirizine", "phenylephrine", "oseltamivir"],
    "cough": ["dextromethorphan", "ambroxol", "bromhexine", "guaifenesin", "benadryl", "ascoryl", "corex"],
    "sore throat": ["benzydamine", "strepsils", "chlorhexidine", "paracetamol"],
    "allergy": ["cetirizine", "levocetirizine", "loratadine", "fexofenadine", "allegra", "okacet", "montair"],
    "sneezing": ["cetirizine", "levocetirizine", "loratadine"],
    "acidity": ["pantoprazole", "omeprazole", "rabeprazole", "ranitidine", "digene", "gelusil", "mucaine", "antacid"],
    "gas": ["simethicone", "digene", "gelusil", "charcoal"],
    "heartburn": ["pantoprazole", "omeprazole", "ranitidine", "digene", "antacid"],
    "constipation": ["lactulose", "ispaghula", "dulcolax", "cremaffin", "glycerin"],
    "diarrhea": ["loperamide", "racecadotril", "norflox", "enterogermina", "electral"],
    "diarrhoea": ["loperamide", "racecadotril", "norflox", "enterogermina", "electral"],
    "vomiting": ["ondansetron", "domperidone", "emset", "vomikind"],
    "nausea": ["ondansetron", "domperidone"],
    "diabetes": ["metformin", "glimepiride", "insulin", "glucometer", "sugar"],
    "sugar": ["metformin", "glucometer", "diabetes"],
    "bp": ["amlodipine", "telmisartan", "losartan", "omron", "blood pressure"],
    "blood pressure": ["amlodipine", "telmisartan", "losartan", "omron"],
    "immunity": ["vitamin c", "zinc", "multivitamin", "vitamin d", "cholecalciferol"],
    "vitamin": ["multivitamin", "vitamin c", "vitamin d", "b complex"],
    "sleep": ["melatonin", "zolfresh", "alprazolam"],
    "insomnia": ["melatonin", "zolfresh"],
    "hair": ["biotin", "minoxidil", "ketoconazole"],
    "skin": ["moisturizer", "cetaphil", "clotrimazole", "mupirocin"],
    "infection": ["amoxicillin", "azithromycin", "ciprofloxacin", "augmentin"],
    "antibiotic": ["amoxicillin", "azithromycin", "ciprofloxacin", "augmentin"],
    "wound": ["betadine", "povidone", "bandage", "mupirocin"],
    "mask": ["mask", "n95", "3 ply"],
    "sanitizer": ["sanitizer", "hand rub", "alcohol"],
}

# Drug / brand aliases → related terms (kept for reverse lookups).
DRUG_ALIASES: Dict[str, str] = {
    "paracetemol": "paracetamol dolo fever headache pain",
    "paracetamol": "paracetamol dolo crocin calpol fever headache pain",
    "dolo": "dolo paracetamol fever headache pain",
    "crocin": "crocin paracetamol fever headache",
    "tylenol": "paracetamol dolo fever",
    "ibuprofen": "ibuprofen brufen combiflam pain fever",
    "cetirizine": "cetirizine okacet allergy cold",
    "pantoprazole": "pantoprazole pan acidity heartburn",
    "vitamin c": "vitamin c zinc immunity",
    "immunity": "immunity vitamin c multivitamin zinc",
    "sleep": "melatonin sleep",
    "hair": "biotin hair",
    "bp": "blood pressure monitor omron",
    "sugar": "diabetes glucometer metformin",
}


def embed_text(text: str, dims: Optional[int] = None) -> List[float]:
    """Hash-based embedding — works offline; swap for OpenAI embeddings in production."""
    dims = dims or settings.embedding_dims
    vec = [0.0] * dims
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    if not tokens:
        return vec
    for tok in tokens:
        h = hashlib.sha256(tok.encode()).digest()
        for i in range(dims):
            vec[i] += (h[i % len(h)] - 128) / 128.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def cosine(a: List[float], b: List[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


STOPWORDS = {
    "the", "and", "for", "with", "have", "has", "had", "what", "which", "when", "where",
    "who", "how", "can", "could", "should", "would", "need", "help", "please", "from",
    "this", "that", "your", "our", "any", "some", "take", "taking", "medicine", "medicines",
    "product", "products", "suggest", "recommend", "best", "good", "give", "want", "like",
}


def expand_query(query: str) -> Tuple[str, List[str]]:
    """Return expanded query string and ordered search terms for inventory SQL."""
    q_raw = query.lower().strip()
    terms: List[str] = []
    parts = [q_raw]

    for symptom, tokens in SYMPTOM_LEXICON.items():
        if symptom in q_raw:
            parts.append(" ".join(tokens))
            terms.append(symptom)
            terms.extend(tokens)

    for key, val in DRUG_ALIASES.items():
        if key in q_raw:
            parts.append(val)
            terms.extend(re.findall(r"[a-z0-9]+", val))

    terms.extend(
        t
        for t in re.findall(r"[a-z0-9]+", q_raw)
        if len(t) > 3 and t not in STOPWORDS
    )

    seen: Set[str] = set()
    ordered: List[str] = []
    for t in terms:
        tl = t.lower().strip()
        # Skip tiny tokens ("eno", "ors") — they false-match Aveeno, etc.
        if tl in seen or tl in STOPWORDS or len(tl) < 4:
            continue
        seen.add(tl)
        ordered.append(tl)

    return " ".join(parts), ordered[:24]


def _useful_for_hints(name: str, ingredients: str, description: str) -> str:
    blob = f"{name} {ingredients} {description}".lower()
    matched: List[str] = []
    for symptom, tokens in SYMPTOM_LEXICON.items():
        if any(tok in blob for tok in tokens if len(tok) > 3):
            matched.append(symptom)
        if len(matched) >= 6:
            break
    return ", ".join(matched) if matched else ""


def rebuild_knowledge_index(db: Session) -> int:
    """Reindex products (enriched), blogs, FAQs into knowledge_chunks."""
    db.query(KnowledgeChunk).delete()
    count = 0

    products = (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.brand))
        .filter(Product.is_active.is_(True))
        .all()
    )
    for p in products:
        benefits = ""
        if p.benefits_json:
            try:
                benefits = ", ".join(json.loads(p.benefits_json))
            except json.JSONDecodeError:
                benefits = p.benefits_json
        availability = "in stock" if p.stock_qty > 0 else "out of stock"
        cat_name = p.category.name if p.category else ""
        cat_slug = p.category.slug if p.category else ""
        useful = _useful_for_hints(p.name or "", p.ingredients or "", p.description or "")
        body = (
            f"Product: {p.name}. Brand: {p.brand.name if p.brand else ''}. "
            f"Category: {cat_name} ({cat_slug}). "
            f"Price: INR {p.mrp if p.mrp and p.mrp > 0 else p.price}. Pack: {p.pack_size or ''}. "
            f"Description: {p.description or ''}. Benefits: {benefits}. "
            f"Ingredients: {p.ingredients or ''}. Usage: {p.usage_text or ''}. "
            f"Warnings: {p.warnings or ''}. "
            f"Requires prescription: {p.requires_prescription}. "
            f"Stock: {p.stock_qty}. Availability: {availability}."
        )
        if useful:
            body += f" Useful for: {useful}."
        emb = embed_text(body)
        db.add(
            KnowledgeChunk(
                source_type="product",
                source_id=str(p.id),
                source_slug=p.slug,
                title=p.name,
                content=body,
                embedding_json=json.dumps(emb),
                metadata_json=json.dumps(
                    {
                        "price": float(p.mrp if p.mrp and p.mrp > 0 else p.price),
                        "brand": p.brand.name if p.brand else None,
                        "stock_qty": p.stock_qty,
                        "requires_prescription": bool(p.requires_prescription),
                        "in_stock": p.stock_qty > 0,
                    }
                ),
            )
        )
        count += 1

    blogs = db.query(BlogPost).filter(BlogPost.is_published.is_(True)).all()
    for b in blogs:
        body = f"Article: {b.title}. Category: {b.category}. {b.excerpt or ''}\n{b.content}"
        emb = embed_text(body)
        db.add(
            KnowledgeChunk(
                source_type="blog",
                source_id=str(b.id),
                source_slug=b.slug,
                title=b.title,
                content=body[:4000],
                embedding_json=json.dumps(emb),
            )
        )
        count += 1

    for f in db.query(FAQ).all():
        body = f"FAQ: {f.question}\nAnswer: {f.answer}"
        emb = embed_text(body)
        db.add(
            KnowledgeChunk(
                source_type="faq",
                source_id=str(f.id),
                source_slug=None,
                title=f.question,
                content=body,
                embedding_json=json.dumps(emb),
            )
        )
        count += 1

    db.commit()
    logger.info("Knowledge index rebuilt: %s chunks", count)
    return count


def ensure_knowledge_index(db: Session) -> int:
    """Rebuild if empty (e.g. after stock import before admin reindex)."""
    n = db.query(KnowledgeChunk).count()
    if n == 0:
        logger.info("Knowledge index empty — auto-reindexing")
        return rebuild_knowledge_index(db)
    return n


def _product_match_score(p: Product, terms: Sequence[str]) -> float:
    blob = f"{p.name or ''} {p.ingredients or ''} {p.description or ''} {p.usage_text or ''}".lower()
    hits = 0.0
    for t in terms:
        if t in blob:
            # Stronger weight for name / ingredients
            if t in (p.name or "").lower():
                hits += 2.0
            elif t in (p.ingredients or "").lower():
                hits += 1.5
            else:
                hits += 1.0
    if not hits:
        return 0.0
    # Prefer OTC
    rx_penalty = 0.15 if p.requires_prescription else 0.0
    return hits - rx_penalty


def search_inventory_products(db: Session, terms: Sequence[str], limit: int = 12) -> List[Product]:
    """Direct inventory search — critical when imported rows have thin descriptions."""
    if not terms:
        return []
    filters = []
    for t in terms[:16]:
        like = f"%{t}%"
        filters.append(Product.name.ilike(like))
        filters.append(Product.ingredients.ilike(like))
        filters.append(Product.description.ilike(like))
    rows = (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.brand))
        .filter(
            Product.is_active.is_(True),
            Product.stock_qty > 0,
            or_(*filters),
        )
        .limit(80)
        .all()
    )
    scored = [( _product_match_score(p, terms), p) for p in rows]
    scored = [(s, p) for s, p in scored if s > 0]
    scored.sort(key=lambda x: (-x[0], x[1].requires_prescription, -float(x[1].rating or 0)))
    return [p for _, p in scored[:limit]]


def _chunk_from_product(p: Product) -> KnowledgeChunk:
    """Ephemeral chunk object for products found via SQL but missing from index."""
    useful = _useful_for_hints(p.name or "", p.ingredients or "", p.description or "")
    body = (
        f"Product: {p.name}. Brand: {p.brand.name if p.brand else ''}. "
        f"Category: {p.category.name if p.category else ''}. "
        f"Price: INR {p.mrp if p.mrp and p.mrp > 0 else p.price}. Pack: {p.pack_size or ''}. "
        f"Description: {p.description or ''}. Ingredients: {p.ingredients or ''}. "
        f"Usage: {p.usage_text or ''}. Warnings: {p.warnings or ''}. "
        f"Requires prescription: {p.requires_prescription}. "
        f"Stock: {p.stock_qty}. Availability: in stock."
    )
    if useful:
        body += f" Useful for: {useful}."
    return KnowledgeChunk(
        id=0,
        source_type="product",
        source_id=str(p.id),
        source_slug=p.slug,
        title=p.name,
        content=body,
        embedding_json=None,
        metadata_json=json.dumps(
            {
                "price": float(p.mrp if p.mrp and p.mrp > 0 else p.price),
                "stock_qty": p.stock_qty,
                "requires_prescription": bool(p.requires_prescription),
                "in_stock": True,
            }
        ),
    )


def retrieve(db: Session, query: str, k: int = 8) -> Tuple[List[KnowledgeChunk], List[Product]]:
    """
    Hybrid retrieval: symptom expansion + inventory SQL + product knowledge chunks.
    Returns (chunks for LLM context, matched in-stock Product rows).
    """
    ensure_knowledge_index(db)
    q_expanded, terms = expand_query(query)
    products = search_inventory_products(db, terms, limit=k)

    # Pull indexed chunks for matched products
    product_ids = [str(p.id) for p in products]
    chunk_by_pid: Dict[str, KnowledgeChunk] = {}
    if product_ids:
        for c in (
            db.query(KnowledgeChunk)
            .filter(KnowledgeChunk.source_type == "product", KnowledgeChunk.source_id.in_(product_ids))
            .all()
        ):
            chunk_by_pid[c.source_id] = c

    chunks: List[KnowledgeChunk] = []
    for p in products:
        c = chunk_by_pid.get(str(p.id))
        chunks.append(c if c is not None else _chunk_from_product(p))

    # If SQL found little, fall back to keyword score on product chunks only (capped)
    if len(chunks) < 3 and terms:
        q_emb = embed_text(q_expanded)
        token_set = set(terms)
        # Prefer LIKE filter on title to avoid loading entire 33k table when possible
        like_filters = [KnowledgeChunk.title.ilike(f"%{t}%") for t in terms[:8]]
        like_filters += [KnowledgeChunk.content.ilike(f"%{t}%") for t in terms[:6]]
        candidates = (
            db.query(KnowledgeChunk)
            .filter(KnowledgeChunk.source_type == "product", or_(*like_filters))
            .limit(100)
            .all()
        )
        scored: List[Tuple[float, KnowledgeChunk]] = []
        seen_ids = {c.source_id for c in chunks}
        for c in candidates:
            if c.source_id in seen_ids:
                continue
            meta = {}
            if c.metadata_json:
                try:
                    meta = json.loads(c.metadata_json)
                except json.JSONDecodeError:
                    meta = {}
            if meta.get("in_stock") is False:
                continue
            text = f"{c.title or ''} {c.content}".lower()
            emb_score = 0.0
            if c.embedding_json:
                try:
                    emb = json.loads(c.embedding_json)
                    emb_score = cosine(q_emb, emb)
                except json.JSONDecodeError:
                    emb_score = 0.0
            kw_hits = sum(1 for t in token_set if t in text)
            kw_score = min(kw_hits / max(len(token_set), 1), 1.0)
            score = 0.4 * emb_score + 0.6 * kw_score
            if score > 0.05:
                scored.append((score, c))
        scored.sort(key=lambda x: x[0], reverse=True)
        for _, c in scored:
            if len(chunks) >= k:
                break
            chunks.append(c)
            seen_ids.add(c.source_id)
            # Resolve Product for response cards
            if c.source_id and c.source_id.isdigit():
                p = (
                    db.query(Product)
                    .options(joinedload(Product.category), joinedload(Product.brand))
                    .filter(
                        Product.id == int(c.source_id),
                        Product.is_active.is_(True),
                        Product.stock_qty > 0,
                    )
                    .first()
                )
                if p and all(x.id != p.id for x in products):
                    products.append(p)

    return chunks[:k], products[:k]


SYSTEM_PROMPT = """You are the Interelia Wellness pharmacist assistant (Healthcare Commerce Division of Interelia).

Your job: help customers choose the best-fitting medicines and related products from OUR INVENTORY CONTEXT ONLY.

Rules:
1. Use ONLY products listed in the Context. Never invent product names, prices, stock, or ingredients.
2. Think like a careful pharmacist: clarify the need briefly, then recommend 1–3 best in-stock options ranked by fit.
3. Prefer OTC / non-prescription products when suitable. If a product Requires prescription: true, label it clearly as "Prescription required — upload Rx for pharmacist review" and do not instruct dosing as if OTC.
4. For each recommendation: product name, why it fits (ingredient/use from context), and any usage/warning text already in context.
5. Add short red-flag guidance (when to see a doctor / ER) for symptoms like high fever lasting >3 days, chest pain, severe dehydration, etc.
6. Never claim to diagnose disease or replace a licensed doctor. End with: educational guidance only, not medical advice.
7. If Context is empty or weak, say you could not find matching in-stock items and ask a clarifying question (age group, symptom details) or suggest uploading a prescription.
8. Reply in clear, concise English suitable for Indian pharmacy customers."""


def rule_based_reply(query: str, chunks: List[KnowledgeChunk], products: Optional[List[Product]] = None) -> str:
    products = products or []
    if not chunks and not products:
        return (
            "I could not find matching in-stock medicines in the Interelia Wellness inventory for that. "
            "Try naming a medicine (e.g. paracetamol), a symptom (fever, acidity, cough), or upload a prescription "
            "for pharmacist review. Educational guidance only — not medical advice."
        )

    lines = [
        "Based on in-stock items in the Interelia Wellness inventory, here are suitable options:",
        "",
    ]
    # Prefer OTC first in listing
    ordered = sorted(products, key=lambda p: (p.requires_prescription, -float(p.rating or 0)))[:5]
    if ordered:
        for i, p in enumerate(ordered, 1):
            rx = " [Prescription required]" if p.requires_prescription else " [OTC]"
            why = (p.ingredients or p.description or p.pack_size or "See product details")[:120]
            unit = p.mrp if p.mrp and p.mrp > 0 else p.price
            lines.append(f"{i}. {p.name}{rx} — ₹{unit} · {why}")
            lines.append(f"   → /product/{p.slug}")
    else:
        for c in chunks[:3]:
            if c.source_type != "product":
                continue
            snippet = c.content[:220].replace("\n", " ")
            lines.append(f"• {c.title}: {snippet}…")
            if c.source_slug:
                lines.append(f"  → /product/{c.source_slug}")

    lines.append("")
    lines.append(
        "Prefer the top OTC option unless a clinician has advised otherwise. "
        "Seek medical care for severe, worsening, or prolonged symptoms."
    )
    lines.append("Educational guidance only — not a substitute for professional medical advice.")
    return "\n".join(lines)


async def generate_chat_reply(db: Session, message: str) -> Dict[str, Any]:
    chunks, products = retrieve(db, message, k=8)

    # Context: inventory products only for recommendations
    product_chunks = [c for c in chunks if c.source_type == "product"]
    context_parts = []
    for c in product_chunks[:8]:
        context_parts.append(f"[product id={c.source_id}] {c.title}\n{c.content[:1400]}")
    context = "\n\n".join(context_parts) if context_parts else "(No matching in-stock products found.)"

    citations = [
        {"type": c.source_type, "slug": c.source_slug, "title": c.title, "id": c.source_id}
        for c in product_chunks
        if c.source_slug or c.title
    ]
    product_payload = [product_to_out(p) for p in products[:8]]

    cfg = db.query(AIModelConfig).first()
    model = (
        settings.fine_tuned_model_id
        or (cfg.fine_tuned_model_id if cfg else None)
        or settings.openai_chat_model
    )

    if settings.openai_api_key and product_chunks:
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                resp = await client.post(
                    f"{settings.openai_base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {
                                "role": "user",
                                "content": (
                                    f"Inventory context (in-stock Interelia products only):\n{context}\n\n"
                                    f"Customer need: {message}\n\n"
                                    "Recommend the best options from this inventory."
                                ),
                            },
                        ],
                        "temperature": 0.25,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                reply = data["choices"][0]["message"]["content"]
                return {
                    "reply": reply,
                    "citations": citations,
                    "products": product_payload,
                    "model": model,
                    "mode": "llm+rag",
                    "disclaimer": "Educational guidance only. Not a substitute for professional medical advice.",
                }
        except Exception as exc:  # noqa: BLE001
            logger.warning("LLM chat failed: %s", exc)
            fallback = rule_based_reply(message, product_chunks, products)
            return {
                "reply": fallback + f"\n\n(LLM unavailable: {exc.__class__.__name__})",
                "citations": citations,
                "products": product_payload,
                "model": "rule-based",
                "mode": "rag-fallback",
                "disclaimer": "Educational guidance only. Not a substitute for professional medical advice.",
            }

    return {
        "reply": rule_based_reply(message, product_chunks, products),
        "citations": citations,
        "products": product_payload,
        "model": "rule-based" if not settings.openai_api_key else model,
        "mode": "rag" if product_chunks else "no-match",
        "disclaimer": "Educational guidance only. Not a substitute for professional medical advice.",
    }
