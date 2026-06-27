export const FRAUD_PATTERNS = [
  'mule_account',
  'account_takeover',
  'velocity_abuse',
  'kyc_abuse',
  'chargeback_risk',
  'transaction_spike',
  'cross_border_anomaly',
  'beneficiary_burst',
  'fraud_ring',
  'synthetic_identity',
  'friendly_fraud',
  'promo_abuse',
  'merchant_collusion',
  'refund_abuse',
  'sanctions_false_positive',
  'structuring',
  'layering'
] as const;

export type FraudPattern = (typeof FRAUD_PATTERNS)[number];
export type OutputFormat = 'csv' | 'json' | 'ndjson' | 'sql' | 'parquet' | 'both' | 'all';
export type BuiltInPlatformName =
  | 'fintech'
  | 'marketplace'
  | 'crypto'
  | 'social'
  | 'gaming'
  | 'lending'
  | 'remittance';
export type PlatformName = BuiltInPlatformName | (string & {});
export type UseCaseName =
  | 'consumer_fintech'
  | 'social_payments'
  | 'crypto_exchange'
  | 'marketplace_trust'
  | 'bank_aml'
  | 'bnpl_credit';
export type KycStatus = 'verified' | 'pending' | 'rejected';
export type RiskLabel = 'low' | 'medium' | 'high' | 'critical';
export type RecommendedAction = 'allow' | 'review' | 'block';
export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'reversed';
export type Channel = 'mobile_app' | 'web' | 'api' | 'pos' | 'ussd';
export type PaymentRail =
  | 'bank_transfer'
  | 'wallet_transfer'
  | 'card'
  | 'ach'
  | 'sepa'
  | 'swift'
  | 'mobile_money'
  | 'crypto_wallet'
  | 'cashout'
  | 'merchant_payment'
  | 'payout';
export type IdentityType =
  | 'national_id'
  | 'passport'
  | 'drivers_license'
  | 'tax_id'
  | 'bvn_like_id'
  | 'ssn_like_id'
  | 'mobile_money_id';
export type AccountStatus = 'active' | 'restricted' | 'closed';
export type AccountType = 'wallet' | 'savings' | 'current' | 'checking' | 'mobile_money' | 'crypto' | 'merchant' | 'credit';
export type DeviceType = 'android' | 'ios' | 'web' | 'pos_terminal';
export type BeneficiaryType = 'bank_account' | 'wallet' | 'card' | 'mobile_money' | 'crypto_wallet';
export type MerchantCategory =
  | 'airtime'
  | 'bill_payments'
  | 'ecommerce'
  | 'gaming'
  | 'groceries'
  | 'travel'
  | 'creator_payout'
  | 'digital_goods'
  | 'remittance'
  | 'lending';

export interface CountryProfile {
  code: string;
  label: string;
  currency: string;
  channels: Channel[];
  paymentRails: PaymentRail[];
  accountTypes: AccountType[];
  beneficiaryTypes: BeneficiaryType[];
  merchantCategories: MerchantCategory[];
  identityTypes: IdentityType[];
  kycProviders: string[];
  bankCodeLength: number;
}

export interface PlatformPreset {
  name: PlatformName;
  label: string;
  description: string;
  defaults: Partial<Pick<GenerateOptions, 'fraudRate' | 'patterns' | 'transactionsMin' | 'transactionsMax' | 'paymentRails'>>;
  merchantCategories: MerchantCategory[];
}

export interface GenerationPlugin {
  name: string;
  countryProfiles?: CountryProfile[];
  platformPresets?: PlatformPreset[];
  configureOptions?: (options: GenerateOptions) => Partial<GenerateOptions> | GenerateOptions;
}

export interface GenerateOptions {
  users: number;
  fraudRate: number;
  format: OutputFormat;
  out: string;
  country: string;
  currency: string;
  profile?: string;
  platform?: PlatformName;
  paymentRails?: PaymentRail[];
  patterns: FraudPattern[];
  patternWeights?: Partial<Record<FraudPattern, number>>;
  plugins?: GenerationPlugin[];
  seed?: string | number;
  transactionsMin: number;
  transactionsMax: number;
  pretty: boolean;
  useCase?: UseCaseName;
}

export interface SyntheticUser {
  user_id: string;
  country: string;
  identity_type: IdentityType;
  kyc_provider: string;
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
  network_id: string | null;
}

export interface SyntheticTransaction {
  transaction_id: string;
  user_id: string;
  account_id: string;
  timestamp: string;
  amount: number;
  currency: string;
  payment_rail: PaymentRail;
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
  network_id: string | null;
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
  network_id: string | null;
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
  network_id: string | null;
}

export interface SyntheticMerchant {
  merchant_id: string;
  merchant_name: string;
  category: MerchantCategory;
  country: string;
  risk_tier: RiskLabel;
  is_high_risk: boolean;
}

export type SyntheticEventType =
  | 'user_created'
  | 'kyc_attempt'
  | 'device_seen'
  | 'beneficiary_added'
  | 'transaction_created'
  | 'rule_decision';

export interface SyntheticEvent {
  event_id: string;
  event_type: SyntheticEventType;
  timestamp: string;
  user_id: string;
  entity_id: string;
  entity_type: 'user' | 'kyc' | 'device' | 'beneficiary' | 'transaction' | 'decision';
  risk_score: number | null;
  recommended_action: RecommendedAction | null;
  is_suspicious: boolean;
  fraud_pattern: FraudPattern | 'none';
  reason_codes: string[];
  network_id: string | null;
}

export interface GeneratedDataset {
  users: SyntheticUser[];
  accounts: SyntheticAccount[];
  devices: SyntheticDevice[];
  beneficiaries: SyntheticBeneficiary[];
  merchants: SyntheticMerchant[];
  transactions: SyntheticTransaction[];
  events: SyntheticEvent[];
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
  fraud_networks_generated: number;
  networked_fraud_users_generated: number;
  use_case: UseCaseName | null;
  platform: PlatformName | null;
  country_profile: string;
  generated_at: string;
  seed: string | number | null;
}

export interface UserGenerationContext {
  defaultCountry: string;
  currency: string;
  selectedPatterns: FraudPattern[];
  fraudUserIds: Set<string>;
}
