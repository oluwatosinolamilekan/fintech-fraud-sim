import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';
import { generateDataset } from '../dist/generator.js';
import { exportMlTrainingDataset } from '../dist/ml-export.js';
import { validateDataset } from '../dist/validate.js';
import { writeJson } from '../dist/writers/json.js';

const exec = promisify(execFile);
const cli = join(process.cwd(), 'dist', 'cli.js');

describe('fraud ops v0.4 features', () => {
  it('supports weighted patterns and emits event streams', () => {
    const dataset = generateDataset({
      users: 80,
      fraudRate: 0.5,
      format: 'json',
      out: './output',
      country: 'GB',
      currency: 'GBP',
      patterns: ['mule_account', 'structuring'],
      patternWeights: { structuring: 50, mule_account: 0 },
      seed: 'weighted-patterns',
      transactionsMin: 1,
      transactionsMax: 3,
      pretty: false
    });

    assert.ok(dataset.users.filter((user) => user.is_fraud).every((user) => user.fraud_pattern === 'structuring'));
    assert.ok(dataset.events.length > dataset.transactions.length);
    assert.ok(dataset.events.some((event) => event.event_type === 'transaction_created'));
  });

  it('validates generated datasets', () => {
    const dataset = generateDataset({
      users: 20,
      fraudRate: 0.2,
      format: 'json',
      out: './output',
      country: 'NG',
      currency: 'NGN',
      patterns: ['synthetic_identity', 'layering'],
      seed: 'validate-feature',
      transactionsMin: 1,
      transactionsMax: 3,
      pretty: false
    });

    const result = validateDataset(dataset);
    assert.equal(result.valid, true);
    assert.equal(result.errors, 0);
    assert.equal(result.totals.events, dataset.events.length);
  });

  it('exports ML JSON with validation split and leakage fields when requested', async () => {
    const input = await mkdtemp(join(tmpdir(), 'fintech-fraud-sim-v4-input-'));
    const out = await mkdtemp(join(tmpdir(), 'fintech-fraud-sim-v4-ml-'));

    try {
      const dataset = generateDataset({
        users: 50,
        fraudRate: 0.2,
        format: 'json',
        out: input,
        country: 'US',
        currency: 'USD',
        patterns: ['friendly_fraud', 'promo_abuse'],
        seed: 'ml-v4',
        transactionsMin: 2,
        transactionsMax: 4,
        pretty: false
      });
      await writeJson(dataset, input);

      const result = await exportMlTrainingDataset({
        input,
        out,
        target: 'transactions',
        format: 'json',
        split: 0.7,
        validationSplit: 0.15,
        stratify: true,
        includeLeakageFields: true,
        seed: 'ml-v4-split'
      });
      const validation = JSON.parse(await readFile(join(out, 'X_validation.json'), 'utf8'));

      assert.equal(result.metadata.stratified, true);
      assert.ok(result.metadata.features.includes('risk_score'));
      assert.ok(validation.length > 0);
    } finally {
      await rm(input, { recursive: true, force: true });
      await rm(out, { recursive: true, force: true });
    }
  });

  it('writes rule templates and validates output directories from the CLI', async () => {
    const out = await mkdtemp(join(tmpdir(), 'fintech-fraud-sim-v4-cli-'));

    try {
      await exec(process.execPath, [cli, 'generate', '--users', '12', '--fraud-rate', '0.25', '--format', 'json', '--out', out, '--seed', 'cli-v4']);
      const validation = await exec(process.execPath, [cli, 'validate', '--input', out, '--pretty']);
      const parsedValidation = JSON.parse(validation.stdout);
      assert.equal(parsedValidation.valid, true);

      const rulePath = join(out, 'marketplace-rules.json');
      await exec(process.execPath, [cli, 'rules-init', '--template', 'marketplace', '--out', rulePath]);
      const template = JSON.parse(await readFile(rulePath, 'utf8'));
      assert.equal(template.name, 'marketplace-trust-starter');
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});
