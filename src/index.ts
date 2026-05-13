export { generateDataset } from './generator.js';
export { PATTERN_DEFINITIONS, PATTERN_REASON_CODES, applyFraudPattern } from './patterns.js';
export { actionForRiskScore, scoreTransactionRisk, scoreUserRisk } from './risk.js';
export { getSchemas, writeSchemas, USER_SCHEMA, TRANSACTION_SCHEMA, SUMMARY_SCHEMA } from './schemas.js';
export type { SchemaTarget } from './schemas.js';
export { writeCsv, toCsv } from './writers/csv.js';
export { writeJson } from './writers/json.js';
export type {
  Channel,
  FraudPattern,
  GeneratedDataset,
  GenerateOptions,
  GenerationSummary,
  KycStatus,
  OutputFormat,
  RecommendedAction,
  RiskLabel,
  SyntheticTransaction,
  SyntheticUser,
  TransactionStatus
} from './types.js';
export { FRAUD_PATTERNS } from './types.js';
