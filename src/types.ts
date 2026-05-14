export const FRAUD_PATTERNS = [
  'mule_account',
  'account_takeover',
  'velocity_abuse',
  'kyc_abuse',
  'chargeback_risk',
  'transaction_spike',
  'cross_border_anomaly',
  'beneficiary_burst'
] as const;

export type FraudPattern = (typeof FRAUD_PATTERNS)[number];
export type OutputFormat = 'csv' | 'json' | 'ndjson' | 'sql' | 'both' | 'all';
export type KycStatus = 'verified' | 'pending' | 'rejected';
export type RiskLabel = 'low' | 'medium' | 'high' | 'critical';
export type RecommendedAction = 'allow' | 'review' | 'block';
export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'reversed';
export type Channel = 'mobile_app' | 'web' | 'api' | 'pos' | 'ussd';
export type AccountStatus = 'active' | 'restricted' | 'closed';
export type AccountType = 'wallet' | 'savings' | 'current';
export type DeviceType = 'android' | 'ios' | 'web' | 'pos_terminal';
export type BeneficiaryType = 'bank_account' | 'wallet' | 'card';
export type MerchantCategory = 'airtime' | 'bill_payments' | 'ecommerce' | 'gaming' | 'groceries' | 'travel';

export interface GenerateOptions {
  users: number;
  fraudRate: number;
  format: OutputFormat;
  out: string;
  country: string;
  currency: string;
  patterns: FraudPattern[];
  seed?: string | number;
  transactionsMin: number;
  transactionsMax: number;
  pretty: boolean;
}

export interface SyntheticUser {
  user_id: string;
  country: string;
  account_age_days: number;
  kyc_status: KycStatus;
  failed_kyc_attempts: number;
  device_count: number;
  ip_country: string;
  declared_country: string;
  failed_login_attempts_24h: number;
  beneficiary_count_24h: number;
  chargeback_count: number;
  is_fraud: boolean;
  fraud_pattern: FraudPattern | 'none';
  risk_label: RiskLabel;
  risk_score: number;
  recommended_action: RecommendedAction;
  reason_codes: string[];
}

export interface SyntheticTransaction {
  transaction_id: string;
  user_id: string;
  account_id: string;
  timestamp: string;
  amount: number;
  currency: string;
  channel: Channel;
  beneficiary_id: string;
  beneficiary_country: string;
  merchant_id: string;
  device_id: string;
  ip_country: string;
  status: TransactionStatus;
  is_suspicious: boolean;
  fraud_pattern: FraudPattern | 'none';
  risk_score: number;
  recommended_action: RecommendedAction;
  reason_codes: string[];
}

export interface SyntheticAccount {
  account_id: string;
  user_id: string;
  account_type: AccountType;
  currency: string;
  balance: number;
  status: AccountStatus;
  opened_at: string;
  daily_limit: number;
  is_fraud_linked: boolean;
}

export interface SyntheticDevice {
  device_id: string;
  user_id: string;
  device_type: DeviceType;
  os: string;
  first_seen_at: string;
  last_seen_at: string;
  country: string;
  is_trusted: boolean;
  is_fraud_linked: boolean;
}

export interface SyntheticBeneficiary {
  beneficiary_id: string;
  user_id: string;
  beneficiary_type: BeneficiaryType;
  beneficiary_country: string;
  bank_code: string;
  added_at: string;
  is_recent: boolean;
  is_fraud_linked: boolean;
}

export interface SyntheticMerchant {
  merchant_id: string;
  merchant_name: string;
  category: MerchantCategory;
  country: string;
  risk_tier: RiskLabel;
  is_high_risk: boolean;
}

export interface GeneratedDataset {
  users: SyntheticUser[];
  accounts: SyntheticAccount[];
  devices: SyntheticDevice[];
  beneficiaries: SyntheticBeneficiary[];
  merchants: SyntheticMerchant[];
  transactions: SyntheticTransaction[];
  summary: GenerationSummary;
}

export interface GenerationSummary {
  total_users: number;
  total_accounts: number;
  total_devices: number;
  total_beneficiaries: number;
  total_merchants: number;
  total_transactions: number;
  fraud_rate_requested: number;
  fraud_users_generated: number;
  suspicious_transactions_generated: number;
  fraud_pattern_breakdown: Record<string, number>;
  generated_at: string;
  seed: string | number | null;
}

export interface UserGenerationContext {
  defaultCountry: string;
  currency: string;
  selectedPatterns: FraudPattern[];
  fraudUserIds: Set<string>;
}
