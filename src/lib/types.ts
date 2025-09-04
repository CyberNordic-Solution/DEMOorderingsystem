export type Table = {
  id: string;
  name: string; // e.g. T1, T2
  seats: number;
  is_occupied: boolean;
};

export type MenuItem = {
  id: string;
  menu_id?: string; // custom menu ID for display
  name: string;
  price: number; // cents or smallest unit
  category?: string | null;
  is_active: boolean;
};

export type Order = {
  id: string;
  table_id: string;
  people_count: number;
  status: "open" | "paid" | "partial_paid";
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  is_paid: boolean;
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
