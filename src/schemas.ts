import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type SchemaTarget = 'users' | 'accounts' | 'devices' | 'beneficiaries' | 'merchants' | 'transactions' | 'summary' | 'all';

type JsonSchema = Record<string, unknown>;

export const USER_SCHEMA: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'fintech-fraud-sim user',
  type: 'object',
  additionalProperties: false,
  required: [
    'user_id',
    'country',
    'identity_type',
    'kyc_provider',
    'account_age_days',
    'kyc_status',
    'failed_kyc_attempts',
    'device_count',
    'ip_country',
    'declared_country',
    'failed_login_attempts_24h',
    'beneficiary_count_24h',
    'chargeback_count',
    'is_fraud',
    'fraud_pattern',
    'risk_label',
    'risk_score',
    'recommended_action',
    'reason_codes',
    'network_id'
  ],
  properties: {
    user_id: { type: 'string' },
    country: { type: 'string', minLength: 2, maxLength: 2 },
    identity_type: {
      enum: ['national_id', 'passport', 'drivers_license', 'tax_id', 'bvn_like_id', 'ssn_like_id', 'mobile_money_id']
    },
    kyc_provider: { type: 'string' },
    account_age_days: { type: 'integer', minimum: 0 },
    kyc_status: { enum: ['verified', 'pending', 'rejected'] },
    failed_kyc_attempts: { type: 'integer', minimum: 0 },
    device_count: { type: 'integer', minimum: 1 },
    ip_country: { type: 'string', minLength: 2, maxLength: 2 },
    declared_country: { type: 'string', minLength: 2, maxLength: 2 },
    failed_login_attempts_24h: { type: 'integer', minimum: 0 },
    beneficiary_count_24h: { type: 'integer', minimum: 0 },
    chargeback_count: { type: 'integer', minimum: 0 },
    is_fraud: { type: 'boolean' },
    fraud_pattern: {
      enum: [
        'none',
        'mule_account',
        'account_takeover',
        'velocity_abuse',
        'kyc_abuse',
        'chargeback_risk',
        'transaction_spike',
        'cross_border_anomaly',
        'beneficiary_burst',
        'fraud_ring'
      ]
    },
    risk_label: { enum: ['low', 'medium', 'high', 'critical'] },
    risk_score: { type: 'integer', minimum: 0, maximum: 100 },
    recommended_action: { enum: ['allow', 'review', 'block'] },
    reason_codes: { type: 'array', items: { type: 'string' } },
    network_id: { type: ['string', 'null'] }
  }
};

export const TRANSACTION_SCHEMA: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'fintech-fraud-sim transaction',
  type: 'object',
  additionalProperties: false,
  required: [
    'transaction_id',
    'user_id',
    'account_id',
    'timestamp',
    'amount',
    'currency',
    'payment_rail',
    'channel',
    'beneficiary_id',
    'beneficiary_country',
    'merchant_id',
    'device_id',
    'ip_country',
    'status',
    'is_suspicious',
    'fraud_pattern',
    'risk_score',
    'recommended_action',
    'reason_codes',
    'network_id'
  ],
  properties: {
    transaction_id: { type: 'string' },
    user_id: { type: 'string' },
    account_id: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
    amount: { type: 'number', minimum: 0 },
    currency: { type: 'string', minLength: 3 },
    payment_rail: {
      enum: [
        'bank_transfer',
        'wallet_transfer',
        'card',
        'ach',
        'sepa',
        'swift',
        'mobile_money',
        'crypto_wallet',
        'cashout',
        'merchant_payment',
        'payout'
      ]
    },
    channel: { enum: ['mobile_app', 'web', 'api', 'pos', 'ussd'] },
    beneficiary_id: { type: 'string' },
    beneficiary_country: { type: 'string', minLength: 2, maxLength: 2 },
    merchant_id: { type: 'string' },
    device_id: { type: 'string' },
    ip_country: { type: 'string', minLength: 2, maxLength: 2 },
    status: { enum: ['completed', 'pending', 'failed', 'reversed'] },
    is_suspicious: { type: 'boolean' },
    fraud_pattern: {
      enum: [
        'none',
        'mule_account',
        'account_takeover',
        'velocity_abuse',
        'kyc_abuse',
        'chargeback_risk',
        'transaction_spike',
        'cross_border_anomaly',
        'beneficiary_burst',
        'fraud_ring'
      ]
    },
    risk_score: { type: 'integer', minimum: 0, maximum: 100 },
    recommended_action: { enum: ['allow', 'review', 'block'] },
    reason_codes: { type: 'array', items: { type: 'string' } },
    network_id: { type: ['string', 'null'] }
  }
};

