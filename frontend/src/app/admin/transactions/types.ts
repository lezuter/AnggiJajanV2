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
  /**
   * Canonical game/account target from backend Transaction.target.
   * This interface no longer carries customer_phone as a game/account target.
   */
  target: string;
  /**
   * Opsional identifier sekunder (contoh: Zone ID, Server) sesuai konfigurasi
   * Catalog.TargetSecondaryLabel. Bukan bagian dari target utama.
   */
  target_secondary?: string;
  /** Tipe target yang didefinisikan di catalog: SINGLE_ID | DUAL_INPUT | SERVER_DROPDOWN | RIOT_ID | GENERIC. */
  target_type?: string;
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
