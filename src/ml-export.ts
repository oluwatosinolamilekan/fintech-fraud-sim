import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SyntheticTransaction, SyntheticUser } from './types.js';
import { hashSeed } from './utils.js';

export type MlExportTarget = 'transactions' | 'users';
export type MlExportFormat = 'csv' | 'json';

export interface MlExportOptions {
  input: string;
  out: string;
  target: MlExportTarget;
  format?: MlExportFormat;
  split?: number;
  validationSplit?: number;
  stratify?: boolean;
  includeLeakageFields?: boolean;
  seed?: string | number;
}

export interface MlFeatureMetadata {
  target: MlExportTarget;
  label_column: string;
  positive_label: string;
  source: string;
  train_rows: number;
  test_rows: number;
  split: number;
  validation_split: number;
  stratified: boolean;
  features: string[];
  excluded_fields: string[];
  generated_files: string[];
}

interface MlExportResult {
  metadata: MlFeatureMetadata;
  files: string[];
}

type FeatureRow = Record<string, number>;

interface LabeledFeatureRow {
  id: string;
  features: FeatureRow;
  label: number;
}

const TRANSACTION_EXCLUDED_FIELDS = [
  'transaction_id',
  'user_id',
  'account_id',
  'beneficiary_id',
  'merchant_id',
  'device_id',
  'is_suspicious',
  'fraud_pattern',
  'risk_score',
  'recommended_action',
  'reason_codes',
  'network_id'
];

const USER_EXCLUDED_FIELDS = [
  'user_id',
  'is_fraud',
  'fraud_pattern',
  'risk_label',
  'risk_score',
  'recommended_action',
  'reason_codes',
  'network_id'
];

export async function exportMlTrainingDataset(options: MlExportOptions): Promise<MlExportResult> {
  validateMlExportOptions(options);
  const split = options.split ?? 0.8;
  const validationSplit = options.validationSplit ?? 0;
  const format = options.format ?? 'csv';
  const rows = options.target === 'transactions'
    ? await buildTransactionRows(options.input, Boolean(options.includeLeakageFields))
    : await buildUserRows(options.input, Boolean(options.includeLeakageFields));
  const features = collectFeatureNames(rows);
  const shuffled = options.stratify
    ? stratifiedShuffle(rows, options.seed ?? `${options.target}-ml-export`)
    : deterministicShuffle(rows, options.seed ?? `${options.target}-ml-export`);
  const trainCount = Math.max(1, Math.min(shuffled.length - 1, Math.round(shuffled.length * split)));
  const trainRows = shuffled.slice(0, trainCount);
  const remainingRows = shuffled.slice(trainCount);
  const validationCount = validationSplit > 0
    ? Math.max(1, Math.min(remainingRows.length - 1, Math.round(shuffled.length * validationSplit)))
    : 0;
  const validationRows = remainingRows.slice(0, validationCount);
  const testRows = remainingRows.slice(validationCount);

  await mkdir(options.out, { recursive: true });
  const extension = format === 'json' ? 'json' : 'csv';
  const files = [
    join(options.out, `X_train.${extension}`),
    join(options.out, `y_train.${extension}`),
    join(options.out, `X_test.${extension}`),
    join(options.out, `y_test.${extension}`),
    ...(validationRows.length > 0 ? [join(options.out, `X_validation.${extension}`), join(options.out, `y_validation.${extension}`)] : []),
    join(options.out, 'feature_metadata.json')
  ];
  const metadata: MlFeatureMetadata = {
    target: options.target,
    label_column: options.target === 'transactions' ? 'is_suspicious' : 'is_fraud',
    positive_label: '1',
    source: options.input,
    train_rows: trainRows.length,
    test_rows: testRows.length,
    split,
    validation_split: validationSplit,
    stratified: Boolean(options.stratify),
    features,
    excluded_fields: options.includeLeakageFields ? [] : options.target === 'transactions' ? TRANSACTION_EXCLUDED_FIELDS : USER_EXCLUDED_FIELDS,
    generated_files: files.map((file) => file.split('/').at(-1) ?? file)
  };

  const writes = [
    writeFile(files[0], featureOutput(trainRows, features, format)),
    writeFile(files[1], labelOutput(trainRows, format)),
    writeFile(files[2], featureOutput(testRows, features, format)),
    writeFile(files[3], labelOutput(testRows, format))
  ];
  if (validationRows.length > 0) {
    writes.push(
      writeFile(files[4], featureOutput(validationRows, features, format)),
      writeFile(files[5], labelOutput(validationRows, format))
    );
  }
  writes.push(writeFile(files[files.length - 1], JSON.stringify(metadata, null, 2)));
  await Promise.all(writes);

  return { metadata, files };
}

