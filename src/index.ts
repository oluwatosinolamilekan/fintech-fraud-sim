export { generateDataset } from './generator.js';
export { PATTERN_DEFINITIONS, PATTERN_REASON_CODES, applyFraudPattern } from './patterns.js';
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
  RiskLabel,
  SyntheticTransaction,
  SyntheticUser,
  TransactionStatus
} from './types.js';
export { FRAUD_PATTERNS } from './types.js';
