#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { resolve } from 'node:path';
import { generateDataset } from './generator.js';
import { writeCsv } from './writers/csv.js';
import { writeJson } from './writers/json.js';
import { GenerateOptions } from './types.js';
import { parseOutputFormat, parsePatterns, toInteger, toNumber, validateGenerateOptions } from './utils.js';

const program = new Command();

program
  .name('fintech-fraud-sim')
  .description('Generate synthetic fintech users and transactions with configurable suspicious fraud patterns.')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate synthetic users, transactions, and a summary file.')
  .option('--users <number>', 'number of users to generate', parseIntegerOption('--users'), 1000)
  .option('--fraud-rate <number>', 'fraction of users to label as fraud, between 0 and 1', parseNumberOption('--fraud-rate'), 0.05)
  .option('--format <csv|json|both>', 'output format', 'both')
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
      const options: GenerateOptions = {
        users: rawOptions.users,
        fraudRate: rawOptions.fraudRate,
        format: parseOutputFormat(rawOptions.format),
        out: resolve(rawOptions.out),
        country: rawOptions.country,
        currency: rawOptions.currency,
        patterns: parsePatterns(rawOptions.patterns),
        seed: rawOptions.seed,
        transactionsMin: rawOptions.transactionsMin,
        transactionsMax: rawOptions.transactionsMax,
        pretty: rawOptions.pretty
      };

      validateGenerateOptions(options);
      const dataset = generateDataset(options);

      if (options.format === 'csv' || options.format === 'both') {
        await writeCsv(dataset, options.out);
      }
      if (options.format === 'json' || options.format === 'both') {
        await writeJson(dataset, options.out, options.pretty);
      }

      console.log(`Generated ${dataset.summary.total_users} users and ${dataset.summary.total_transactions} transactions in ${options.out}`);
      console.log(`Fraud users: ${dataset.summary.fraud_users_generated}; suspicious transactions: ${dataset.summary.suspicious_transactions_generated}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program.parseAsync();

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
