import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { generateDataset } from './generator.js';
import type { FraudPattern, GeneratedDataset, GenerateOptions, SyntheticTransaction } from './types.js';
import { writeJson } from './writers/json.js';

export const BENCHMARK_SUITE_NAMES = [
  'uk_fincrime',
  'open_banking_risk',
  'cross_border_remittance',
  'aml_sanctions',
  'global_fraud_mix'
] as const;

export type BenchmarkSuiteName = (typeof BENCHMARK_SUITE_NAMES)[number];
export type ImpactReportFormat = 'json' | 'html';

export interface BenchmarkSuite {
  name: BenchmarkSuiteName;
  label: string;
  description: string;
  ukGlobalUsefulness: string[];
  corridors: string[];
  typologies: string[];
  defaults: Pick<
    GenerateOptions,
    'users' | 'fraudRate' | 'country' | 'currency' | 'patterns' | 'transactionsMin' | 'transactionsMax'
  >;
}

export interface BenchmarkRun {
  suite: BenchmarkSuite;
  dataset: GeneratedDataset;
  report: ImpactReport;
}

export interface EvaluationSummary {
  total: number;
  predicted_positive: number;
  actual_positive: number;
  true_positive: number;
  false_positive: number;
  true_negative: number;
  false_negative: number;
  precision: number;
  recall: number;
  f1_score: number;
  false_positive_rate: number;
  false_negative_rate: number;
  pattern_detection_rate: Record<string, number>;
  estimated_fraud_loss_prevented: number;
  estimated_manual_review_cost: number;
}

export interface ImpactReport {
  generated_at: string;
  suite: BenchmarkSuiteName | null;
  source: string;
  economy_relevance: string[];
  totals: {
    users: number;
    transactions: number;
    suspicious_transactions: number;
    fraud_users: number;
  };
  fraud_exposure: {
    total_suspicious_amount: number;
    average_suspicious_amount: number;
    high_risk_transaction_count: number;
    review_transaction_count: number;
  };
  operational_impact: {
    estimated_manual_review_cost: number;
    estimated_customer_friction_events: number;
    estimated_preventable_loss: number;
  };
  pattern_breakdown: Record<string, number>;
  corridor_breakdown: Record<string, number>;
  top_risk_reasons: Record<string, number>;
}

