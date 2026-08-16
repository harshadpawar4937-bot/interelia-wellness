"""ORM models for Interelia Wellness."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    users: Mapped[List["User"]] = relationship(back_populates="role")
    permissions: Mapped[List["Permission"]] = relationship(
        secondary="role_permissions", back_populates="roles"
    )


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    roles: Mapped[List[Role]] = relationship(
        secondary="role_permissions", back_populates="permissions"
    )


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id"),)

    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), primary_key=True)
    permission_id: Mapped[int] = mapped_column(ForeignKey("permissions.id"), primary_key=True)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), index=True, nullable=True)
    full_name: Mapped[str] = mapped_column(String(150))
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    rewards_points: Mapped[int] = mapped_column(Integer, default=0)
    role: Mapped[Role] = relationship(back_populates="users")


class Category(Base, TimestampMixin):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    products: Mapped[List["Product"]] = relationship(back_populates="category")


class Brand(Base, TimestampMixin):
    __tablename__ = "brands"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, default="")
    tagline: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    cover_image_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_partner: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    website_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    products: Mapped[List["Product"]] = relationship(back_populates="brand")


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sku: Mapped[Optional[str]] = mapped_column(String(120), unique=True, index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))  # PTR / selling
    mrp: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    stock_qty: Mapped[int] = mapped_column(Integer, default=0)  # Current Stock
    current_strip_qty: Mapped[int] = mapped_column(Integer, default=0)
    current_loose_qty: Mapped[int] = mapped_column(Integer, default=0)
    b2c_strip_qty: Mapped[int] = mapped_column(Integer, default=0)
    b2c_loose_qty: Mapped[int] = mapped_column(Integer, default=0)
    b2c_sale_qty: Mapped[int] = mapped_column(Integer, default=0)
    b2b_sale_qty: Mapped[int] = mapped_column(Integer, default=0)
    stk_transfer_qty: Mapped[int] = mapped_column(Integer, default=0)
    total_strip_qty: Mapped[int] = mapped_column(Integer, default=0)
    total_loose_qty: Mapped[int] = mapped_column(Integer, default=0)
    total_sale_qty: Mapped[int] = mapped_column(Integer, default=0)
    purchase_qty: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    purchase_margin_pct: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=Decimal("0"))
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=20)
    requires_prescription: Mapped[bool] = mapped_column(Boolean, default=False)
    pack_size: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Packaging
    rack: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    supplier_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ingredients: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    usage_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    warnings: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    storage_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    benefits_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("0"))
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    meta_title: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    meta_description: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    category: Mapped[Category] = relationship(back_populates="products")
    brand: Mapped[Brand] = relationship(back_populates="products")


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    delivery_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    discount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    payment_status: Mapped[str] = mapped_column(String(32), default="pending")
    payment_method: Mapped[str] = mapped_column(String(32), default="cod")
    shipping_address_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prescription_id: Mapped[Optional[int]] = mapped_column(ForeignKey("prescriptions.id"), nullable=True)
    distance_km: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    delivery_eta_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    items: Mapped[List["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    order: Mapped[Order] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()


class Prescription(Base, TimestampMixin):
    __tablename__ = "prescriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    file_url: Mapped[str] = mapped_column(String(500))
    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="uploaded", index=True)
    ocr_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extracted_medicines: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class BlogPost(Base, TimestampMixin):
    __tablename__ = "blog_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    excerpt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content: Mapped[str] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tags_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    author_name: Mapped[str] = mapped_column(String(150))
    author_role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reading_time: Mapped[int] = mapped_column(Integer, default=5)
    image_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    meta_title: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    meta_description: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)


class FAQ(Base):
    __tablename__ = "faqs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    question: Mapped[str] = mapped_column(String(500))
    answer: Mapped[str] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Expert(Base, TimestampMixin):
    """Healthcare specialists shown on Expert Corner (CMS-managed)."""

    __tablename__ = "experts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(120))
    specialty: Mapped[str] = mapped_column(String(160))
    quote: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    whatsapp: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    clinic_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    pincode: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    maps_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    availability_text: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    accepting_calls: Mapped[bool] = mapped_column(Boolean, default=True)
    accepting_visits: Mapped[bool] = mapped_column(Boolean, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, index=True)


class SupportTicket(Base, TimestampMixin):
    __tablename__ = "support_tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    channel: Mapped[str] = mapped_column(String(32), default="web")
    subject: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="open")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100))
    entity: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class KnowledgeChunk(Base, TimestampMixin):
    __tablename__ = "knowledge_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_type: Mapped[str] = mapped_column(String(32), index=True)
    source_id: Mapped[str] = mapped_column(String(64), index=True)
    source_slug: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text)
    embedding_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class AIModelConfig(Base):
    __tablename__ = "ai_model_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fine_tuned_model_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    base_model: Mapped[str] = mapped_column(String(100), default="gpt-4o-mini")
    last_train_job_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_train_status: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CrmCustomer(Base, TimestampMixin):
    """Marketing/CRM customers — separate from staff Users. Maps CUSTOMER_REPORT columns."""

    __tablename__ = "crm_customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(120), unique=True, index=True, nullable=True)  # Customer No.
    full_name: Mapped[str] = mapped_column(String(150), index=True)  # Name
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(32), index=True, nullable=True)  # Contact No
    company: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=Decimal("0"))
    profile_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    doctor_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    family_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    payment_mode: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    vouchers: Mapped[int] = mapped_column(Integer, default=0)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    pincode: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    bills_count: Mapped[int] = mapped_column(Integer, default=0)  # No. of Bills
    last_billed_on: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    net_total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    total_due_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    tags: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="manual", index=True)
    marketing_opt_in: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    last_notified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class CustomerNotification(Base, TimestampMixin):
    __tablename__ = "customer_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    notification_type: Mapped[str] = mapped_column(String(32), default="general")  # offer|general|alert
    audience: Mapped[str] = mapped_column(String(32), default="all")  # all|selected|opted_in
    status: Mapped[str] = mapped_column(String(32), default="sent")  # draft|sent
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    recipient_count: Mapped[int] = mapped_column(Integer, default=0)


class NotificationRecipient(Base):
    __tablename__ = "notification_recipients"
    __table_args__ = (UniqueConstraint("notification_id", "customer_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    notification_id: Mapped[int] = mapped_column(ForeignKey("customer_notifications.id"), index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("crm_customers.id"), index=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class AdBanner(Base, TimestampMixin):
    """Homepage / campaign promo & offer banners."""

    __tablename__ = "ad_banners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    alt_text: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    image_url: Mapped[str] = mapped_column(String(1000))
    link_url: Mapped[str] = mapped_column(String(1000), default="/shop")
    cta_label: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    placement: Mapped[str] = mapped_column(String(64), default="home_promo", index=True)
    banner_kind: Mapped[str] = mapped_column(String(32), default="promo")  # promo|offer
    target_type: Mapped[str] = mapped_column(String(32), default="url")  # product|category|url|brand
    product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("products.id"), nullable=True)
    category_slug: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    brand_slug: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    badge_text: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    product: Mapped[Optional["Product"]] = relationship()


class SocialReel(Base, TimestampMixin):
    """Instagram Reels / UGC cards for As Seen On carousel."""

    __tablename__ = "social_reels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instagram_handle: Mapped[str] = mapped_column(String(100), index=True)
    permalink: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    display_mode: Mapped[str] = mapped_column(String(32), default="instagram_embed")  # local_video|instagram_embed
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    video_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("products.id"), nullable=True)
    external_media_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True, index=True)
    source: Mapped[str] = mapped_column(String(32), default="manual", index=True)  # manual|instagram_sync
    sort_order: Mapped[int] = mapped_column(Integer, default=0, index=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)

    product: Mapped[Optional["Product"]] = relationship()


class MerchRail(Base, TimestampMixin):
    """Homepage merchandising rails — Latest / Trending."""

    __tablename__ = "merch_rails"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # latest|trending
    title: Mapped[str] = mapped_column(String(200))
    subtitle: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    source_mode: Mapped[str] = mapped_column(String(32), default="auto")  # auto|manual
    limit: Mapped[int] = mapped_column(Integer, default=8)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    items: Mapped[List["MerchRailItem"]] = relationship(
        back_populates="rail", cascade="all, delete-orphan", order_by="MerchRailItem.sort_order"
    )


class MerchRailItem(Base):
    __tablename__ = "merch_rail_items"
    __table_args__ = (UniqueConstraint("rail_id", "product_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    rail_id: Mapped[int] = mapped_column(ForeignKey("merch_rails.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    rail: Mapped["MerchRail"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()


class InstagramAccountConfig(Base, TimestampMixin):
    """Configured Instagram Business/Creator accounts for Graph sync."""

    __tablename__ = "instagram_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    handle: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    ig_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class MedicineRequest(Base, TimestampMixin):
    """Customer requirement list for unavailable brand/company medicines."""

    __tablename__ = "medicine_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="submitted", index=True)
    # submitted|accepted|rejected|available|awaiting_pickup|ordered|completed|cancelled
    customer_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fulfillment_method: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # pickup|delivery
    order_id: Mapped[Optional[int]] = mapped_column(ForeignKey("orders.id"), nullable=True)
    reviewed_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    available_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[List["MedicineRequestItem"]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )
    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    order: Mapped[Optional["Order"]] = relationship(foreign_keys=[order_id])


class MedicineRequestItem(Base):
    __tablename__ = "medicine_request_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("medicine_requests.id"), index=True)
    medicine_name: Mapped[str] = mapped_column(String(255))
    brand_or_company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    pack_or_strength: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    matched_product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("products.id"), nullable=True)
    unit_price_snapshot: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)

    request: Mapped["MedicineRequest"] = relationship(back_populates="items")
    matched_product: Mapped[Optional["Product"]] = relationship()


class UserNotification(Base, TimestampMixin):
    """In-app customer notification inbox."""

    __tablename__ = "user_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    notification_type: Mapped[str] = mapped_column(String(64), default="general", index=True)
    link_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
