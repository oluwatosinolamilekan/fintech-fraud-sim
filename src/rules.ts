import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { readGeneratedDataset } from './dataset-io.js';
import type { GeneratedDataset, RecommendedAction, SyntheticTransaction, SyntheticUser } from './types.js';

export type RuleOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'exists';

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value?: unknown;
  fieldRef?: string;
}

export interface TransactionRule {
  id: string;
  description?: string;
  action?: RecommendedAction;
  conditions: RuleCondition[];
}

export interface RulePack {
  name?: string;
  match?: 'all' | 'any';
  rules: TransactionRule[];
}

export interface RuleMatch {
  transaction_id: string;
  user_id: string;
  is_suspicious: boolean;
  risk_score: number;
  matched_rules: string[];
  recommended_action: RecommendedAction;
}

export interface RuleSimulationSummary {
  rule_pack: string;
  total_transactions: number;
  matched_transactions: number;
  actual_suspicious: number;
  true_positive: number;
  false_positive: number;
  true_negative: number;
  false_negative: number;
  precision: number;
  recall: number;
  f1_score: number;
  rule_breakdown: Record<string, number>;
  action_breakdown: Record<string, number>;
  matches: RuleMatch[];
}

type FactRow = Record<string, unknown>;

export async function readRulePack(path: string): Promise<RulePack> {
  const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
  return validateRulePack(parsed);
}

export async function simulateRulesFromDirectory(inputDir: string, rulePath: string, outPath?: string, pretty = false): Promise<RuleSimulationSummary> {
  const [dataset, rulePack] = await Promise.all([readGeneratedDataset(inputDir), readRulePack(rulePath)]);
  const summary = simulateRules(dataset, rulePack);
  if (outPath) {
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(summary, null, pretty ? 2 : 0));
  }
  return summary;
}

export function simulateRules(dataset: GeneratedDataset, rulePack: RulePack): RuleSimulationSummary {
  const usersById = new Map(dataset.users.map((user) => [user.user_id, user]));
  const matches: RuleMatch[] = [];
  const ruleBreakdown: Record<string, number> = {};
  const actionBreakdown: Record<string, number> = {};
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;

  for (const transaction of dataset.transactions) {
    const user = usersById.get(transaction.user_id);
    const fact = buildFactRow(transaction, user);
    const matchedRules = rulePack.rules.filter((rule) => ruleMatches(rule, fact)).map((rule) => rule.id);
    const matched = matchedRules.length > 0;
    const actual = transaction.is_suspicious;

    if (matched && actual) truePositive += 1;
    else if (matched && !actual) falsePositive += 1;
    else if (!matched && actual) falseNegative += 1;
    else trueNegative += 1;

    if (matched) {
      for (const ruleId of matchedRules) {
        ruleBreakdown[ruleId] = (ruleBreakdown[ruleId] ?? 0) + 1;
      }
      const action = strongestAction(matchedRules.map((ruleId) => rulePack.rules.find((rule) => rule.id === ruleId)?.action ?? 'review'));
      actionBreakdown[action] = (actionBreakdown[action] ?? 0) + 1;
      matches.push({
        transaction_id: transaction.transaction_id,
        user_id: transaction.user_id,
        is_suspicious: actual,
        risk_score: transaction.risk_score,
        matched_rules: matchedRules,
        recommended_action: action
      });
    }
  }

  return {
    rule_pack: rulePack.name ?? 'unnamed-rule-pack',
    total_transactions: dataset.transactions.length,
    matched_transactions: matches.length,
    actual_suspicious: dataset.transactions.filter((transaction) => transaction.is_suspicious).length,
    true_positive: truePositive,
    false_positive: falsePositive,
    true_negative: trueNegative,
    false_negative: falseNegative,
    precision: ratio(truePositive, truePositive + falsePositive),
    recall: ratio(truePositive, truePositive + falseNegative),
    f1_score: f1(truePositive, falsePositive, falseNegative),
    rule_breakdown: ruleBreakdown,
    action_breakdown: actionBreakdown,
    matches
  };
}

function validateRulePack(value: unknown): RulePack {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Rule file must be a JSON object');
  }
  const candidate = value as Partial<RulePack>;
  if (!Array.isArray(candidate.rules) || candidate.rules.length === 0) {
    throw new Error('Rule file must include a non-empty rules array');
  }
  const rules = candidate.rules.map((rule, index) => validateRule(rule, index));
  if (candidate.match && candidate.match !== 'all' && candidate.match !== 'any') {
    throw new Error('Rule pack match must be all or any');
  }
  return {
    name: typeof candidate.name === 'string' ? candidate.name : undefined,
    match: candidate.match ?? 'all',
    rules
  };
}

