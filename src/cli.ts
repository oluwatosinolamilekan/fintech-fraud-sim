#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  BENCHMARK_SUITE_NAMES,
  BENCHMARK_SUITES,
  buildImpactReportFromDirectory,
  evaluatePredictionsFromFiles,
  generateBenchmarkSuite,
  parseBenchmarkSuite,
  writeBenchmarkRun,
  writeImpactReport,
  type ImpactReportFormat
} from './benchmarks.js';
import { writeDashboardFromDirectory } from './dashboard.js';
import { generateDataset } from './generator.js';
import { type GraphExportFormat, writeGraphExportFromDirectory } from './graph.js';
import { inferScenarioFromPrompt } from './scenario.js';
import { exportMlTrainingDataset, type MlExportTarget } from './ml-export.js';
import { simulateRulesFromDirectory } from './rules.js';
import { getSchemas, writeSchemas } from './schemas.js';
import { writeCsv } from './writers/csv.js';
import { writeJson } from './writers/json.js';
import { writeNdjson } from './writers/ndjson.js';
import { writeParquet } from './writers/parquet.js';
import { writeSql } from './writers/sql.js';
import type { FraudPattern, GenerateOptions, PaymentRail, PlatformName, UseCaseName } from './types.js';
import type { SchemaTarget } from './schemas.js';
import { parseOutputFormat, parsePatterns, parsePaymentRails, toInteger, toNumber, validateGenerateOptions } from './utils.js';
import { parseUseCase, USE_CASE_PRESETS } from './use-cases.js';
import { getPlatformPreset, listPlatformPresets, parsePlatform } from './platforms.js';
import { getCountryProfile, listCountryProfiles } from './country-profiles.js';

import packageJson from '../package.json' with { type: 'json' };

const program = new Command();
const USE_CASE_HELP = 'preset for consumer_fintech, social_payments, crypto_exchange, marketplace_trust, bank_aml, or bnpl_credit';
const BENCHMARK_HELP = `benchmark suite for ${BENCHMARK_SUITE_NAMES.join(', ')}`;
const GRAPH_FORMAT_HELP = 'graph export format: json, csv, cypher, or graphml';
type GenerateConfig = Partial<Omit<GenerateOptions, 'patterns' | 'paymentRails'>> & {
  fraud_rate?: number;
  use_case?: string;
  transactions_min?: number;
  transactions_max?: number;
  payment_rails?: string[] | string;
  patterns?: string[] | string;
  pattern_weights?: Record<string, number>;
  patternWeights?: Partial<Record<FraudPattern, number>>;
  paymentRails?: PaymentRail[] | string;
};

program
  .name('fintech-fraud-sim')
  .description('Generate synthetic fintech users and transactions with configurable suspicious fraud patterns.')
  .version(packageJson.version);

