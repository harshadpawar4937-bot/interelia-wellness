"""Pydantic schemas."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    full_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    phone: Optional[str] = None


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    rewards_points: int
    role: str
    is_active: bool = True

    model_config = {"from_attributes": True}


class ProductOut(BaseModel):
    id: int
    sku: Optional[str] = None
    name: str
    slug: str
    description: Optional[str] = None
    price: Decimal
    mrp: Decimal
    stock_qty: int
    current_strip_qty: int = 0
    current_loose_qty: int = 0
    b2c_strip_qty: int = 0
    b2c_loose_qty: int = 0
    b2c_sale_qty: int = 0
    b2b_sale_qty: int = 0
    stk_transfer_qty: int = 0
    total_strip_qty: int = 0
    total_loose_qty: int = 0
    total_sale_qty: int = 0
    purchase_qty: Optional[str] = None
    purchase_margin_pct: Decimal = Decimal("0")
    requires_prescription: bool
    pack_size: Optional[str] = None
    rack: Optional[str] = None
    supplier_name: Optional[str] = None
    ingredients: Optional[str] = None
    usage_text: Optional[str] = None
    warnings: Optional[str] = None
    storage_text: Optional[str] = None
    benefits: List[str] = []
    image_url: Optional[str] = None
    rating: Decimal = Decimal("0")
    review_count: int = 0
    category: Optional[str] = None
    brand: Optional[str] = None
    brand_slug: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    is_active: bool = True
    in_stock: bool = True

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    price: Decimal
    mrp: Decimal
    stock_qty: int = 0
    requires_prescription: bool = False
    pack_size: Optional[str] = None
    ingredients: Optional[str] = None
    usage_text: Optional[str] = None
    warnings: Optional[str] = None
    storage_text: Optional[str] = None
    benefits: List[str] = []
    image_url: Optional[str] = None
    category_slug: str
    brand_name: str
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    is_active: bool = True


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    stock_qty: Optional[int] = None
    requires_prescription: Optional[bool] = None
    pack_size: Optional[str] = None
    ingredients: Optional[str] = None
    usage_text: Optional[str] = None
    warnings: Optional[str] = None
    storage_text: Optional[str] = None
    benefits: Optional[List[str]] = None
    image_url: Optional[str] = None
    category_slug: Optional[str] = None
    brand_name: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    is_active: Optional[bool] = None


class ProductListResponse(BaseModel):
    items: List[ProductOut]
    total: int
    page: int
    page_size: int


class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    product_count: int = 0


class BrandOut(BaseModel):
    id: int
    name: str
    slug: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_featured: bool = False
    sort_order: int = 0
    is_partner: bool = True
    is_active: bool = True
    website_url: Optional[str] = None
    product_count: int = 0

    model_config = {"from_attributes": True}


class BrandCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_featured: bool = False
    sort_order: int = 0
    is_partner: bool = True
    is_active: bool = True
    website_url: Optional[str] = None


class BrandUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_featured: Optional[bool] = None
    sort_order: Optional[int] = None
    is_partner: Optional[bool] = None
    is_active: Optional[bool] = None
    website_url: Optional[str] = None


class BrandDetailOut(BrandOut):
    products: List[ProductOut] = []
    total: int = 0
    page: int = 1
    page_size: int = 24


class BlogOut(BaseModel):
    id: int
    title: str
    slug: str
    excerpt: Optional[str] = None
    content: str
    category: Optional[str] = None
    tags: List[str] = []
    author_name: str
    author_role: Optional[str] = None
    reading_time: int
    image_url: Optional[str] = None
    published_at: Optional[datetime] = None
    featured: bool = False


class OrderStatusUpdate(BaseModel):
    status: str


class OrderOut(BaseModel):
    id: int
    order_number: str
    status: str
    total: Decimal
    subtotal: Decimal
    delivery_fee: Decimal
    payment_status: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    created_at: Optional[datetime] = None
    items: List[Dict[str, Any]] = []
    distance_km: Optional[float] = None
    delivery_eta_minutes: Optional[int] = None
    shipping_address: Optional[Dict[str, Any]] = None


class PrescriptionOut(BaseModel):
    id: int
    status: str
    file_url: str
    file_name: Optional[str] = None
    extracted_medicines: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    user_id: int


class PrescriptionReview(BaseModel):
    notes: Optional[str] = None


class AIChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class AIChatResponse(BaseModel):
    reply: str
    citations: List[Dict[str, Any]] = []
    products: List[ProductOut] = []
    model: str = "rule-based"
    mode: str = "rag"
    disclaimer: str = "Educational guidance only. Not a substitute for professional medical advice."


class DashboardOut(BaseModel):
    revenue_mtd: Decimal
    orders_count: int
    customers_count: int
    products_count: int
    pending_orders: int
    pending_prescriptions: int
    pending_medicine_requests: int = 0
    low_stock: int
    top_products: List[Dict[str, Any]]


class BlogCreate(BaseModel):
    title: str
    slug: str
    excerpt: Optional[str] = None
    content: str
    category: Optional[str] = None
    tags: List[str] = []
    author_name: str
    author_role: Optional[str] = None
    reading_time: int = 5
    is_published: bool = True
    featured: bool = False


class FAQOut(BaseModel):
    id: int
    question: str
    answer: str
    category: Optional[str] = None


class ExpertOut(BaseModel):
    id: int
    name: str
    slug: str
    role: str
    specialty: str
    quote: Optional[str] = None
    bio: Optional[str] = None
    image_url: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    clinic_name: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    maps_url: Optional[str] = None
    availability_text: Optional[str] = None
    accepting_calls: bool = True
    accepting_visits: bool = True
    is_featured: bool = True
    is_active: bool = True
    sort_order: int = 0

    model_config = {"from_attributes": True}


class ExpertCreate(BaseModel):
    name: str
    slug: str
    role: str
    specialty: str
    quote: Optional[str] = None
    bio: Optional[str] = None
    image_url: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    clinic_name: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    maps_url: Optional[str] = None
    availability_text: Optional[str] = None
    accepting_calls: bool = True
    accepting_visits: bool = True
    is_featured: bool = True
    is_active: bool = True
    sort_order: int = 0


class ExpertUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    role: Optional[str] = None
    specialty: Optional[str] = None
    quote: Optional[str] = None
    bio: Optional[str] = None
    image_url: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    clinic_name: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    maps_url: Optional[str] = None
    availability_text: Optional[str] = None
    accepting_calls: Optional[bool] = None
    accepting_visits: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class AIConfigOut(BaseModel):
    fine_tuned_model_id: Optional[str] = None
    base_model: str
    last_train_job_id: Optional[str] = None
    last_train_status: Optional[str] = None
    chunk_count: int = 0


class CrmCustomerOut(BaseModel):
    id: int
    external_id: Optional[str] = None
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    discount_pct: Decimal = Decimal("0")
    profile_name: Optional[str] = None
    doctor_name: Optional[str] = None
    family_name: Optional[str] = None
    payment_mode: Optional[str] = None
    vouchers: int = 0
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    bills_count: int = 0
    last_billed_on: Optional[str] = None
    net_total_amount: Decimal = Decimal("0")
    total_due_amount: Decimal = Decimal("0")
    tags: Optional[str] = None
    notes: Optional[str] = None
    source: str = "manual"
    marketing_opt_in: bool = False
    is_active: bool = True
    last_notified_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CrmCustomerCreate(BaseModel):
    external_id: Optional[str] = None
    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    tags: Optional[str] = None
    notes: Optional[str] = None
    marketing_opt_in: bool = False


class CrmCustomerUpdate(BaseModel):
    external_id: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    tags: Optional[str] = None
    notes: Optional[str] = None
    marketing_opt_in: Optional[bool] = None
    is_active: Optional[bool] = None


class CrmCustomerListResponse(BaseModel):
    items: List[CrmCustomerOut]
    total: int
    page: int
    page_size: int


class CrmStatsOut(BaseModel):
    total: int
    active: int
    opted_in: int
    cities: int


class NotificationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1)
    notification_type: str = "offer"  # offer|general|alert
    audience: str = "opted_in"  # all|opted_in|selected
    customer_ids: Optional[List[int]] = None


class NotificationOut(BaseModel):
    id: int
    title: str
    body: str
    notification_type: str
    audience: str
    status: str
    sent_at: Optional[datetime] = None
    recipient_count: int = 0
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ImportErrorRow(BaseModel):
    row: int
    error: str


class ImportResult(BaseModel):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    total: int = 0
    detail: Optional[str] = None
    errors: List[ImportErrorRow] = []


class BulkIdsRequest(BaseModel):
    customer_ids: List[int]


# --- Marketing CMS: banners & reels ---


class ReelProductSnippet(BaseModel):
    id: int
    slug: str
    name: str
    price: Decimal
    mrp: Decimal
    image_url: Optional[str] = None
    in_stock: bool = True
    requires_prescription: bool = False


class AdBannerOut(BaseModel):
    id: int
    title: str
    alt_text: Optional[str] = None
    image_url: str
    link_url: str
    cta_label: Optional[str] = None
    placement: str = "home_promo"
    banner_kind: str = "promo"
    target_type: str = "url"
    product_id: Optional[int] = None
    category_slug: Optional[str] = None
    brand_slug: Optional[str] = None
    badge_text: Optional[str] = None
    product: Optional[ReelProductSnippet] = None
    sort_order: int = 0
    is_active: bool = True
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AdBannerCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    alt_text: Optional[str] = None
    image_url: str = Field(min_length=1, max_length=1000)
    link_url: str = "/shop"
    cta_label: Optional[str] = None
    placement: str = "home_promo"
    banner_kind: str = "promo"
    target_type: str = "url"
    product_id: Optional[int] = None
    category_slug: Optional[str] = None
    brand_slug: Optional[str] = None
    badge_text: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class AdBannerUpdate(BaseModel):
    title: Optional[str] = None
    alt_text: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    cta_label: Optional[str] = None
    placement: Optional[str] = None
    banner_kind: Optional[str] = None
    target_type: Optional[str] = None
    product_id: Optional[int] = None
    category_slug: Optional[str] = None
    brand_slug: Optional[str] = None
    badge_text: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class SocialReelOut(BaseModel):
    id: int
    instagram_handle: str
    permalink: Optional[str] = None
    caption: Optional[str] = None
    display_mode: str = "instagram_embed"
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    product_id: Optional[int] = None
    product: Optional[ReelProductSnippet] = None
    external_media_id: Optional[str] = None
    source: str = "manual"
    sort_order: int = 0
    is_published: bool = False
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SocialReelCreate(BaseModel):
    instagram_handle: str = Field(min_length=1, max_length=100)
    permalink: Optional[str] = None
    caption: Optional[str] = None
    display_mode: str = "instagram_embed"
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    product_id: Optional[int] = None
    sort_order: int = 0
    is_published: bool = False


class SocialReelUpdate(BaseModel):
    instagram_handle: Optional[str] = None
    permalink: Optional[str] = None
    caption: Optional[str] = None
    display_mode: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    product_id: Optional[int] = None
    sort_order: Optional[int] = None
    is_published: Optional[bool] = None


class MerchRailOut(BaseModel):
    id: int
    key: str
    title: str
    subtitle: Optional[str] = None
    is_enabled: bool = True
    source_mode: str = "auto"
    limit: int = 8
    sort_order: int = 0
    product_ids: List[int] = []
    items: List[ProductOut] = []

    model_config = {"from_attributes": True}


class MerchRailUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    is_enabled: Optional[bool] = None
    source_mode: Optional[str] = None
    limit: Optional[int] = None
    sort_order: Optional[int] = None
    product_ids: Optional[List[int]] = None


class ProductQuickViewOut(BaseModel):
    product: ProductOut
    related: List[ProductOut] = []


class InstagramAccountOut(BaseModel):
    id: int
    handle: str
    ig_user_id: Optional[str] = None
    is_enabled: bool = True
    last_synced_at: Optional[datetime] = None
    last_error: Optional[str] = None
    token_configured: bool = False

    model_config = {"from_attributes": True}


class InstagramSyncResult(BaseModel):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: List[str] = []
    accounts: List[InstagramAccountOut] = []


class ReelBulkIdsRequest(BaseModel):
    reel_ids: List[int]


# --- Medicine requests & in-app notifications ---


class MedicineRequestItemIn(BaseModel):
    medicine_name: str = Field(min_length=1, max_length=255)
    brand_or_company: Optional[str] = Field(default=None, max_length=255)
    quantity: int = Field(default=1, ge=1, le=99)
    pack_or_strength: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None


class MedicineRequestCreate(BaseModel):
    items: List[MedicineRequestItemIn] = Field(min_length=1, max_length=30)
    customer_notes: Optional[str] = None


class MedicineRequestItemOut(BaseModel):
    id: int
    medicine_name: str
    brand_or_company: Optional[str] = None
    quantity: int
    pack_or_strength: Optional[str] = None
    notes: Optional[str] = None
    matched_product_id: Optional[int] = None
    matched_product_name: Optional[str] = None
    matched_product_slug: Optional[str] = None
    unit_price_snapshot: Optional[Decimal] = None
    matched_product_image_url: Optional[str] = None
    matched_product_requires_rx: Optional[bool] = None
    matched_product_in_stock: Optional[bool] = None
    matched_product_price: Optional[Decimal] = None
    matched_product_mrp: Optional[Decimal] = None


class MedicineRequestOut(BaseModel):
    id: int
    request_number: str
    status: str
    customer_notes: Optional[str] = None
    admin_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    fulfillment_method: Optional[str] = None
    order_id: Optional[int] = None
    order_number: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    available_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: List[MedicineRequestItemOut] = []
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    item_count: int = 0


class ChooseFulfillmentRequest(BaseModel):
    method: str  # pickup | delivery


class AttachOrderRequest(BaseModel):
    order_id: int


class MedicineRequestItemMatch(BaseModel):
    item_id: int
    matched_product_id: int


class MedicineRequestAdminUpdate(BaseModel):
    action: str  # accept | reject | mark_available | mark_picked_up | complete | cancel
    rejection_reason: Optional[str] = None
    admin_notes: Optional[str] = None
    item_matches: Optional[List[MedicineRequestItemMatch]] = None


class UserNotificationOut(BaseModel):
    id: int
    title: str
    body: str
    notification_type: str
    link_url: Optional[str] = None
    read_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UnreadCountOut(BaseModel):
    count: int

