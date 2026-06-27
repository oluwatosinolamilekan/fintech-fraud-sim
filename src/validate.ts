import { readGeneratedDataset } from './dataset-io.js';
import { FRAUD_PATTERNS } from './types.js';
import type { GeneratedDataset } from './types.js';
import { PAYMENT_RAILS } from './utils.js';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  entity?: string;
}

export interface ValidationSummary {
  valid: boolean;
  errors: number;
  warnings: number;
  totals: {
    users: number;
    accounts: number;
    devices: number;
    beneficiaries: number;
    merchants: number;
    transactions: number;
    events: number;
  };
  issues: ValidationIssue[];
}

export async function validateDatasetDirectory(inputDir: string): Promise<ValidationSummary> {
  return validateDataset(await readGeneratedDataset(inputDir));
}

export function validateDataset(dataset: GeneratedDataset): ValidationSummary {
  const issues: ValidationIssue[] = [];
  const add = (severity: ValidationIssue['severity'], code: string, message: string, entity?: string): void => {
    issues.push({ severity, code, message, entity });
  };

  const userIds = uniqueIds(dataset.users.map((user) => user.user_id), 'user', add);
  const accountIds = uniqueIds(dataset.accounts.map((account) => account.account_id), 'account', add);
  const deviceIds = uniqueIds(dataset.devices.map((device) => device.device_id), 'device', add);
  const beneficiaryIds = uniqueIds(dataset.beneficiaries.map((beneficiary) => beneficiary.beneficiary_id), 'beneficiary', add);
  const merchantIds = uniqueIds(dataset.merchants.map((merchant) => merchant.merchant_id), 'merchant', add);
  const transactionIds = uniqueIds(dataset.transactions.map((transaction) => transaction.transaction_id), 'transaction', add);
  uniqueIds(dataset.events.map((event) => event.event_id), 'event', add);

  for (const account of dataset.accounts) {
    if (!userIds.has(account.user_id)) add('error', 'BROKEN_ACCOUNT_USER', `Account references missing user ${account.user_id}`, account.account_id);
  }
  for (const device of dataset.devices) {
    if (!userIds.has(device.user_id)) add('error', 'BROKEN_DEVICE_USER', `Device references missing user ${device.user_id}`, device.device_id);
  }
  for (const beneficiary of dataset.beneficiaries) {
    if (!userIds.has(beneficiary.user_id)) add('error', 'BROKEN_BENEFICIARY_USER', `Beneficiary references missing user ${beneficiary.user_id}`, beneficiary.beneficiary_id);
  }
  for (const transaction of dataset.transactions) {
    if (!userIds.has(transaction.user_id)) add('error', 'BROKEN_TRANSACTION_USER', `Transaction references missing user ${transaction.user_id}`, transaction.transaction_id);
    if (!accountIds.has(transaction.account_id)) add('error', 'BROKEN_TRANSACTION_ACCOUNT', `Transaction references missing account ${transaction.account_id}`, transaction.transaction_id);
    if (!deviceIds.has(transaction.device_id)) add('error', 'BROKEN_TRANSACTION_DEVICE', `Transaction references missing device ${transaction.device_id}`, transaction.transaction_id);
    if (!beneficiaryIds.has(transaction.beneficiary_id)) add('error', 'BROKEN_TRANSACTION_BENEFICIARY', `Transaction references missing beneficiary ${transaction.beneficiary_id}`, transaction.transaction_id);
    if (!merchantIds.has(transaction.merchant_id)) add('error', 'BROKEN_TRANSACTION_MERCHANT', `Transaction references missing merchant ${transaction.merchant_id}`, transaction.transaction_id);
    if (!PAYMENT_RAILS.includes(transaction.payment_rail)) add('error', 'INVALID_PAYMENT_RAIL', `Invalid payment rail ${transaction.payment_rail}`, transaction.transaction_id);
    if (transaction.fraud_pattern !== 'none' && !FRAUD_PATTERNS.includes(transaction.fraud_pattern)) add('error', 'INVALID_FRAUD_PATTERN', `Invalid fraud pattern ${transaction.fraud_pattern}`, transaction.transaction_id);
    if (transaction.risk_score < 0 || transaction.risk_score > 100) add('error', 'INVALID_RISK_SCORE', 'Transaction risk score must be 0-100', transaction.transaction_id);
  }
  for (const user of dataset.users) {
    if (user.fraud_pattern !== 'none' && !FRAUD_PATTERNS.includes(user.fraud_pattern)) add('error', 'INVALID_USER_PATTERN', `Invalid user fraud pattern ${user.fraud_pattern}`, user.user_id);
    if (user.risk_score < 0 || user.risk_score > 100) add('error', 'INVALID_USER_RISK_SCORE', 'User risk score must be 0-100', user.user_id);
  }
  for (const event of dataset.events) {
    if (!userIds.has(event.user_id)) add('error', 'BROKEN_EVENT_USER', `Event references missing user ${event.user_id}`, event.event_id);
    if (event.entity_type === 'transaction' && !transactionIds.has(event.entity_id)) {
      add('error', 'BROKEN_EVENT_TRANSACTION', `Event references missing transaction ${event.entity_id}`, event.event_id);
    }
  }

  if (dataset.summary.total_users !== dataset.users.length) add('warning', 'SUMMARY_USER_COUNT', 'summary.total_users does not match users length');
  if (dataset.summary.total_transactions !== dataset.transactions.length) add('warning', 'SUMMARY_TRANSACTION_COUNT', 'summary.total_transactions does not match transactions length');
  if (dataset.summary.suspicious_transactions_generated !== dataset.transactions.filter((transaction) => transaction.is_suspicious).length) {
    add('warning', 'SUMMARY_SUSPICIOUS_COUNT', 'summary.suspicious_transactions_generated does not match transaction labels');
  }

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  return {
    valid: errors === 0,
    errors,
    warnings,
    totals: {
      users: dataset.users.length,
      accounts: dataset.accounts.length,
      devices: dataset.devices.length,
      beneficiaries: dataset.beneficiaries.length,
      merchants: dataset.merchants.length,
      transactions: dataset.transactions.length,
      events: dataset.events.length
    },
    issues
  };
}

function uniqueIds(
  ids: string[],
  entity: string,
  add: (severity: ValidationIssue['severity'], code: string, message: string, entity?: string) => void
): Set<string> {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      add('error', 'DUPLICATE_ID', `Duplicate ${entity} id ${id}`, id);
    }
    seen.add(id);
  }
  return seen;
}
