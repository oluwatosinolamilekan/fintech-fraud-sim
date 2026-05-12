import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateDataset } from '../dist/generator.js';

const baseOptions = {
  users: 100,
  fraudRate: 0.1,
  format: 'both',
  out: './output',
  country: 'NG',
  currency: 'NGN',
  patterns: ['mule_account', 'account_takeover', 'velocity_abuse'],
  seed: 'unit-seed',
  transactionsMin: 1,
  transactionsMax: 5,
  pretty: false
};

describe('generateDataset', () => {
  it('generates users, transactions, and summary totals', () => {
    const dataset = generateDataset(baseOptions);

    assert.equal(dataset.users.length, 100);
    assert.ok(dataset.transactions.length >= 100);
    assert.equal(dataset.summary.total_users, 100);
    assert.equal(dataset.summary.fraud_rate_requested, 0.1);
    assert.equal(dataset.summary.fraud_users_generated, 10);
    assert.ok(dataset.summary.suspicious_transactions_generated > 0);
  });

  it('generates deterministic output when seed is provided', () => {
    const first = generateDataset(baseOptions);
    const second = generateDataset(baseOptions);

    assert.deepEqual(second, first);
  });

  it('honors zero fraud rate', () => {
    const dataset = generateDataset({ ...baseOptions, fraudRate: 0 });

    assert.equal(dataset.summary.fraud_users_generated, 0);
    assert.equal(dataset.users.every((user) => !user.is_fraud), true);
    assert.equal(dataset.transactions.every((transaction) => !transaction.is_suspicious), true);
  });

  it('validates fraud rate range', () => {
    assert.throws(() => generateDataset({ ...baseOptions, fraudRate: 1.2 }), /--fraud-rate/);
  });
});
