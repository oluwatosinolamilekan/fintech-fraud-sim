#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { generateDataset } from './generator.js';
import { getSchemas, writeSchemas } from './schemas.js';
import { writeCsv } from './writers/csv.js';
import { writeJson } from './writers/json.js';
import { writeNdjson } from './writers/ndjson.js';
import { writeSql } from './writers/sql.js';
import type { GenerateOptions, PaymentRail, PlatformName, UseCaseName } from './types.js';
import type { SchemaTarget } from './schemas.js';
import { parseOutputFormat, parsePatterns, parsePaymentRails, toInteger, toNumber, validateGenerateOptions } from './utils.js';
import { parseUseCase, USE_CASE_PRESETS } from './use-cases.js';
import { getPlatformPreset, listPlatformPresets, parsePlatform } from './platforms.js';
import { getCountryProfile, listCountryProfiles } from './country-profiles.js';

const program = new Command();
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };
const USE_CASE_HELP = 'preset for consumer_fintech, social_payments, crypto_exchange, marketplace_trust, bank_aml, or bnpl_credit';
type GenerateConfig = Partial<Omit<GenerateOptions, 'patterns' | 'paymentRails'>> & {
  fraud_rate?: number;
  use_case?: string;
  transactions_min?: number;
  transactions_max?: number;
  payment_rails?: string[] | string;
  patterns?: string[] | string;
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
  .option('--format <csv|json|ndjson|sql|both|all>', 'output format', 'both')
  .option('--out <path>', 'output directory', './output')
  .option('--config <path>', 'JSON config file with generation options')
  .option('--country <code>', 'default 2-letter country code', 'NG')
  .option('--currency <code>', 'transaction currency code', 'NGN')
  .option('--profile <code>', 'country profile code to use for local payment, KYC, and merchant behavior')
  .option('--platform <name>', 'platform preset for fintech, marketplace, crypto, social, gaming, lending, or remittance')
  .option('--payment-rails <list>', 'comma-separated payment rails to emit')
  .option('--patterns <list>', 'comma-separated fraud patterns, or all', 'all')
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
  .command('schema')
  .description('Print or export JSON Schema files for generated data.')
  .option('--target <users|accounts|devices|beneficiaries|merchants|transactions|summary|all>', 'schema target', parseSchemaTargetOption, 'all')
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
    seed: rawValue<string | number | undefined>('seed', 'seed'),
    transactionsMin: resolvePresetValue('transactionsMin', rawValue<number>('transactionsMin', 'transactionsMin', 'transactions_min')),
    transactionsMax: resolvePresetValue('transactionsMax', rawValue<number>('transactionsMax', 'transactionsMax', 'transactions_max')),
    pretty: Boolean(rawValue<boolean>('pretty', 'pretty')),
    useCase: useCase as UseCaseName | undefined
  };

  validateGenerateOptions(options);
  return options;
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

function parseSchemaTargetOption(value: string): SchemaTarget {
  const target = value.toLowerCase();
  if (
    target !== 'users' &&
    target !== 'accounts' &&
    target !== 'devices' &&
    target !== 'beneficiaries' &&
    target !== 'merchants' &&
    target !== 'transactions' &&
    target !== 'summary' &&
    target !== 'all'
  ) {
    throw new InvalidArgumentError('--target must be one of: users, accounts, devices, beneficiaries, merchants, transactions, summary, all');
  }
  return target;
}
