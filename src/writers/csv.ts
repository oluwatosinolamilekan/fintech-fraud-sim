import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  GeneratedDataset,
  SyntheticAccount,
  SyntheticBeneficiary,
  SyntheticDevice,
  SyntheticMerchant,
  SyntheticTransaction,
  SyntheticUser
} from '../types.js';

const USER_FIELDS: (keyof SyntheticUser)[] = [
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
  'reason_codes'
];

const TRANSACTION_FIELDS: (keyof SyntheticTransaction)[] = [
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
  'reason_codes'
];

const ACCOUNT_FIELDS: (keyof SyntheticAccount)[] = [
  'account_id',
  'user_id',
  'account_type',
  'currency',
  'balance',
  'status',
  'opened_at',
  'daily_limit',
  'is_fraud_linked'
];

const DEVICE_FIELDS: (keyof SyntheticDevice)[] = [
  'device_id',
  'user_id',
  'device_type',
  'os',
  'first_seen_at',
  'last_seen_at',
  'country',
  'is_trusted',
  'is_fraud_linked'
];

const BENEFICIARY_FIELDS: (keyof SyntheticBeneficiary)[] = [
  'beneficiary_id',
  'user_id',
  'beneficiary_type',
  'beneficiary_country',
  'bank_code',
  'added_at',
  'is_recent',
  'is_fraud_linked'
];

const MERCHANT_FIELDS: (keyof SyntheticMerchant)[] = [
  'merchant_id',
  'merchant_name',
  'category',
  'country',
  'risk_tier',
  'is_high_risk'
];

export async function writeCsv(dataset: GeneratedDataset, outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(join(outDir, 'users.csv'), toCsv(dataset.users, USER_FIELDS)),
    writeFile(join(outDir, 'accounts.csv'), toCsv(dataset.accounts, ACCOUNT_FIELDS)),
    writeFile(join(outDir, 'devices.csv'), toCsv(dataset.devices, DEVICE_FIELDS)),
    writeFile(join(outDir, 'beneficiaries.csv'), toCsv(dataset.beneficiaries, BENEFICIARY_FIELDS)),
    writeFile(join(outDir, 'merchants.csv'), toCsv(dataset.merchants, MERCHANT_FIELDS)),
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