program
  .command('generate')
  .description('Generate synthetic users, transactions, and a summary file.')
  .addHelpText('after', '\nRisk scoring fields are included in generated users and transactions.')
  .option('--users <number>', 'number of users to generate', parseIntegerOption('--users'), 1000)
  .option('--fraud-rate <number>', 'fraction of users to label as fraud, between 0 and 1', parseNumberOption('--fraud-rate'), 0.05)
  .option('--format <csv|json|ndjson|sql|parquet|both|all>', 'output format', 'both')
  .option('--out <path>', 'output directory', './output')
  .option('--config <path>', 'JSON config file with generation options')
  .option('--country <code>', 'default 2-letter country code', 'NG')
  .option('--currency <code>', 'transaction currency code', 'NGN')
  .option('--profile <code>', 'country profile code to use for local payment, KYC, and merchant behavior')
  .option('--platform <name>', 'platform preset for fintech, marketplace, crypto, social, gaming, lending, or remittance')
  .option('--payment-rails <list>', 'comma-separated payment rails to emit')
  .option('--patterns <list>', 'comma-separated fraud patterns, or all', 'all')
  .option('--pattern-weights <json>', 'JSON object mapping fraud patterns to numeric weights')
  .option('--use-case <name>', USE_CASE_HELP)
  .option('--seed <value>', 'string or number seed for deterministic output')
  .option('--transactions-min <number>', 'minimum transactions per non-fraud user', parseIntegerOption('--transactions-min'), 1)
  .option('--transactions-max <number>', 'maximum transactions per non-fraud user', parseIntegerOption('--transactions-max'), 20)
  .option('--pretty', 'write formatted JSON output', false)
  .action(async (rawOptions, command) => {
    try {
      const options = await buildGenerateOptions(rawOptions, command);
      const dataset = generateDataset(options);

      if (options.format === 'csv' || options.format === 'both' || options.format === 'all') {
        await writeCsv(dataset, options.out);
      }
      if (options.format === 'json' || options.format === 'both' || options.format === 'all') {
        await writeJson(dataset, options.out, options.pretty);
      }
      if (options.format === 'ndjson' || options.format === 'all') {
        await writeNdjson(dataset, options.out);
      }
      if (options.format === 'sql' || options.format === 'all') {
        await writeSql(dataset, options.out);
      }
      if (options.format === 'parquet' || options.format === 'all') {
        await writeParquet(dataset, options.out);
      }

      console.log(`Generated ${dataset.summary.total_users} users and ${dataset.summary.total_transactions} transactions in ${options.out}`);
      console.log(`Fraud users: ${dataset.summary.fraud_users_generated}; suspicious transactions: ${dataset.summary.suspicious_transactions_generated}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command('preview')
  .description('Print a small generated sample without writing files.')
  .option('--users <number>', 'number of users to generate', parseIntegerOption('--users'), 20)
  .option('--fraud-rate <number>', 'fraction of users to label as fraud, between 0 and 1', parseNumberOption('--fraud-rate'), 0.1)
  .option('--country <code>', 'default 2-letter country code', 'NG')
  .option('--currency <code>', 'transaction currency code', 'NGN')
  .option('--config <path>', 'JSON config file with generation options')
  .option('--profile <code>', 'country profile code to use for local payment, KYC, and merchant behavior')
  .option('--platform <name>', 'platform preset for fintech, marketplace, crypto, social, gaming, lending, or remittance')
  .option('--payment-rails <list>', 'comma-separated payment rails to emit')
  .option('--patterns <list>', 'comma-separated fraud patterns, or all', 'all')
  .option('--use-case <name>', USE_CASE_HELP)
  .option('--seed <value>', 'string or number seed for deterministic output')
  .option('--transactions-min <number>', 'minimum transactions per non-fraud user', parseIntegerOption('--transactions-min'), 1)
  .option('--transactions-max <number>', 'maximum transactions per non-fraud user', parseIntegerOption('--transactions-max'), 20)
  .option('--limit <number>', 'number of sample users and transactions to print', parseIntegerOption('--limit'), 5)
  .option('--pretty', 'write formatted JSON output', false)
  .action(async (rawOptions, command) => {
    try {
      const options = await buildGenerateOptions({ ...rawOptions, format: 'json', out: './output' }, command);
      const limit = rawOptions.limit as number;
      if (!Number.isInteger(limit) || limit < 1) {
        throw new Error('--limit must be a positive integer');
      }

      const dataset = generateDataset(options);
      console.log(
        JSON.stringify(
          {
            summary: dataset.summary,
            users: dataset.users.slice(0, limit),
            transactions: dataset.transactions.slice(0, limit)
          },
          null,
          rawOptions.pretty ? 2 : 0
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command('scenario')
  .description('Infer a fraud simulation from a natural-language AI scenario prompt.')
  .argument('<prompt...>', 'scenario prompt, for example "UK-Nigeria remittance mule cashout with beneficiary bursts"')
  .option('--users <number>', 'override inferred number of users', parseIntegerOption('--users'))
  .option('--fraud-rate <number>', 'override inferred fraud rate', parseNumberOption('--fraud-rate'))
  .option('--format <csv|json|ndjson|sql|parquet|both|all>', 'output format', parseOutputFormatOption, 'json')
  .option('--out <path>', 'output directory', './scenario-output')
  .option('--seed <value>', 'string or number seed for deterministic output')
  .option('--plan-only', 'print the inferred scenario plan without writing generated data', false)
  .option('--pretty', 'write formatted JSON output', false)
  .action(async (promptParts: string[], rawOptions) => {
    try {
      const prompt = promptParts.join(' ');
      const out = resolve(rawOptions.out as string);
      const plan = inferScenarioFromPrompt(prompt, {
        users: rawOptions.users,
        fraudRate: rawOptions.fraudRate,
        format: rawOptions.format,
        out,
        seed: rawOptions.seed as string | number | undefined,
        pretty: Boolean(rawOptions.pretty)
      });

      if (rawOptions.planOnly) {
        console.log(JSON.stringify(plan, null, rawOptions.pretty ? 2 : 0));
        return;
      }

      const dataset = generateDataset(plan.options);
      await writeGeneratedDataset(dataset, plan.options);
      await mkdir(out, { recursive: true });
      await writeFile(join(out, 'scenario_plan.json'), JSON.stringify(plan, null, rawOptions.pretty ? 2 : 0));

      console.log(`Generated ${plan.title} in ${out}`);
      console.log(`Patterns: ${plan.options.patterns.join(', ')}; fraud rate: ${plan.options.fraudRate}`);
      console.log(`Fraud users: ${dataset.summary.fraud_users_generated}; suspicious transactions: ${dataset.summary.suspicious_transactions_generated}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command('profiles')
  .description('List built-in and registered country profiles.')
  .option('--pretty', 'write formatted JSON output', false)
  .action((rawOptions) => {
    console.log(JSON.stringify(listCountryProfiles(), null, rawOptions.pretty ? 2 : 0));
  });

program
  .command('platforms')
  .description('List platform presets for fintech, marketplaces, crypto, social, gaming, lending, and remittance.')
  .option('--pretty', 'write formatted JSON output', false)
  .action((rawOptions) => {
    console.log(JSON.stringify(listPlatformPresets(), null, rawOptions.pretty ? 2 : 0));
  });

program
  .command('use-cases')
  .description('List production-oriented generation presets for fintech, social, marketplace, banking, and crypto apps.')
  .option('--pretty', 'write formatted JSON output', false)
  .action((rawOptions) => {
    const rows = Object.values(USE_CASE_PRESETS).map((preset) => ({
      name: preset.name,
      label: preset.label,
      platform_examples: preset.platformExamples,
      description: preset.description,
      defaults: preset.defaults
    }));

    console.log(JSON.stringify(rows, null, rawOptions.pretty ? 2 : 0));
  });

program
  .command('benchmarks')
  .description('List UK and global fraud benchmark suites.')
  .option('--pretty', 'write formatted JSON output', false)
  .action((rawOptions) => {
    const rows = Object.values(BENCHMARK_SUITES);
    console.log(JSON.stringify(rows, null, rawOptions.pretty ? 2 : 0));
  });

program
  .command('benchmark')
  .description('Generate a UK/global fraud simulation benchmark suite with an impact report.')
  .requiredOption('--suite <name>', BENCHMARK_HELP, parseBenchmarkSuiteOption)
  .option('--users <number>', 'number of users to generate', parseIntegerOption('--users'))
  .option('--fraud-rate <number>', 'fraction of users to label as fraud, between 0 and 1', parseNumberOption('--fraud-rate'))
  .option('--out <path>', 'output directory', './benchmark-output')
  .option('--seed <value>', 'string or number seed for deterministic output')
  .option('--transactions-min <number>', 'minimum transactions per non-fraud user', parseIntegerOption('--transactions-min'))
  .option('--transactions-max <number>', 'maximum transactions per non-fraud user', parseIntegerOption('--transactions-max'))
  .option('--pretty', 'write formatted JSON output', false)
  .action(async (rawOptions) => {
    try {
      const suiteName = rawOptions.suite as ReturnType<typeof parseBenchmarkSuite>;
      const suite = BENCHMARK_SUITES[suiteName];
      const out = resolve(rawOptions.out as string);
      const run = generateBenchmarkSuite(suiteName, {
        users: rawOptions.users ?? suite.defaults.users,
        fraudRate: rawOptions.fraudRate ?? suite.defaults.fraudRate,
        country: suite.defaults.country,
        currency: suite.defaults.currency,
        patterns: suite.defaults.patterns,
        transactionsMin: rawOptions.transactionsMin ?? suite.defaults.transactionsMin,
        transactionsMax: rawOptions.transactionsMax ?? suite.defaults.transactionsMax,
        format: 'json',
        out,
        seed: rawOptions.seed as string | number | undefined,
        pretty: Boolean(rawOptions.pretty)
      });

      await writeBenchmarkRun(run, out, Boolean(rawOptions.pretty));
      console.log(`Generated ${run.suite.label} in ${out}`);
      console.log(`Suspicious transactions: ${run.dataset.summary.suspicious_transactions_generated}; estimated preventable loss: ${run.report.operational_impact.estimated_preventable_loss}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command('evaluate')
  .description('Evaluate model predictions against generated transaction ground truth.')
  .requiredOption('--truth <path>', 'transactions.json or transactions.csv with is_suspicious ground truth')
  .requiredOption('--predictions <path>', 'JSON or CSV predictions with transaction_id and risk_score, score, prediction, or is_suspicious')
  .option('--threshold <number>', 'risk score threshold for numeric predictions', parseNumberOption('--threshold'), 75)
  .option('--out <path>', 'optional path to write evaluation JSON')
  .option('--pretty', 'write formatted JSON output', false)
  .action(async (rawOptions) => {
    try {
      const summary = await evaluatePredictionsFromFiles(
        resolve(rawOptions.truth as string),
        resolve(rawOptions.predictions as string),
        rawOptions.threshold as number
      );
      const output = JSON.stringify(summary, null, rawOptions.pretty ? 2 : 0);
      if (rawOptions.out) {
        await writeFile(resolve(rawOptions.out as string), output);
        console.log(`Wrote evaluation summary to ${resolve(rawOptions.out as string)}`);
        return;
      }
      console.log(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command('report')
  .description('Build an economic impact report from a generated JSON output directory.')
  .requiredOption('--input <path>', 'directory containing transactions.json and summary.json')
  .option('--suite <name>', BENCHMARK_HELP, parseBenchmarkSuiteOption)
  .option('--format <json|html>', 'report format', parseReportFormatOption, 'json')
  .option('--out <path>', 'output report path')
  .action(async (rawOptions) => {
    try {
      const suiteName = rawOptions.suite as ReturnType<typeof parseBenchmarkSuite> | undefined;
      const format = rawOptions.format as ImpactReportFormat;
      const input = resolve(rawOptions.input as string);
      const report = await buildImpactReportFromDirectory(input, suiteName);
      const out = resolve(rawOptions.out as string | undefined ?? join(input, `impact_report.${format}`));
      await writeImpactReport(report, out, format, suiteName ? BENCHMARK_SUITES[suiteName] : undefined);
      console.log(`Wrote ${format.toUpperCase()} impact report to ${out}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command('dashboard')
  .description('Build an interactive HTML dashboard from a generated JSON output directory.')
  .requiredOption('--input <path>', 'directory containing generated JSON dataset files')
  .option('--out <path>', 'output HTML path', './fraud-dashboard.html')
  .action(async (rawOptions) => {
    try {
      const out = resolve(rawOptions.out as string);
      const summary = await writeDashboardFromDirectory(resolve(rawOptions.input as string), out);
      console.log(`Wrote interactive fraud dashboard to ${out}`);
      console.log(`Suspicious transactions: ${summary.suspicious_transactions}; suspicious amount: ${summary.suspicious_amount}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command('graph-export')
  .description('Export generated data as a fraud network graph.')
  .requiredOption('--input <path>', 'directory containing generated JSON dataset files')
  .option('--format <json|csv|cypher|graphml>', GRAPH_FORMAT_HELP, parseGraphExportFormatOption, 'json')
  .option('--out <path>', 'output file path, or output directory when --format csv', './fraud-graph.json')
  .action(async (rawOptions) => {
    try {
      const format = rawOptions.format as GraphExportFormat;
      const out = resolve(rawOptions.out as string);
      const graph = await writeGraphExportFromDirectory(resolve(rawOptions.input as string), out, format);
      console.log(`Wrote ${format.toUpperCase()} fraud graph to ${out}`);
      console.log(`Graph nodes: ${graph.summary.nodes}; edges: ${graph.summary.edges}; fraud networks: ${graph.summary.fraud_networks}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command('rules-test')
  .description('Run JSON fraud rules against generated transactions and report detection metrics.')
  .requiredOption('--input <path>', 'directory containing generated JSON dataset files')
  .requiredOption('--rules <path>', 'JSON rule pack file')
  .option('--out <path>', 'optional path to write rule simulation JSON')
  .option('--pretty', 'write formatted JSON output', false)
  .action(async (rawOptions) => {
    try {
      const summary = await simulateRulesFromDirectory(
        resolve(rawOptions.input as string),
        resolve(rawOptions.rules as string),
        rawOptions.out ? resolve(rawOptions.out as string) : undefined,
        Boolean(rawOptions.pretty)
      );
      const output = JSON.stringify(summary, null, rawOptions.pretty ? 2 : 0);
      if (rawOptions.out) {
        console.log(`Wrote rule simulation summary to ${resolve(rawOptions.out as string)}`);
        console.log(`Matched transactions: ${summary.matched_transactions}; precision: ${summary.precision}; recall: ${summary.recall}`);
        return;
      }
      console.log(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command('ml-export')
  .description('Export generated JSON data as ML-ready train/test feature and label CSV files.')
  .requiredOption('--input <path>', 'directory containing generated users.json and/or transactions.json')
  .option('--target <transactions|users>', 'training target to export', parseMlExportTargetOption, 'transactions')
  .option('--out <path>', 'output directory for X/y CSV files and feature metadata', './ml-export')
  .option('--format <csv|json>', 'feature matrix output format', parseMlExportFormatOption, 'csv')
  .option('--split <number>', 'fraction of rows to place in training set', parseNumberOption('--split'), 0.8)
  .option('--validation-split <number>', 'optional fraction of rows to place in validation set', parseNumberOption('--validation-split'))
  .option('--stratify', 'preserve label ratio across train/test/validation splits', false)
  .option('--include-leakage-fields', 'include generated target/leakage fields for debugging only', false)
  .option('--seed <value>', 'string or number seed for deterministic train/test split')
  .action(async (rawOptions) => {
    try {
      const result = await exportMlTrainingDataset({
        input: resolve(rawOptions.input as string),
        out: resolve(rawOptions.out as string),
        target: rawOptions.target as MlExportTarget,
        format: rawOptions.format,
        split: rawOptions.split as number,
        validationSplit: rawOptions.validationSplit as number | undefined,
        stratify: Boolean(rawOptions.stratify),
        includeLeakageFields: Boolean(rawOptions.includeLeakageFields),
        seed: rawOptions.seed as string | number | undefined
      });

      console.log(`Exported ${result.metadata.target} ML dataset to ${resolve(rawOptions.out as string)}`);
      console.log(`Train rows: ${result.metadata.train_rows}; test rows: ${result.metadata.test_rows}; features: ${result.metadata.features.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command('validate')
  .description('Validate a generated JSON output directory for schema shape and referential integrity.')
  .requiredOption('--input <path>', 'directory containing generated JSON dataset files')
  .option('--out <path>', 'optional path to write validation JSON')
  .option('--pretty', 'write formatted JSON output', false)
  .action(async (rawOptions) => {
    try {
      const { validateDatasetDirectory } = await import('./validate.js');
      const result = await validateDatasetDirectory(resolve(rawOptions.input as string));
      const output = JSON.stringify(result, null, rawOptions.pretty ? 2 : 0);
      if (rawOptions.out) {
        await writeFile(resolve(rawOptions.out as string), output);
        console.log(`Wrote validation summary to ${resolve(rawOptions.out as string)}`);
      } else {
        console.log(output);
      }
      if (!result.valid) process.exitCode = 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command('serve')
  .description('Serve a generated JSON dataset through a small local HTTP API.')
  .requiredOption('--input <path>', 'directory containing generated JSON dataset files')
  .option('--port <number>', 'port to listen on', parseIntegerOption('--port'), 3333)
  .action(async (rawOptions) => {
    try {
      const { serveDataset } = await import('./server.js');
      const server = await serveDataset({
        input: resolve(rawOptions.input as string),
        port: rawOptions.port as number
      });
      console.log(`Serving fintech-fraud-sim dataset at ${server.url}`);
      console.log('Endpoints: /summary, /users, /transactions, /events, /risk/:transactionId');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command('rules-init')
  .description('Write a starter rule pack template.')
  .option('--template <aml|app-fraud|marketplace>', 'rule template name', parseRuleTemplateOption, 'aml')
  .option('--out <path>', 'output rule pack path', './rules.json')
  .option('--pretty', 'write formatted JSON output', true)
  .action(async (rawOptions) => {
    try {
      const { RULE_TEMPLATES } = await import('./rule-templates.js');
      const template = RULE_TEMPLATES[rawOptions.template as keyof typeof RULE_TEMPLATES];
      const out = resolve(rawOptions.out as string);
      await mkdir(dirnameCompat(out), { recursive: true });
      await writeFile(out, JSON.stringify(template, null, rawOptions.pretty ? 2 : 0));
      console.log(`Wrote ${rawOptions.template} rule template to ${out}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command('schema')
  .description('Print or export JSON Schema files for generated data.')
  .option('--target <users|accounts|devices|beneficiaries|merchants|transactions|events|summary|all>', 'schema target', parseSchemaTargetOption, 'all')
  .option('--out <path>', 'directory to write schema files instead of printing to stdout')
  .option('--pretty', 'write formatted JSON output', false)
  .action(async (rawOptions) => {
    try {
      const target = rawOptions.target as SchemaTarget;
      if (rawOptions.out) {
        const out = resolve(rawOptions.out);
        await writeSchemas(target, out, rawOptions.pretty);
        console.log(`Wrote ${target} schema${target === 'all' ? 's' : ''} to ${out}`);
        return;
      }

      console.log(JSON.stringify(getSchemas(target), null, rawOptions.pretty ? 2 : 0));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program.parseAsync();

async function writeGeneratedDataset(dataset: ReturnType<typeof generateDataset>, options: GenerateOptions): Promise<void> {
  if (options.format === 'csv' || options.format === 'both' || options.format === 'all') {
    await writeCsv(dataset, options.out);
  }
  if (options.format === 'json' || options.format === 'both' || options.format === 'all') {
    await writeJson(dataset, options.out, options.pretty);
  }
  if (options.format === 'ndjson' || options.format === 'all') {
    await writeNdjson(dataset, options.out);
  }
  if (options.format === 'sql' || options.format === 'all') {
    await writeSql(dataset, options.out);
  }
  if (options.format === 'parquet' || options.format === 'all') {
    await writeParquet(dataset, options.out);
  }
}

async function buildGenerateOptions(rawOptions: Record<string, unknown>, command?: Command): Promise<GenerateOptions> {
  const config = await readGenerateConfig(rawOptions.config as string | undefined);
  const hasExplicitValue = (key: string): boolean => {
    if (!command) return true;
    const source = command.getOptionValueSource(key);
    return source !== undefined && source !== 'default';
  };
  const hasConfigValue = (key: keyof GenerateConfig): boolean => config[key] !== undefined;
  const configValue = <T>(camel: keyof GenerateConfig, snake?: keyof GenerateConfig): T | undefined =>
    (config[camel] ?? (snake ? config[snake] : undefined)) as T | undefined;
  const rawValue = <T>(key: string, camel: keyof GenerateConfig, snake?: keyof GenerateConfig): T =>
    (hasExplicitValue(key) ? rawOptions[key] : configValue<T>(camel, snake) ?? rawOptions[key]) as T;

  const useCase = parseUseCase(rawValue<string | undefined>('useCase', 'useCase', 'use_case'));
  const preset = useCase ? USE_CASE_PRESETS[useCase] : undefined;
  const platform = parsePlatform(rawValue<string | undefined>('platform', 'platform'));
  const platformPreset = platform ? getPlatformPreset(platform) : undefined;
  const resolvePresetValue = <T>(key: keyof GenerateOptions, fallback: T): T => {
    if (hasExplicitValue(String(key)) || hasConfigValue(key as keyof GenerateConfig)) {
      return fallback;
    }
    return (preset?.defaults[key as keyof typeof preset.defaults] ?? platformPreset?.defaults[key as keyof typeof platformPreset.defaults] ?? fallback) as T;
  };
  const parsedPaymentRails = parsePaymentRailOption(rawValue<string[] | string | undefined>('paymentRails', 'paymentRails', 'payment_rails'));
  const country = resolvePresetValue('country', rawValue<string>('country', 'country'));
  const profile = rawValue<string | undefined>('profile', 'profile');
  const currencyFallback = hasExplicitValue('currency') || hasConfigValue('currency') || preset?.defaults.currency
    ? rawValue<string>('currency', 'currency')
    : getCountryProfile(country, profile).currency;

  const options: GenerateOptions = {
    users: resolvePresetValue('users', rawValue<number>('users', 'users')),
    fraudRate: resolvePresetValue('fraudRate', rawValue<number>('fraudRate', 'fraudRate', 'fraud_rate')),
    format: parseOutputFormat(rawValue<string>('format', 'format')),
    out: resolve(rawValue<string>('out', 'out')),
    country,
    currency: resolvePresetValue('currency', currencyFallback),
    profile,
    platform: platform as PlatformName | undefined,
    paymentRails: resolvePresetValue('paymentRails', parsedPaymentRails),
    patterns: parsePatternOption(resolvePresetValue('patterns', rawValue<string[] | string | undefined>('patterns', 'patterns'))),
    patternWeights: parsePatternWeightsOption(rawValue<Record<string, number> | string | undefined>('patternWeights', 'patternWeights', 'pattern_weights')),
    seed: rawValue<string | number | undefined>('seed', 'seed'),
    transactionsMin: resolvePresetValue('transactionsMin', rawValue<number>('transactionsMin', 'transactionsMin', 'transactions_min')),
    transactionsMax: resolvePresetValue('transactionsMax', rawValue<number>('transactionsMax', 'transactionsMax', 'transactions_max')),
    pretty: Boolean(rawValue<boolean>('pretty', 'pretty')),
    useCase: useCase as UseCaseName | undefined
  };

  validateGenerateOptions(options);
  return options;
}

function parsePatternWeightsOption(value: Record<string, number> | string | undefined): Partial<Record<FraudPattern, number>> | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--pattern-weights must be a JSON object');
  }
  return parsed as Partial<Record<FraudPattern, number>>;
}

async function readGenerateConfig(path?: string): Promise<GenerateConfig> {
  if (!path) return {};
  const raw = await readFile(resolve(path), 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--config must point to a JSON object');
  }
  return parsed as GenerateConfig;
}

function parsePatternOption(value: string[] | string | undefined) {
  if (Array.isArray(value)) {
    return parsePatterns(value.join(','));
  }
  return parsePatterns(value);
}

function parsePaymentRailOption(value: string[] | string | undefined) {
  if (Array.isArray(value)) {
    return parsePaymentRails(value.join(','));
  }
  return parsePaymentRails(value);
}

function parseIntegerOption(flag: string) {
  return (value: string): number => {
    try {
      return toInteger(value, flag);
    } catch (error) {
      throw new InvalidArgumentError(error instanceof Error ? error.message : String(error));
    }
  };
}

function parseNumberOption(flag: string) {
  return (value: string): number => {
    try {
      return toNumber(value, flag);
    } catch (error) {
      throw new InvalidArgumentError(error instanceof Error ? error.message : String(error));
    }
  };
}

function parseOutputFormatOption(value: string) {
  try {
    return parseOutputFormat(value);
  } catch (error) {
    throw new InvalidArgumentError(error instanceof Error ? error.message : String(error));
  }
}

function parseMlExportFormatOption(value: string) {
  const format = value.toLowerCase();
  if (format !== 'csv' && format !== 'json') {
    throw new InvalidArgumentError('--format must be one of: csv, json');
  }
  return format;
}

function parseRuleTemplateOption(value: string): 'aml' | 'app-fraud' | 'marketplace' {
  const template = value.toLowerCase();
  if (template !== 'aml' && template !== 'app-fraud' && template !== 'marketplace') {
    throw new InvalidArgumentError('--template must be one of: aml, app-fraud, marketplace');
  }
  return template;
}

function dirnameCompat(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return index <= 0 ? '.' : path.slice(0, index);
}

function parseSchemaTargetOption(value: string): SchemaTarget {
  const target = value.toLowerCase();
  if (
    target !== 'users' &&
    target !== 'accounts' &&
    target !== 'devices' &&
    target !== 'beneficiaries' &&
    target !== 'merchants' &&
    target !== 'transactions' &&
    target !== 'events' &&
    target !== 'summary' &&
    target !== 'all'
  ) {
    throw new InvalidArgumentError('--target must be one of: users, accounts, devices, beneficiaries, merchants, transactions, events, summary, all');
  }
  return target;
}

function parseBenchmarkSuiteOption(value: string): ReturnType<typeof parseBenchmarkSuite> {
  try {
    return parseBenchmarkSuite(value);
  } catch (error) {
    throw new InvalidArgumentError(error instanceof Error ? error.message : String(error));
  }
}

function parseReportFormatOption(value: string): ImpactReportFormat {
  const format = value.toLowerCase();
  if (format !== 'json' && format !== 'html') {
    throw new InvalidArgumentError('--format must be one of: json, html');
  }
  return format;
}

function parseGraphExportFormatOption(value: string): GraphExportFormat {
  const format = value.toLowerCase();
  if (format !== 'json' && format !== 'csv' && format !== 'cypher' && format !== 'graphml') {
    throw new InvalidArgumentError('--format must be one of: json, csv, cypher, graphml');
  }
  return format;
}

function parseMlExportTargetOption(value: string): MlExportTarget {
  const target = value.toLowerCase();
  if (target !== 'transactions' && target !== 'users') {
    throw new InvalidArgumentError('--target must be one of: transactions, users');
  }
  return target;
}
