export interface TransactionActivity {
  ID: number;
  CreatedAt: string;
  action: string;
  description: string;
  old_status: string;
  new_status: string;
  user?: {
    name: string;
    role: string;
  };
}

export interface Transaction {
  ID: number;
  invoice_id: string;
  customer_phone: string;
  amount: number;
  capital: number;
  profit: number;
  status: string;
  digi_status: string;
  payment_method: string;
  payment_url: string;
  reference: string;
  sn: string;
  retry_count: number;
  CreatedAt: string;
  UpdatedAt: string;

  // 🔥 FIELD PROVIDER AUDIT
  provider: string;
  provider_sku: string;
  provider_ref: string;
  provider_name: string;

  // 🔥 FIELD AUDIT BARU
  created_via: string;
  created_by_name: string;
  created_by_role: string;
  activities?: TransactionActivity[]; 

  Product?: {
    ID: number;
    name: string;
    code: string;
  };
}

export interface TransactionKpiSummary {
  total_revenue: number;
  total_profit: number;
  success_count: number;
  failed_count: number;
  pending_count: number;
  total_count: number;
}

export type TransactionStatus =
  | "PAID"
  | "PENDING"
  | "FAILED"
  | "SUCCESS"
  | "PROCESSING";
