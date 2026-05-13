import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GeneratedDataset, SyntheticTransaction, SyntheticUser } from '../types.js';

const USER_FIELDS: (keyof SyntheticUser)[] = [
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
];

const TRANSACTION_FIELDS: (keyof SyntheticTransaction)[] = [
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
];

export async function writeCsv(dataset: GeneratedDataset, outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(join(outDir, 'users.csv'), toCsv(dataset.users, USER_FIELDS)),
    writeFile(join(outDir, 'transactions.csv'), toCsv(dataset.transactions, TRANSACTION_FIELDS))
  ]);
}

export function toCsv<T extends object>(rows: T[], fields: (keyof T)[]): string {
  const header = fields.join(',');
  const body = rows.map((row) => fields.map((field) => escapeCell(row[field])).join(','));
  return [header, ...body].join('\n');
}

function escapeCell(value: unknown): string {
  const normalized = Array.isArray(value) ? value.join('|') : String(value ?? '');
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replaceAll('"', '""')}"`;
  }
  return normalized;
}
