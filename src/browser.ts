/**
 * Browser-safe entry point for fintech-fraud-sim.
 *
 * This module re-exports only the pure, in-memory parts of the library that do
 * not touch the filesystem, network, or any Node-only built-ins. It is the
 * bundle target used by the static playground / Live Lab demo so the same
 * deterministic generator that powers the CLI runs directly in the browser.
 *
 * Build it with:
 *   npm run build:browser
 * which bundles dist/browser.js into demo/fintech-fraud-sim.browser.js
 */

export { generateDataset } from './generator.js';
export { simulateRules, parseRulePack } from './rules-core.js';
export type {
  RuleCondition,
  RuleMatch,
  RuleOperator,
  RulePack,
  RuleSimulationSummary,
  TransactionRule
} from './rules-core.js';
export { actionForRiskScore, scoreTransactionRisk, scoreUserRisk } from './risk.js';
export {
  USE_CASE_NAMES,
  USE_CASE_PRESETS,
  allPatterns,
  parseUseCase,
  patternsForUseCase
} from './use-cases.js';
export { listCountryProfiles } from './country-profiles.js';
export { PLATFORM_NAMES, listPlatformPresets } from './platforms.js';
export { FRAUD_PATTERNS } from './types.js';
export type {
  FraudPattern,
  GeneratedDataset,
  GenerateOptions,
  RecommendedAction,
  SyntheticAccount,
  SyntheticBeneficiary,
  SyntheticDevice,
  SyntheticEvent,
  SyntheticMerchant,
  SyntheticTransaction,
  SyntheticUser
} from './types.js';