export const BENCHMARK_SUITES: Record<BenchmarkSuiteName, BenchmarkSuite> = {
  uk_fincrime: {
    name: 'uk_fincrime',
    label: 'UK financial crime benchmark',
    description: 'UK-focused APP fraud, mule-account, takeover, and cashout simulation for fintech and bank controls.',
    ukGlobalUsefulness: [
      'Supports UK authorised push payment fraud control testing.',
      'Creates safe synthetic data for fraud operations, model QA, and risk dashboards.',
      'Helps fintech teams test controls without exposing real customer data.'
    ],
    corridors: ['GB-NG', 'GB-GH', 'GB-KE', 'GB-IN', 'GB-PK', 'GB-EU'],
    typologies: ['invoice_redirection', 'impersonation_scam', 'investment_scam', 'purchase_scam', 'money_mule_cashout'],
    defaults: {
      users: 6000,
      fraudRate: 0.11,
      country: 'GB',
      currency: 'GBP',
      patterns: ['mule_account', 'account_takeover', 'beneficiary_burst', 'velocity_abuse', 'transaction_spike'],
      transactionsMin: 2,
      transactionsMax: 28
    }
  },
  open_banking_risk: {
    name: 'open_banking_risk',
    label: 'Open banking risk benchmark',
    description: 'Synthetic consent, account, payment-initiation, and transaction-risk style data for open banking teams.',
    ukGlobalUsefulness: [
      'Targets the UK open banking ecosystem and PSD2-style payment journeys.',
      'Useful for account information, payment initiation, and consent-risk QA.',
      'Lets teams benchmark risk scoring before touching sensitive bank data.'
    ],
    corridors: ['GB-EU', 'GB-US', 'GB-IN'],
    typologies: ['consent_takeover', 'payment_initiation_abuse', 'account_takeover', 'beneficiary_burst'],
    defaults: {
      users: 4500,
      fraudRate: 0.08,
      country: 'GB',
      currency: 'GBP',
      patterns: ['account_takeover', 'velocity_abuse', 'beneficiary_burst', 'cross_border_anomaly'],
      transactionsMin: 3,
      transactionsMax: 24
    }
  },
  cross_border_remittance: {
    name: 'cross_border_remittance',
    label: 'Cross-border remittance benchmark',
    description: 'UK-to-global remittance and diaspora payment risk simulation for fintech, money transfer, and AML teams.',
    ukGlobalUsefulness: [
      'Models London-connected payment corridors into high-volume global remittance markets.',
      'Supports safer cross-border payment innovation and AML testing.',
      'Highlights corridor risk without using real migrants, beneficiaries, or bank accounts.'
    ],
    corridors: ['GB-NG', 'GB-GH', 'GB-KE', 'GB-ZA', 'GB-IN', 'GB-PK'],
    typologies: ['mule_account', 'rapid_cashout', 'cross_border_layering', 'beneficiary_burst'],
    defaults: {
      users: 7000,
      fraudRate: 0.1,
      country: 'GB',
      currency: 'GBP',
      patterns: ['cross_border_anomaly', 'mule_account', 'beneficiary_burst', 'transaction_spike'],
      transactionsMin: 2,
      transactionsMax: 32
    }
  },
  aml_sanctions: {
    name: 'aml_sanctions',
    label: 'AML and sanctions-screening benchmark',
    description: 'Synthetic AML monitoring fixtures for watchlist-like false positives, high-risk flows, and layering tests.',
    ukGlobalUsefulness: [
      'Gives regtech and compliance teams safe fixtures for AML transaction monitoring.',
      'Supports sanctions-screening QA using synthetic-only entities.',
      'Helps reduce compliance model defects before production release.'
    ],
    corridors: ['GB-AE', 'GB-US', 'GB-EU', 'GB-NG', 'GB-IN'],
    typologies: ['watchlist_false_positive', 'pep_like_profile', 'structuring', 'layering', 'rapid_in_out'],
    defaults: {
      users: 8000,
      fraudRate: 0.12,
      country: 'GB',
      currency: 'GBP',
      patterns: ['kyc_abuse', 'cross_border_anomaly', 'mule_account', 'transaction_spike', 'beneficiary_burst'],
      transactionsMin: 3,
      transactionsMax: 36
    }
  },
  global_fraud_mix: {
    name: 'global_fraud_mix',
    label: 'Global fintech fraud benchmark',
    description: 'Broad fintech fraud mix for model evaluation, demo datasets, and cross-market QA pipelines.',
    ukGlobalUsefulness: [
      'Combines UK, emerging-market, and global platform risk scenarios.',
      'Useful for international fintech products building from or into the UK.',
      'Creates repeatable synthetic data for AI model evaluation and release gates.'
    ],
    corridors: ['GB-NG', 'GB-GH', 'GB-KE', 'GB-US', 'GB-EU', 'US-IN'],
    typologies: ['mule_account', 'account_takeover', 'velocity_abuse', 'chargeback_risk', 'cross_border_anomaly'],
    defaults: {
      users: 10000,
      fraudRate: 0.1,
      country: 'GB',
      currency: 'GBP',
      patterns: ['mule_account', 'account_takeover', 'velocity_abuse', 'kyc_abuse', 'chargeback_risk', 'cross_border_anomaly'],
      transactionsMin: 2,
      transactionsMax: 35
    }
  }
};

export function parseBenchmarkSuite(value: string): BenchmarkSuiteName {
  const normalized = value.trim().toLowerCase().replace(/-/g, '_');
  if (!BENCHMARK_SUITE_NAMES.includes(normalized as BenchmarkSuiteName)) {
    throw new Error(`Unknown benchmark suite: ${value}. Allowed suites: ${BENCHMARK_SUITE_NAMES.join(', ')}`);
  }
  return normalized as BenchmarkSuiteName;
}

