#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { generateDataset } from './generator.js';
import { getSchemas, writeSchemas } from './schemas.js';
import { writeCsv } from './writers/csv.js';
import { writeJson } from './writers/json.js';
import { writeNdjson } from './writers/ndjson.js';
import { writeSql } from './writers/sql.js';
import { GenerateOptions } from './types.js';
import type { SchemaTarget } from './schemas.js';
import { parseOutputFormat, parsePatterns, toInteger, toNumber, validateGenerateOptions } from './utils.js';

const program = new Command();
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

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
  .option('--country <code>', 'default 2-letter country code', 'NG')
  .option('--currency <code>', 'transaction currency code', 'NGN')
  .option('--patterns <list>', 'comma-separated fraud patterns, or all', 'all')
  .option('--seed <value>', 'string or number seed for deterministic output')
  .option('--transactions-min <number>', 'minimum transactions per non-fraud user', parseIntegerOption('--transactions-min'), 1)
  .option('--transactions-max <number>', 'maximum transactions per non-fraud user', parseIntegerOption('--transactions-max'), 20)
  .option('--pretty', 'write formatted JSON output', false)
  .action(async (rawOptions) => {
    try {
      const options = buildGenerateOptions(rawOptions);
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
  .option('--patterns <list>', 'comma-separated fraud patterns, or all', 'all')
  .option('--seed <value>', 'string or number seed for deterministic output')
  .option('--transactions-min <number>', 'minimum transactions per non-fraud user', parseIntegerOption('--transactions-min'), 1)
  .option('--transactions-max <number>', 'maximum transactions per non-fraud user', parseIntegerOption('--transactions-max'), 20)
  .option('--limit <number>', 'number of sample users and transactions to print', parseIntegerOption('--limit'), 5)
  .option('--pretty', 'write formatted JSON output', false)
  .action((rawOptions) => {
    try {
      const options = buildGenerateOptions({ ...rawOptions, format: 'json', out: './output' });
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

function buildGenerateOptions(rawOptions: Record<string, unknown>): GenerateOptions {
  const options: GenerateOptions = {
    users: rawOptions.users as number,
    fraudRate: rawOptions.fraudRate as number,
    format: parseOutputFormat(rawOptions.format as string),
    out: resolve(rawOptions.out as string),
    country: rawOptions.country as string,
    currency: rawOptions.currency as string,
    patterns: parsePatterns(rawOptions.patterns as string),
    seed: rawOptions.seed as string | number | undefined,
    transactionsMin: rawOptions.transactionsMin as number,
    transactionsMax: rawOptions.transactionsMax as number,
    pretty: Boolean(rawOptions.pretty)
  };

  validateGenerateOptions(options);
  return options;
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