function validateRule(value: unknown, index: number): TransactionRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Rule at index ${index} must be an object`);
  }
  const candidate = value as Partial<TransactionRule>;
  if (!candidate.id || typeof candidate.id !== 'string') {
    throw new Error(`Rule at index ${index} must include a string id`);
  }
  const id = candidate.id;
  if (!Array.isArray(candidate.conditions) || candidate.conditions.length === 0) {
    throw new Error(`Rule ${id} must include non-empty conditions`);
  }
  if (candidate.action && !['allow', 'review', 'block'].includes(candidate.action)) {
    throw new Error(`Rule ${id} action must be allow, review, or block`);
  }
  return {
    id,
    description: typeof candidate.description === 'string' ? candidate.description : undefined,
    action: candidate.action ?? 'review',
    conditions: candidate.conditions.map((condition) => validateCondition(id, condition))
  };
}

function validateCondition(ruleId: string, value: unknown): RuleCondition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Rule ${ruleId} contains an invalid condition`);
  }
  const candidate = value as Partial<RuleCondition>;
  if (!candidate.field || typeof candidate.field !== 'string') {
    throw new Error(`Rule ${ruleId} condition must include a string field`);
  }
  if (!candidate.operator || !['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'exists'].includes(candidate.operator)) {
    throw new Error(`Rule ${ruleId} condition has an unsupported operator`);
  }
  return {
    field: candidate.field,
    operator: candidate.operator,
    value: candidate.value,
    fieldRef: typeof candidate.fieldRef === 'string' ? candidate.fieldRef : undefined
  };
}

function ruleMatches(rule: TransactionRule, fact: FactRow): boolean {
  return rule.conditions.every((condition) => conditionMatches(condition, fact));
}

function conditionMatches(condition: RuleCondition, fact: FactRow): boolean {
  const left = fact[condition.field];
  const right = condition.fieldRef ? fact[condition.fieldRef] : condition.value;
  switch (condition.operator) {
    case 'eq':
      return left === right;
    case 'ne':
      return left !== right;
    case 'gt':
      return numeric(left) > numeric(right);
    case 'gte':
      return numeric(left) >= numeric(right);
    case 'lt':
      return numeric(left) < numeric(right);
    case 'lte':
      return numeric(left) <= numeric(right);
    case 'in':
      return Array.isArray(right) && right.includes(left);
    case 'not_in':
      return Array.isArray(right) && !right.includes(left);
    case 'contains':
      return Array.isArray(left) ? left.includes(right) : String(left ?? '').includes(String(right ?? ''));
    case 'exists':
      return left !== undefined && left !== null && left !== '';
  }
}

function buildFactRow(transaction: SyntheticTransaction, user?: SyntheticUser): FactRow {
  return {
    ...transaction,
    reason_codes: transaction.reason_codes,
    reason_code_count: transaction.reason_codes.length,
    corridor: `${transaction.ip_country}-${transaction.beneficiary_country}`,
    country_mismatch: transaction.ip_country !== transaction.beneficiary_country,
    user_country: user?.country,
    user_kyc_status: user?.kyc_status,
    user_account_age_days: user?.account_age_days,
    user_failed_kyc_attempts: user?.failed_kyc_attempts,
    user_device_count: user?.device_count,
    user_failed_login_attempts_24h: user?.failed_login_attempts_24h,
    user_beneficiary_count_24h: user?.beneficiary_count_24h,
    user_chargeback_count: user?.chargeback_count,
    user_ip_country_mismatch: user ? user.ip_country !== user.declared_country : false
  };
}

function strongestAction(actions: RecommendedAction[]): RecommendedAction {
  if (actions.includes('block')) return 'block';
  if (actions.includes('review')) return 'review';
  return 'allow';
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));
}

function f1(truePositive: number, falsePositive: number, falseNegative: number): number {
  const precision = ratio(truePositive, truePositive + falsePositive);
  const recall = ratio(truePositive, truePositive + falseNegative);
  return precision + recall === 0 ? 0 : Number(((2 * precision * recall) / (precision + recall)).toFixed(4));
}