export function generateBenchmarkSuite(
  suiteName: BenchmarkSuiteName,
  overrides: Partial<GenerateOptions> = {}
): BenchmarkRun {
  const suite = BENCHMARK_SUITES[suiteName];
  const dataset = generateDataset({
    ...suite.defaults,
    ...overrides,
    patterns: overrides.patterns ?? suite.defaults.patterns,
    format: overrides.format ?? 'json',
    out: overrides.out ?? './output',
    pretty: overrides.pretty ?? false
  });
  return {
    suite,
    dataset,
    report: buildImpactReport(dataset, suite, suiteName)
  };
}

export async function writeBenchmarkRun(run: BenchmarkRun, outDir: string, pretty = false): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await writeJson(run.dataset, outDir, pretty);
  const spaces = pretty ? 2 : 0;
  await Promise.all([
    writeFile(join(outDir, 'benchmark_suite.json'), JSON.stringify(run.suite, null, spaces)),
    writeFile(join(outDir, 'impact_report.json'), JSON.stringify(run.report, null, spaces)),
    writeFile(join(outDir, 'impact_report.html'), renderImpactReportHtml(run.report, run.suite))
  ]);
}

export async function evaluatePredictionsFromFiles(
  truthPath: string,
  predictionsPath: string,
  threshold = 75
): Promise<EvaluationSummary> {
  const truthRows = await readRows(truthPath);
  const predictionRows = await readRows(predictionsPath);
  const predictionsById = new Map(predictionRows.map((row) => [String(row.transaction_id), row]));
  const transactions = truthRows.map(rowToTransactionLike);

  return evaluatePredictions(
    transactions,
    (transactionId) => predictionsById.get(transactionId),
    threshold
  );
}

export function evaluatePredictions(
  transactions: Array<Pick<SyntheticTransaction, 'transaction_id' | 'is_suspicious' | 'fraud_pattern' | 'amount'>>,
  predictionForId: (transactionId: string) => Record<string, unknown> | undefined,
  threshold = 75
): EvaluationSummary {
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;
  const patternTotals: Record<string, number> = {};
  const patternHits: Record<string, number> = {};
  let predictedPositive = 0;
  let actualPositive = 0;
  let preventedLoss = 0;

  for (const transaction of transactions) {
    const prediction = predictionForId(transaction.transaction_id);
    const predicted = prediction ? predictedSuspicious(prediction, threshold) : false;
    const actual = Boolean(transaction.is_suspicious);
    const pattern = transaction.fraud_pattern || 'none';

    if (predicted) predictedPositive += 1;
    if (actual) {
      actualPositive += 1;
      patternTotals[pattern] = (patternTotals[pattern] ?? 0) + 1;
    }

    if (predicted && actual) {
      truePositive += 1;
      patternHits[pattern] = (patternHits[pattern] ?? 0) + 1;
      preventedLoss += Number(transaction.amount) || 0;
    } else if (predicted && !actual) {
      falsePositive += 1;
    } else if (!predicted && actual) {
      falseNegative += 1;
    } else {
      trueNegative += 1;
    }
  }

  const patternDetectionRate = Object.fromEntries(
    Object.entries(patternTotals).map(([pattern, total]) => [pattern, ratio(patternHits[pattern] ?? 0, total)])
  );

  return {
    total: transactions.length,
    predicted_positive: predictedPositive,
    actual_positive: actualPositive,
    true_positive: truePositive,
    false_positive: falsePositive,
    true_negative: trueNegative,
    false_negative: falseNegative,
    precision: ratio(truePositive, truePositive + falsePositive),
    recall: ratio(truePositive, truePositive + falseNegative),
    f1_score: f1(truePositive, falsePositive, falseNegative),
    false_positive_rate: ratio(falsePositive, falsePositive + trueNegative),
    false_negative_rate: ratio(falseNegative, falseNegative + truePositive),
    pattern_detection_rate: patternDetectionRate,
    estimated_fraud_loss_prevented: money(preventedLoss),
    estimated_manual_review_cost: money(predictedPositive * 4.75)
  };
}

