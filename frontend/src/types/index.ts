/** Shared domain types for Interelia Wellness */

export type ProductCategory =
  | 'medicine'
  | 'nutrition'
  | 'wellness'
  | 'personal-care'
  | 'medical-devices'
  | 'mother-child'
  | 'senior-care'
  | 'diabetes-care'
  | 'heart-health'
  | 'ayurveda'
  | 'immunity'

export interface Product {
  id: string
  slug: string
  name: string
  brand: string
  brandSlug?: string
  category: ProductCategory
  subcategory?: string
  price: number
  mrp: number
  discountPercent: number
  rating: number
  reviewCount: number
  image: string
  images?: string[]
  inStock: boolean
  requiresPrescription: boolean
  packSize: string
  description: string
  benefits: string[]
  ingredients?: string
  usage?: string
  warnings?: string
  storage?: string
  healthConditions?: string[]
  ageGroup?: string
  gender?: string
  tags?: string[]
  aiInsight?: string
}

export interface CategoryItem {
  id: string
  name: string
  slug: ProductCategory
  description: string
  icon: string
  productCount: number
}

export interface BlogPost {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  category: string
  tags: string[]
  author: string
  authorRole: string
  readingTime: number
  publishedAt: string
  image: string
  featured?: boolean
}

export interface Expert {
  id: string
  name: string
  slug?: string
  role: string
  specialty: string
  image: string
  quote: string
  bio?: string
  phone?: string
  whatsapp?: string
  email?: string
  clinicName?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  pincode?: string
  mapsUrl?: string
  availabilityText?: string
  acceptingCalls?: boolean
  acceptingVisits?: boolean
}

export interface Testimonial {
  id: string
  name: string
  location: string
  rating: number
  text: string
  product?: string
}

export interface CartItem {
  product: Product
  quantity: number
}

export interface Address {
  id: string
  label: string
  name: string
  phone: string
  line1: string
  line2?: string
  city: string
  state: string
  pincode: string
  isDefault: boolean
}

export interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  items: CartItem[]
  total: number
  placedAt: string
  deliveryEstimate?: string
}

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'approved'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'returned'
  | 'cancelled'
  | 'refunded'

export interface Prescription {
  id: string
  fileName: string
  status: 'uploaded' | 'ocr_processing' | 'pending_review' | 'approved' | 'rejected'
  uploadedAt: string
  medicines?: string[]
  notes?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface UserProfile {
  id: string
  name: string
  email: string
  phone: string
  avatar?: string
  rewardsPoints: number
}