export const ACCOUNT_SCHEMA: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'fintech-fraud-sim account',
  type: 'object',
  additionalProperties: false,
  required: ['account_id', 'user_id', 'account_type', 'currency', 'balance', 'status', 'opened_at', 'daily_limit', 'is_fraud_linked'],
  properties: {
    account_id: { type: 'string' },
    user_id: { type: 'string' },
    account_type: { enum: ['wallet', 'savings', 'current', 'checking', 'mobile_money', 'crypto', 'merchant', 'credit'] },
    currency: { type: 'string', minLength: 3 },
    balance: { type: 'number', minimum: 0 },
    status: { enum: ['active', 'restricted', 'closed'] },
    opened_at: { type: 'string', format: 'date-time' },
    daily_limit: { type: 'number', minimum: 0 },
    is_fraud_linked: { type: 'boolean' }
  }
};

export const DEVICE_SCHEMA: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'fintech-fraud-sim device',
  type: 'object',
  additionalProperties: false,
  required: ['device_id', 'user_id', 'device_type', 'os', 'first_seen_at', 'last_seen_at', 'country', 'is_trusted', 'is_fraud_linked', 'network_id'],
  properties: {
    device_id: { type: 'string' },
    user_id: { type: 'string' },
    device_type: { enum: ['android', 'ios', 'web', 'pos_terminal'] },
    os: { type: 'string' },
    first_seen_at: { type: 'string', format: 'date-time' },
    last_seen_at: { type: 'string', format: 'date-time' },
    country: { type: 'string', minLength: 2, maxLength: 2 },
    is_trusted: { type: 'boolean' },
    is_fraud_linked: { type: 'boolean' },
    network_id: { type: ['string', 'null'] }
  }
};

export const BENEFICIARY_SCHEMA: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'fintech-fraud-sim beneficiary',
  type: 'object',
  additionalProperties: false,
  required: ['beneficiary_id', 'user_id', 'beneficiary_type', 'beneficiary_country', 'bank_code', 'added_at', 'is_recent', 'is_fraud_linked', 'network_id'],
  properties: {
    beneficiary_id: { type: 'string' },
    user_id: { type: 'string' },
    beneficiary_type: { enum: ['bank_account', 'wallet', 'card', 'mobile_money', 'crypto_wallet'] },
    beneficiary_country: { type: 'string', minLength: 2, maxLength: 2 },
    bank_code: { type: 'string' },
    added_at: { type: 'string', format: 'date-time' },
    is_recent: { type: 'boolean' },
    is_fraud_linked: { type: 'boolean' },
    network_id: { type: ['string', 'null'] }
  }
};

export const MERCHANT_SCHEMA: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'fintech-fraud-sim merchant',
  type: 'object',
  additionalProperties: false,
  required: ['merchant_id', 'merchant_name', 'category', 'country', 'risk_tier', 'is_high_risk'],
  properties: {
    merchant_id: { type: 'string' },
    merchant_name: { type: 'string' },
    category: {
      enum: [
        'airtime',
        'bill_payments',
        'ecommerce',
        'gaming',
        'groceries',
        'travel',
        'creator_payout',
        'digital_goods',
        'remittance',
        'lending'
      ]
    },
    country: { type: 'string', minLength: 2, maxLength: 2 },
    risk_tier: { enum: ['low', 'medium', 'high', 'critical'] },
    is_high_risk: { type: 'boolean' }
  }
};

