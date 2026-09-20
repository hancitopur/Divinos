export type Role = 'superadmin' | 'admin' | 'member' | 'pending'
export type MembershipPlan = 'digital' | 'reserva' | 'coleccion'
export type MembershipStatus = 'pending' | 'approval_pending' | 'active' | 'suspended' | 'past_due' | 'cancelled' | 'expired'
export type BottleStatus = 'in_storage' | 'sold' | 'consumed' | 'removed'
export type WineType = 'red' | 'white' | 'rose' | 'sparkling' | 'dessert' | 'fortified' | 'other'

export interface Profile { id: string; full_name: string | null; role: Role; terms_version?: string | null; terms_accepted_at?: string | null }

export interface CustomerOnboarding {
  user_id: string; legal_name: string; phone: string; address_line1: string; address_line2: string | null
  city: string; region: string; postal_code: string; updated_at?: string
}

export interface Membership {
  user_id: string; client_id: string; plan: MembershipPlan; status: MembershipStatus
  bottle_limit: number | null; payment_provider: 'paypal'; paypal_subscription_id: string | null
  current_period_end: string | null; activated_at: string | null
}

export interface IntakeRequest {
  id: string; client_id: string; submitted_by: string; status: 'draft' | 'submitted' | 'reviewing' | 'accepted' | 'rejected'
  notes: string | null; submitted_at: string | null; created_at: string
}

export interface Client {
  id: string; name: string; email: string | null; phone: string | null; notes: string | null; active: boolean
}

export interface Wine {
  id: string; name: string; producer: string | null; vintage: number | null; region: string | null
  country: string | null; varietal: string | null; type: WineType | null; size_ml: number
  label_photo_path: string | null; notes: string | null; barcode: string | null
  label_source: 'camera_upload' | 'open_food_facts' | 'wikimedia_commons' | null; label_source_url: string | null
}

export interface Rack { id: string; name: string; description: string | null; shelves: number; positions_per_shelf: number }
export interface Slot { id: string; rack_id: string; shelf: number; position: number }

export interface Bottle {
  id: string; wine_id: string; client_id: string; slot_id: string | null
  purchase_price: number; sale_price: number; status: BottleStatus
  received_at: string; released_at: string | null; label_photo_path: string | null; notes: string | null
}

export interface BottleDetail extends Bottle {
  margin: number; wine_name: string; producer: string | null; vintage: number | null; type: WineType | null
  region: string | null; country: string | null; varietal: string | null; size_ml: number
  client_name: string; shelf: number | null; position: number | null; rack_id: string | null; rack_name: string | null
}

export interface ClientValue {
  client_id: string; client_name: string; active: boolean
  bottles_in_storage: number; purchase_value: number; sale_value: number; margin: number
}

export interface StorageSummary {
  bottles_in_storage: number; purchase_value: number; sale_value: number; total_slots: number; used_slots: number
}