export async function buildImpactReportFromDirectory(inputDir: string, suiteName?: BenchmarkSuiteName): Promise<ImpactReport> {
  const transactions = JSON.parse(await readFile(join(inputDir, 'transactions.json'), 'utf8')) as SyntheticTransaction[];
  const summary = JSON.parse(await readFile(join(inputDir, 'summary.json'), 'utf8')) as GeneratedDataset['summary'];
  const suite = suiteName ? BENCHMARK_SUITES[suiteName] : null;
  const dataset = {
    users: [],
    accounts: [],
    devices: [],
    beneficiaries: [],
    merchants: [],
    transactions,
    summary
  } as unknown as GeneratedDataset;
  return buildImpactReport(dataset, suite, suiteName ?? null, basename(inputDir));
}

export async function writeImpactReport(report: ImpactReport, outPath: string, format: ImpactReportFormat, suite?: BenchmarkSuite): Promise<void> {
  await mkdir(dirname(outPath), { recursive: true });
  const body = format === 'html' ? renderImpactReportHtml(report, suite) : JSON.stringify(report, null, 2);
  await writeFile(outPath, body);
}

export function buildImpactReport(
  dataset: GeneratedDataset,
  suite: BenchmarkSuite | null,
  suiteName: BenchmarkSuiteName | null,
  source = 'generated_dataset'
): ImpactReport {
  const suspicious = dataset.transactions.filter((transaction) => transaction.is_suspicious);
  const totalSuspiciousAmount = suspicious.reduce((sum, transaction) => sum + transaction.amount, 0);
  const highRiskTransactions = dataset.transactions.filter((transaction) => transaction.recommended_action === 'block');
  const reviewTransactions = dataset.transactions.filter((transaction) => transaction.recommended_action === 'review');

  return {
    generated_at: new Date().toISOString(),
    suite: suiteName,
    source,
    economy_relevance: suite?.ukGlobalUsefulness ?? [
      'Creates privacy-preserving synthetic fraud data for fintech and regtech teams.',
      'Supports model QA, fraud-rule regression testing, and compliance workflow demos.'
    ],
    totals: {
      users: dataset.summary.total_users,
      transactions: dataset.summary.total_transactions,
      suspicious_transactions: dataset.summary.suspicious_transactions_generated,
      fraud_users: dataset.summary.fraud_users_generated
    },
    fraud_exposure: {
      total_suspicious_amount: money(totalSuspiciousAmount),
      average_suspicious_amount: money(ratio(totalSuspiciousAmount, suspicious.length)),
      high_risk_transaction_count: highRiskTransactions.length,
      review_transaction_count: reviewTransactions.length
    },
    operational_impact: {
      estimated_manual_review_cost: money(reviewTransactions.length * 4.75),
      estimated_customer_friction_events: reviewTransactions.length + highRiskTransactions.length,
      estimated_preventable_loss: money(totalSuspiciousAmount * 0.72)
    },
    pattern_breakdown: countBy(suspicious, (transaction) => transaction.fraud_pattern || 'none'),
    corridor_breakdown: countBy(suspicious, (transaction) => `${transaction.ip_country}-${transaction.beneficiary_country}`),
    top_risk_reasons: topCounts(suspicious.flatMap((transaction) => transaction.reason_codes), 12)
  };
}

