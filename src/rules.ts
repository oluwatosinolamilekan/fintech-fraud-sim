import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { readGeneratedDataset } from './dataset-io.js';
import { parseRulePack, simulateRules } from './rules-core.js';
import type { RuleSimulationSummary, RulePack } from './rules-core.js';

// Re-export the pure rule engine and its types so existing imports from
// './rules.js' keep working. The browser bundle imports the pure logic from
// './rules-core.js' directly to avoid pulling in these Node-only wrappers.
export {
  parseRulePack,
  simulateRules
} from './rules-core.js';
export type {
  RuleCondition,
  RuleMatch,
  RuleOperator,
  RulePack,
  RuleSimulationSummary,
  TransactionRule
} from './rules-core.js';

export async function readRulePack(path: string): Promise<RulePack> {
  const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
  return parseRulePack(parsed);
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
