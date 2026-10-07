export type CustomerType = "privat" | "foretag" | "aterforsaljare";
export type OrderSource = "shopify" | "foretag" | "aterforsaljare" | "annat";
export type OrderStatus =
  | "ny"
  | "bekraftad"
  | "ska_packas"
  | "skickad"
  | "levererad"
  | "avslutad"
  | "makulerad";
export type InvoiceStatus = "ej_fakturerad" | "fakturerad" | "betald";
export type MovementType = "inleverans" | "order" | "justering" | "retur";
export type Edition = "gammal" | "ny";
export type ShippingService = "home_small" | "home_small_prio";

export type Product = {
  id: number;
  sku: string;
  name: string;
  region: string;
  edition: Edition;
  sort_order: number;
  low_stock_threshold: number;
};

export type StockLevel = Product & {
  product_id: number;
  totalt: number;
  reserverat: number;
  tillgangligt: number;
  lagt_saldo: boolean;
};

export type Customer = {
  id: string;
  name: string;
  type: CustomerType;
  org_number: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  invoice_email: string | null;
  invoice_reference: string | null;
  notes: string | null;
  created_at: Date;
};

export type OrderRow = {
  id: string;
  order_number: number;
  customer_id: string | null;
  customer_name: string | null;
  customer_type: CustomerType | null;
  source: OrderSource;
  status: OrderStatus;
  invoice_status: InvoiceStatus;
  is_overdue: boolean;
  order_date: string;
  total_qty: number;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  ship_name: string | null;
  ship_address: string | null;
  ship_postal_code: string | null;
  ship_city: string | null;
  ship_country: string;
  tracking_number: string | null;
  shipped_at: Date | null;
  invoice_email: string | null;
  invoice_reference: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_due_date: string | null;
  invoice_pdf_path: string | null;
  paid_at: string | null;
  comment: string | null;
  shopify_order_name: string | null;
  shopify_order_id: string | null;
  weight_grams: number | null;
  shipping_service: ShippingService;
  shopify_fulfilled_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type OrderLine = {
  product_id: number;
  quantity: number;
  unit_price: string | null;
};

export type OrderEvent = {
  id: number;
  kind: string;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  created_at: Date;
  user_name: string | null;
};

export type Movement = {
  id: number;
  product_id: number;
  quantity: number;
  type: MovementType;
  note: string | null;
  occurred_at: Date;
  order_id: string | null;
  order_number: number | null;
  user_name: string | null;
};

export type ResellerDelivery = {
  id: string;
  name: string;
  quantity: number;
  delivered_on: string;
  follow_up_on: string;
  followed_up: boolean;
  note: string | null;
  created_at: Date;
};

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };
