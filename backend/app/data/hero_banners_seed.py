"""Default homepage hero trust slides (admin can replace anytime).

Images live in the storefront at /images/hero/* (frontend/public).
"""

DEFAULT_HERO_BANNERS = [
    {
        "title": "Trusted clinical care",
        "alt_text": "Doctor with medicine consulting for your health",
        "image_url": "/images/hero/doctor-medicine.jpg",
        "link_url": "/experts",
        "cta_label": "Meet our experts",
        "placement": "home_hero",
        "banner_kind": "hero",
        "target_type": "url",
        "badge_text": "Care",
        "sort_order": 0,
        "is_active": True,
    },
    {
        "title": "Happy, healthy families",
        "alt_text": "Happy family choosing wellness products together",
        "image_url": "/images/hero/happy-family.jpg",
        "link_url": "/shop",
        "cta_label": "Shop wellness",
        "placement": "home_hero",
        "banner_kind": "hero",
        "target_type": "url",
        "badge_text": "Family",
        "sort_order": 1,
        "is_active": True,
    },
    {
        "title": "Medicine you can trust",
        "alt_text": "Pharmacist handing medicine to a happy customer",
        "image_url": "/images/hero/pharmacy-care.jpg",
        "link_url": "/shop",
        "cta_label": "Shop medicines",
        "placement": "home_hero",
        "banner_kind": "hero",
        "target_type": "url",
        "badge_text": "Pharmacy",
        "sort_order": 2,
        "is_active": True,
    },
]