async function buildTransactionRows(input: string, includeLeakageFields: boolean): Promise<LabeledFeatureRow[]> {
  const transactions = await readJsonFile<SyntheticTransaction[]>(join(input, 'transactions.json'));
  const users = await readOptionalJsonFile<SyntheticUser[]>(join(input, 'users.json')) ?? [];
  const usersById = new Map(users.map((user) => [user.user_id, user]));

  return transactions.map((transaction) => {
    const user = usersById.get(transaction.user_id);
    const timestamp = new Date(transaction.timestamp);
    return {
      id: transaction.transaction_id,
      label: transaction.is_suspicious ? 1 : 0,
      features: {
        amount: transaction.amount,
        transaction_hour_utc: Number.isNaN(timestamp.getTime()) ? 0 : timestamp.getUTCHours(),
        transaction_day_of_week_utc: Number.isNaN(timestamp.getTime()) ? 0 : timestamp.getUTCDay(),
        beneficiary_country_differs_from_ip: transaction.beneficiary_country === transaction.ip_country ? 0 : 1,
        user_account_age_days: user?.account_age_days ?? 0,
        user_failed_kyc_attempts: user?.failed_kyc_attempts ?? 0,
        user_device_count: user?.device_count ?? 0,
        user_failed_login_attempts_24h: user?.failed_login_attempts_24h ?? 0,
        user_beneficiary_count_24h: user?.beneficiary_count_24h ?? 0,
        user_chargeback_count: user?.chargeback_count ?? 0,
        user_ip_country_mismatch: user && user.ip_country !== user.declared_country ? 1 : 0,
        ...oneHot('currency', transaction.currency),
        ...oneHot('payment_rail', transaction.payment_rail),
        ...oneHot('channel', transaction.channel),
        ...oneHot('status', transaction.status),
        ...oneHot('beneficiary_country', transaction.beneficiary_country),
        ...oneHot('ip_country', transaction.ip_country),
        ...(user ? oneHot('user_kyc_status', user.kyc_status) : {}),
        ...(includeLeakageFields ? leakageFeatures({
          risk_score: transaction.risk_score,
          recommended_action: transaction.recommended_action,
          fraud_pattern: transaction.fraud_pattern,
          reason_codes: transaction.reason_codes,
          network_id: transaction.network_id
        }) : {})
      }
    };
  });
}

async function buildUserRows(input: string, includeLeakageFields: boolean): Promise<LabeledFeatureRow[]> {
  const users = await readJsonFile<SyntheticUser[]>(join(input, 'users.json'));
  return users.map((user) => ({
    id: user.user_id,
    label: user.is_fraud ? 1 : 0,
    features: {
      account_age_days: user.account_age_days,
      failed_kyc_attempts: user.failed_kyc_attempts,
      device_count: user.device_count,
      failed_login_attempts_24h: user.failed_login_attempts_24h,
      beneficiary_count_24h: user.beneficiary_count_24h,
      chargeback_count: user.chargeback_count,
      ip_country_mismatch: user.ip_country !== user.declared_country ? 1 : 0,
      ...oneHot('country', user.country),
      ...oneHot('identity_type', user.identity_type),
      ...oneHot('kyc_provider', user.kyc_provider),
      ...oneHot('kyc_status', user.kyc_status),
      ...oneHot('ip_country', user.ip_country),
      ...oneHot('declared_country', user.declared_country),
      ...(includeLeakageFields ? leakageFeatures({
        risk_score: user.risk_score,
        recommended_action: user.recommended_action,
        fraud_pattern: user.fraud_pattern,
        risk_label: user.risk_label,
        reason_codes: user.reason_codes,
        network_id: user.network_id
      }) : {})
    }
  }));
}

