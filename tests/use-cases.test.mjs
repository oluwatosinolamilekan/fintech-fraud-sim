import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateDataset } from '../dist/generator.js';
import { parseUseCase, USE_CASE_PRESETS } from '../dist/use-cases.js';

describe('use case presets', () => {
  it('parses canonical and kebab-case use case names', () => {
    assert.equal(parseUseCase('crypto_exchange'), 'crypto_exchange');
    assert.equal(parseUseCase('social-payments'), 'social_payments');
  });

  it('generates a crypto exchange dataset from preset defaults', () => {
    const preset = USE_CASE_PRESETS.crypto_exchange;
    const dataset = generateDataset({
      ...preset.defaults,
      format: 'json',
      out: './output',
      seed: 'crypto-case',
      pretty: false,
      useCase: preset.name
    });

    assert.equal(dataset.summary.use_case, 'crypto_exchange');
    assert.equal(dataset.summary.total_users, preset.defaults.users);
    assert.equal(dataset.summary.fraud_rate_requested, preset.defaults.fraudRate);
    assert.ok(Object.keys(dataset.summary.fraud_pattern_breakdown).some((pattern) => preset.defaults.patterns.includes(pattern)));
  });

  it('exposes platform examples for big-tech and fintech teams', () => {
    assert.ok(USE_CASE_PRESETS.social_payments.platformExamples.some((example) => example.includes('Meta')));
    assert.ok(USE_CASE_PRESETS.crypto_exchange.platformExamples.some((example) => example.includes('exchange')));
    assert.ok(USE_CASE_PRESETS.marketplace_trust.platformExamples.some((example) => example.includes('marketplace')));
  });
});
