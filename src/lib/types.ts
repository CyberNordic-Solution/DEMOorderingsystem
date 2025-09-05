export type Table = {
  id: string;
  name: string;
  capacity: number;
  created_at: string;
  is_active: boolean;
  index_no: number;
};

export type MenuCategory = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  is_active: boolean;
};

export type MenuItem = {
  id: string;
  name: string;
  category_id: string | null;
  price: number;
  is_active: boolean;
  created_at: string;
  menu_id: string | null;
};

export type Order = {
  id: string;
  table_id: string;
  status: string;
  note: string | null;
  created_at: string;
  closed_at: string | null;
  completed_at: string | null;
};

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  price: number;
  note: string | null;
  created_at: string;
  is_paid: boolean;
  unit_price: number;
};

export type AppSettings = {
  id: string;
  num_tables: number;
  restaurant_name: string;
  restaurant_address: string;
  restaurant_phone: string;
  restaurant_email: string;
  currency: string;
  tax_rate_dine_in: number;
  tax_rate_takeaway: number;
  service_charge: number;
  business_hours: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    wednesday: { open: string; close: string; closed: boolean };
    thursday: { open: string; close: string; closed: boolean };
    friday: { open: string; close: string; closed: boolean };
    saturday: { open: string; close: string; closed: boolean };
    sunday: { open: string; close: string; closed: boolean };
  };
  created_at: string;
  updated_at: string;
};