export const SUMMARY_SCHEMA: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'fintech-fraud-sim summary',
  type: 'object',
  additionalProperties: false,
  required: [
    'total_users',
    'total_accounts',
    'total_devices',
    'total_beneficiaries',
    'total_merchants',
    'total_transactions',
    'fraud_rate_requested',
    'fraud_users_generated',
    'suspicious_transactions_generated',
    'fraud_pattern_breakdown',
    'fraud_networks_generated',
    'networked_fraud_users_generated',
    'use_case',
    'platform',
    'country_profile',
    'generated_at',
    'seed'
  ],
  properties: {
    total_users: { type: 'integer', minimum: 0 },
    total_accounts: { type: 'integer', minimum: 0 },
    total_devices: { type: 'integer', minimum: 0 },
    total_beneficiaries: { type: 'integer', minimum: 0 },
    total_merchants: { type: 'integer', minimum: 0 },
    total_transactions: { type: 'integer', minimum: 0 },
    fraud_rate_requested: { type: 'number', minimum: 0, maximum: 1 },
    fraud_users_generated: { type: 'integer', minimum: 0 },
    suspicious_transactions_generated: { type: 'integer', minimum: 0 },
    fraud_pattern_breakdown: { type: 'object', additionalProperties: { type: 'integer', minimum: 0 } },
    fraud_networks_generated: { type: 'integer', minimum: 0 },
    networked_fraud_users_generated: { type: 'integer', minimum: 0 },
    use_case: {
      enum: [
        null,
        'consumer_fintech',
        'social_payments',
        'crypto_exchange',
        'marketplace_trust',
        'bank_aml',
        'bnpl_credit'
      ]
    },
    platform: { type: ['string', 'null'] },
    country_profile: { type: 'string' },
    generated_at: { type: 'string', format: 'date-time' },
    seed: { type: ['string', 'number', 'null'] }
  }
};

export function getSchemas(target: SchemaTarget): JsonSchema | Record<string, JsonSchema> {
  if (target === 'users') return USER_SCHEMA;
  if (target === 'accounts') return ACCOUNT_SCHEMA;
  if (target === 'devices') return DEVICE_SCHEMA;
  if (target === 'beneficiaries') return BENEFICIARY_SCHEMA;
  if (target === 'merchants') return MERCHANT_SCHEMA;
  if (target === 'transactions') return TRANSACTION_SCHEMA;
  if (target === 'summary') return SUMMARY_SCHEMA;
  return {
    users: USER_SCHEMA,
    accounts: ACCOUNT_SCHEMA,
    devices: DEVICE_SCHEMA,
    beneficiaries: BENEFICIARY_SCHEMA,
    merchants: MERCHANT_SCHEMA,
    transactions: TRANSACTION_SCHEMA,
    summary: SUMMARY_SCHEMA
  };
}

export async function writeSchemas(target: SchemaTarget, outDir: string, pretty = true): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const spaces = pretty ? 2 : 0;
  if (target === 'all') {
    await Promise.all([
      writeFile(join(outDir, 'users.schema.json'), JSON.stringify(USER_SCHEMA, null, spaces)),
      writeFile(join(outDir, 'accounts.schema.json'), JSON.stringify(ACCOUNT_SCHEMA, null, spaces)),
      writeFile(join(outDir, 'devices.schema.json'), JSON.stringify(DEVICE_SCHEMA, null, spaces)),
      writeFile(join(outDir, 'beneficiaries.schema.json'), JSON.stringify(BENEFICIARY_SCHEMA, null, spaces)),
      writeFile(join(outDir, 'merchants.schema.json'), JSON.stringify(MERCHANT_SCHEMA, null, spaces)),
      writeFile(join(outDir, 'transactions.schema.json'), JSON.stringify(TRANSACTION_SCHEMA, null, spaces)),
      writeFile(join(outDir, 'summary.schema.json'), JSON.stringify(SUMMARY_SCHEMA, null, spaces))
    ]);
    return;
  }

  await writeFile(join(outDir, `${target}.schema.json`), JSON.stringify(getSchemas(target), null, spaces));
}