function validateMlExportOptions(options: MlExportOptions): void {
  if (options.target !== 'transactions' && options.target !== 'users') {
    throw new Error('--target must be one of: transactions, users');
  }
  const split = options.split ?? 0.8;
  const validationSplit = options.validationSplit ?? 0;
  if (options.format && options.format !== 'csv' && options.format !== 'json') {
    throw new Error('--format must be one of: csv, json');
  }
  if (split <= 0 || split >= 1 || Number.isNaN(split)) {
    throw new Error('--split must be a number greater than 0 and less than 1');
  }
  if (validationSplit < 0 || validationSplit >= 1 || Number.isNaN(validationSplit)) {
    throw new Error('--validation-split must be a number greater than or equal to 0 and less than 1');
  }
  if (split + validationSplit >= 1) {
    throw new Error('--split plus --validation-split must be less than 1');
  }
}

async function readJsonFile<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as T;
}

async function readOptionalJsonFile<T>(path: string): Promise<T | undefined> {
  try {
    return await readJsonFile<T>(path);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

function collectFeatureNames(rows: LabeledFeatureRow[]): string[] {
  const features = new Set<string>();
  for (const row of rows) {
    for (const feature of Object.keys(row.features)) {
      features.add(feature);
    }
  }
  return [...features].sort();
}

function featureCsv(rows: LabeledFeatureRow[], features: string[]): string {
  const header = ['row_id', ...features].join(',');
  const body = rows.map((row) => [row.id, ...features.map((feature) => String(row.features[feature] ?? 0))].join(','));
  return [header, ...body].join('\n');
}

function featureOutput(rows: LabeledFeatureRow[], features: string[], format: MlExportFormat): string {
  if (format === 'json') {
    return JSON.stringify(rows.map((row) => ({ row_id: row.id, ...row.features })), null, 2);
  }
  return featureCsv(rows, features);
}

function labelCsv(rows: LabeledFeatureRow[]): string {
  const body = rows.map((row) => `${row.id},${row.label}`);
  return ['row_id,label', ...body].join('\n');
}

function labelOutput(rows: LabeledFeatureRow[], format: MlExportFormat): string {
  if (format === 'json') {
    return JSON.stringify(rows.map((row) => ({ row_id: row.id, label: row.label })), null, 2);
  }
  return labelCsv(rows);
}

function oneHot(prefix: string, value: string): FeatureRow {
  return { [`${prefix}_${sanitizeFeatureName(value)}`]: 1 };
}

function sanitizeFeatureName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
}

function deterministicShuffle<T>(items: T[], seed: string | number): T[] {
  const shuffled = [...items];
  let state = hashSeed(seed);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (1664525 * state + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function stratifiedShuffle(rows: LabeledFeatureRow[], seed: string | number): LabeledFeatureRow[] {
  const positives = deterministicShuffle(rows.filter((row) => row.label === 1), `${seed}:positive`);
  const negatives = deterministicShuffle(rows.filter((row) => row.label === 0), `${seed}:negative`);
  const mixed: LabeledFeatureRow[] = [];
  while (positives.length > 0 || negatives.length > 0) {
    if (positives.length > 0) mixed.push(positives.shift() as LabeledFeatureRow);
    if (negatives.length > 0) mixed.push(negatives.shift() as LabeledFeatureRow);
  }
  return mixed;
}

function leakageFeatures(fields: Record<string, unknown>): FeatureRow {
  const features: FeatureRow = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'number') {
      features[key] = value;
    } else if (typeof value === 'string') {
      Object.assign(features, oneHot(key, value));
    } else if (Array.isArray(value)) {
      features[`${key}_count`] = value.length;
      for (const item of value) {
        Object.assign(features, oneHot(key, String(item)));
      }
    } else if (value !== null && value !== undefined) {
      Object.assign(features, oneHot(key, String(value)));
    }
  }
  return features;
}
