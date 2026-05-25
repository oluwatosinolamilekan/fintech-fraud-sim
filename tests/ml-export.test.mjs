import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { generateDataset } from '../dist/generator.js';
import { exportMlTrainingDataset } from '../dist/ml-export.js';
import { writeJson } from '../dist/writers/json.js';

describe('ML training export', () => {
  it('exports transaction train/test feature matrices and labels', async () => {
    const input = await mkdtemp(join(tmpdir(), 'fintech-fraud-sim-ml-input-'));
    const out = await mkdtemp(join(tmpdir(), 'fintech-fraud-sim-ml-out-'));

    try {
      const dataset = generateDataset({
        users: 40,
        fraudRate: 0.2,
        format: 'json',
        out: input,
        country: 'GB',
        currency: 'GBP',
        patterns: ['mule_account', 'account_takeover', 'velocity_abuse'],
        seed: 'ml-export-test',
        transactionsMin: 2,
        transactionsMax: 6,
        pretty: false
      });
      await writeJson(dataset, input);

      const result = await exportMlTrainingDataset({
        input,
        out,
        target: 'transactions',
        split: 0.75,
        seed: 'split-test'
      });
      const xTrain = await readFile(join(out, 'X_train.csv'), 'utf8');
      const yTrain = await readFile(join(out, 'y_train.csv'), 'utf8');
      const metadata = JSON.parse(await readFile(join(out, 'feature_metadata.json'), 'utf8'));

      assert.equal(result.metadata.target, 'transactions');
      assert.equal(metadata.label_column, 'is_suspicious');
      assert.ok(metadata.features.includes('amount'));
      assert.ok(metadata.features.some((feature) => feature.startsWith('payment_rail_')));
      assert.match(xTrain.split('\n')[0], /^row_id,/);
      assert.match(yTrain.split('\n')[0], /^row_id,label$/);
      assert.equal(metadata.train_rows + metadata.test_rows, dataset.transactions.length);
    } finally {
      await rm(input, { recursive: true, force: true });
      await rm(out, { recursive: true, force: true });
    }
  });

  it('exports user fraud labels without leaking target fields', async () => {
    const input = await mkdtemp(join(tmpdir(), 'fintech-fraud-sim-ml-users-input-'));
    const out = await mkdtemp(join(tmpdir(), 'fintech-fraud-sim-ml-users-out-'));

    try {
      const dataset = generateDataset({
        users: 20,
        fraudRate: 0.25,
        format: 'json',
        out: input,
        country: 'NG',
        currency: 'NGN',
        patterns: ['kyc_abuse', 'beneficiary_burst'],
        seed: 'ml-user-export-test',
        transactionsMin: 1,
        transactionsMax: 3,
        pretty: false
      });
      await writeJson(dataset, input);

      const result = await exportMlTrainingDataset({
        input,
        out,
        target: 'users',
        split: 0.8
      });

      assert.equal(result.metadata.label_column, 'is_fraud');
      assert.ok(result.metadata.features.includes('account_age_days'));
      assert.equal(result.metadata.features.includes('fraud_pattern'), false);
      assert.equal(result.metadata.features.includes('risk_score'), false);
      assert.equal(result.metadata.train_rows + result.metadata.test_rows, dataset.users.length);
    } finally {
      await rm(input, { recursive: true, force: true });
      await rm(out, { recursive: true, force: true });
    }
  });
});
