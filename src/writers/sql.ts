import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GeneratedDataset } from '../types.js';

const TABLES = [
  'users',
  'accounts',
  'devices',
  'beneficiaries',
  'merchants',
  'transactions',
  'summary'
] as const;

type TableName = (typeof TABLES)[number];

const TABLE_FIELDS: Record<TableName, string[]> = {
  users: [
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
  accounts: ['account_id', 'user_id', 'account_type', 'currency', 'balance', 'status', 'opened_at', 'daily_limit', 'is_fraud_linked'],
  devices: ['device_id', 'user_id', 'device_type', 'os', 'first_seen_at', 'last_seen_at', 'country', 'is_trusted', 'is_fraud_linked', 'network_id'],
  beneficiaries: [
    'beneficiary_id',
    'user_id',
    'beneficiary_type',
    'beneficiary_country',
    'bank_code',
    'added_at',
    'is_recent',
    'is_fraud_linked',
    'network_id'
  ],
  merchants: ['merchant_id', 'merchant_name', 'category', 'country', 'risk_tier', 'is_high_risk'],
  transactions: [
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
  summary: [
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
  ]
};

export async function writeSql(dataset: GeneratedDataset, outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'dataset.sql'), toSql(dataset));
}

export function toSql(dataset: GeneratedDataset): string {
  const rowsByTable: Record<TableName, object[]> = {
    users: dataset.users,
    accounts: dataset.accounts,
    devices: dataset.devices,
    beneficiaries: dataset.beneficiaries,
    merchants: dataset.merchants,
    transactions: dataset.transactions,
    summary: [dataset.summary]
  };

  return TABLES.flatMap((table) => rowsByTable[table].map((row) => insertStatement(table, row))).join('\n');
}

function insertStatement(table: TableName, row: object): string {
  const fields = TABLE_FIELDS[table];
  const columns = fields.map((field) => `"${field}"`).join(', ');
  const values = fields.map((field) => sqlValue((row as Record<string, unknown>)[field])).join(', ');
  return `INSERT INTO "${table}" (${columns}) VALUES (${values});`;
}

function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (Array.isArray(value) || typeof value === 'object') return `'${JSON.stringify(value).replaceAll("'", "''")}'`;
  return `'${String(value).replaceAll("'", "''")}'`;
}
