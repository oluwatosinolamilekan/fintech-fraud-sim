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
export type OutputFormat = 'csv' | 'json' | 'both';
export type KycStatus = 'verified' | 'pending' | 'rejected';
export type RiskLabel = 'low' | 'medium' | 'high' | 'critical';
export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'reversed';
export type Channel = 'mobile_app' | 'web' | 'api' | 'pos' | 'ussd';

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
  reason_codes: string[];
}

export interface SyntheticTransaction {
  transaction_id: string;
  user_id: string;
  timestamp: string;
  amount: number;
  currency: string;
  channel: Channel;
  beneficiary_id: string;
  beneficiary_country: string;
  device_id: string;
  ip_country: string;
  status: TransactionStatus;
  is_suspicious: boolean;
  fraud_pattern: FraudPattern | 'none';
  reason_codes: string[];
}

export interface GeneratedDataset {
  users: SyntheticUser[];
  transactions: SyntheticTransaction[];
  summary: GenerationSummary;
}

export interface GenerationSummary {
  total_users: number;
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
