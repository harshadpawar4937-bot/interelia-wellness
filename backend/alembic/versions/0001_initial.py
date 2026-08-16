"""initial schema from ORM metadata

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-07

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all tables from SQLAlchemy models (idempotent for fresh DBs)."""
    from app.db.session import Base
    import app.models  # noqa: F401

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)

    # Additive columns for DBs created before these fields existed
    inspector = sa.inspect(bind)
    if "orders" in inspector.get_table_names():
        cols = {c["name"] for c in inspector.get_columns("orders")}
        if "payment_method" not in cols:
            op.add_column(
                "orders",
                sa.Column("payment_method", sa.String(length=32), server_default="cod"),
            )
        if "prescription_id" not in cols:
            op.add_column("orders", sa.Column("prescription_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    from app.db.session import Base
    import app.models  # noqa: F401

    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