export function renderImpactReportHtml(report: ImpactReport, suite?: BenchmarkSuite | null): string {
  const title = suite?.label ?? 'Synthetic fraud impact report';
  const metric = (label: string, value: string | number) => `<div><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`;
  const list = (items: string[]) => items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const tableRows = (rows: Record<string, number>) =>
    Object.entries(rows)
      .map(([key, value]) => `<tr><td>${escapeHtml(key)}</td><td>${value}</td></tr>`)
      .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #172033; line-height: 1.45; }
    h1 { margin-bottom: 8px; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(140px, 1fr)); gap: 12px; margin: 24px 0; }
    .metrics div { border: 1px solid #d7deea; border-radius: 8px; padding: 14px; }
    .metrics strong { display: block; font-size: 24px; margin-bottom: 4px; }
    .metrics span { color: #526071; font-size: 13px; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; }
    th, td { border-bottom: 1px solid #d7deea; padding: 8px; text-align: left; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(suite?.description ?? 'Impact summary for a synthetic fintech fraud dataset.')}</p>
  <ul>${list(report.economy_relevance)}</ul>
  <section class="metrics">
    ${metric('Transactions', report.totals.transactions)}
    ${metric('Suspicious transactions', report.totals.suspicious_transactions)}
    ${metric('Estimated preventable loss', report.operational_impact.estimated_preventable_loss)}
    ${metric('Customer friction events', report.operational_impact.estimated_customer_friction_events)}
  </section>
  <h2>Fraud Exposure</h2>
  <table><tbody>
    <tr><td>Total suspicious amount</td><td>${report.fraud_exposure.total_suspicious_amount}</td></tr>
    <tr><td>Average suspicious amount</td><td>${report.fraud_exposure.average_suspicious_amount}</td></tr>
    <tr><td>High-risk transactions</td><td>${report.fraud_exposure.high_risk_transaction_count}</td></tr>
    <tr><td>Review transactions</td><td>${report.fraud_exposure.review_transaction_count}</td></tr>
  </tbody></table>
  <h2>Pattern Breakdown</h2>
  <table><tbody>${tableRows(report.pattern_breakdown)}</tbody></table>
  <h2>Top Risk Reasons</h2>
  <table><tbody>${tableRows(report.top_risk_reasons)}</tbody></table>
</body>
</html>`;
}

async function readRows(path: string): Promise<Record<string, unknown>[]> {
  const text = await readFile(path, 'utf8');
  if (path.endsWith('.json')) {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error(`${path} must contain a JSON array`);
    }
    return parsed as Record<string, unknown>[];
  }
  return parseCsv(text);
}

function rowToTransactionLike(row: Record<string, unknown>): Pick<SyntheticTransaction, 'transaction_id' | 'is_suspicious' | 'fraud_pattern' | 'amount'> {
  return {
    transaction_id: String(row.transaction_id),
    is_suspicious: parseBoolean(row.is_suspicious),
    fraud_pattern: String(row.fraud_pattern ?? 'none') as FraudPattern | 'none',
    amount: Number(row.amount ?? 0)
  };
}

function predictedSuspicious(row: Record<string, unknown>, threshold: number): boolean {
  if ('is_suspicious' in row) return parseBoolean(row.is_suspicious);
  if ('prediction' in row) return parseBoolean(row.prediction);
  if ('predicted_suspicious' in row) return parseBoolean(row.predicted_suspicious);
  if ('risk_score' in row) return Number(row.risk_score) >= threshold;
  if ('score' in row) return Number(row.score) >= threshold;
  return false;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'block' || normalized === 'review';
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function countBy<T>(items: T[], keyForItem: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    const key = keyForItem(item);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function topCounts(items: string[], limit: number): Record<string, number> {
  return Object.fromEntries(
    Object.entries(countBy(items, (item) => item))
      .sort(([, left], [, right]) => right - left)
      .slice(0, limit)
  );
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));
}

function f1(truePositive: number, falsePositive: number, falseNegative: number): number {
  const precision = ratio(truePositive, truePositive + falsePositive);
  const recall = ratio(truePositive, truePositive + falseNegative);
  return precision + recall === 0 ? 0 : Number(((2 * precision * recall) / (precision + recall)).toFixed(4));
}

function money(value: number): number {
  return Number(value.toFixed(2));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
