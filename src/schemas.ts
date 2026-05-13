import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type SchemaTarget = 'users' | 'transactions' | 'summary' | 'all';

type JsonSchema = Record<string, unknown>;

export const USER_SCHEMA: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'fintech-fraud-sim user',
  type: 'object',
  additionalProperties: false,
  required: [
    'user_id',
    'country',
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
    'reason_codes'
  ],
  properties: {
    user_id: { type: 'string' },
    country: { type: 'string', minLength: 2, maxLength: 2 },
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
        'beneficiary_burst'
      ]
    },
    risk_label: { enum: ['low', 'medium', 'high', 'critical'] },
    risk_score: { type: 'integer', minimum: 0, maximum: 100 },
    recommended_action: { enum: ['allow', 'review', 'block'] },
    reason_codes: { type: 'array', items: { type: 'string' } }
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
    'timestamp',
    'amount',
    'currency',
    'channel',
    'beneficiary_id',
    'beneficiary_country',
    'device_id',
    'ip_country',
    'status',
    'is_suspicious',
    'fraud_pattern',
    'risk_score',
    'recommended_action',
    'reason_codes'
  ],
  properties: {
    transaction_id: { type: 'string' },
    user_id: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
    amount: { type: 'number', minimum: 0 },
    currency: { type: 'string', minLength: 3 },
    channel: { enum: ['mobile_app', 'web', 'api', 'pos', 'ussd'] },
    beneficiary_id: { type: 'string' },
    beneficiary_country: { type: 'string', minLength: 2, maxLength: 2 },
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
        'beneficiary_burst'
      ]
    },
    risk_score: { type: 'integer', minimum: 0, maximum: 100 },
    recommended_action: { enum: ['allow', 'review', 'block'] },
    reason_codes: { type: 'array', items: { type: 'string' } }
  }
};

export const SUMMARY_SCHEMA: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'fintech-fraud-sim summary',
  type: 'object',
  additionalProperties: false,
  required: [
    'total_users',
    'total_transactions',
    'fraud_rate_requested',
    'fraud_users_generated',
    'suspicious_transactions_generated',
    'fraud_pattern_breakdown',
    'generated_at',
    'seed'
  ],
  properties: {
    total_users: { type: 'integer', minimum: 0 },
    total_transactions: { type: 'integer', minimum: 0 },
    fraud_rate_requested: { type: 'number', minimum: 0, maximum: 1 },
    fraud_users_generated: { type: 'integer', minimum: 0 },
    suspicious_transactions_generated: { type: 'integer', minimum: 0 },
    fraud_pattern_breakdown: { type: 'object', additionalProperties: { type: 'integer', minimum: 0 } },
    generated_at: { type: 'string', format: 'date-time' },
    seed: { type: ['string', 'number', 'null'] }
  }
};

export function getSchemas(target: SchemaTarget): JsonSchema | Record<string, JsonSchema> {
  if (target === 'users') return USER_SCHEMA;
  if (target === 'transactions') return TRANSACTION_SCHEMA;
  if (target === 'summary') return SUMMARY_SCHEMA;
  return {
    users: USER_SCHEMA,
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
      writeFile(join(outDir, 'transactions.schema.json'), JSON.stringify(TRANSACTION_SCHEMA, null, spaces)),
      writeFile(join(outDir, 'summary.schema.json'), JSON.stringify(SUMMARY_SCHEMA, null, spaces))
    ]);
    return;
  }

  await writeFile(join(outDir, `${target}.schema.json`), JSON.stringify(getSchemas(target), null, spaces));
}
