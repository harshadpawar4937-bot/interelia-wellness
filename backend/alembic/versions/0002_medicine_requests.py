"""medicine requests and user notifications

Revision ID: 0002_medicine_requests
Revises: 0001_initial
Create Date: 2026-08-15

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_medicine_requests"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "medicine_requests" not in tables:
        op.create_table(
            "medicine_requests",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("request_number", sa.String(length=32), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="submitted"),
            sa.Column("customer_notes", sa.Text(), nullable=True),
            sa.Column("admin_notes", sa.Text(), nullable=True),
            sa.Column("rejection_reason", sa.Text(), nullable=True),
            sa.Column("fulfillment_method", sa.String(length=32), nullable=True),
            sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=True),
            sa.Column("reviewed_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("available_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_medicine_requests_request_number", "medicine_requests", ["request_number"], unique=True)
        op.create_index("ix_medicine_requests_user_id", "medicine_requests", ["user_id"])
        op.create_index("ix_medicine_requests_status", "medicine_requests", ["status"])

    if "medicine_request_items" not in tables:
        op.create_table(
            "medicine_request_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("request_id", sa.Integer(), sa.ForeignKey("medicine_requests.id"), nullable=False),
            sa.Column("medicine_name", sa.String(length=255), nullable=False),
            sa.Column("brand_or_company", sa.String(length=255), nullable=True),
            sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("pack_or_strength", sa.String(length=255), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("matched_product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=True),
            sa.Column("unit_price_snapshot", sa.Numeric(10, 2), nullable=True),
        )
        op.create_index("ix_medicine_request_items_request_id", "medicine_request_items", ["request_id"])

    if "user_notifications" not in tables:
        op.create_table(
            "user_notifications",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("notification_type", sa.String(length=64), nullable=False, server_default="general"),
            sa.Column("link_url", sa.String(length=500), nullable=True),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_user_notifications_user_id", "user_notifications", ["user_id"])
        op.create_index("ix_user_notifications_notification_type", "user_notifications", ["notification_type"])


def downgrade() -> None:
    op.drop_table("user_notifications")
    op.drop_table("medicine_request_items")
    op.drop_table("medicine_requests")
