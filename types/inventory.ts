export type Product = {
  id: string;
  created_at: string;
  name: string;
  barcode: string | null;
  price: number;
  cost: number;
  stock: number;
  image_url: string | null;
  kiosk_id: string | null;
  min_stock?: number;
  supplier_id?: string | null;
  category_id?: string | null;
  is_weighable?: boolean;
  category?: { name: string } | null;
  supplier?: { name: string } | null;
};
