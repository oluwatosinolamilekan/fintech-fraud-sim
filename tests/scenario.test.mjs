import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inferScenarioFromPrompt } from '../dist/scenario.js';

describe('AI scenario generation', () => {
  it('infers a remittance mule scenario from natural language', () => {
    const plan = inferScenarioFromPrompt('UK-Nigeria remittance mule cashout with beneficiary bursts', {
      users: 50,
      seed: 'scenario-test'
    });

    assert.equal(plan.options.users, 50);
    assert.equal(plan.options.country, 'GB');
    assert.equal(plan.options.currency, 'GBP');
    assert.equal(plan.options.platform, 'remittance');
    assert.ok(plan.options.patterns.includes('mule_account'));
    assert.ok(plan.options.patterns.includes('beneficiary_burst'));
    assert.ok(plan.options.patterns.includes('cross_border_anomaly'));
    assert.ok(plan.inferred_signals.includes('payment_rail:cashout'));
  });

  it('raises intensity for adversarial scenarios', () => {
    const plan = inferScenarioFromPrompt('adversarial crypto exchange KYC abuse and cross-border withdrawal risk');

    assert.equal(plan.options.platform, 'crypto');
    assert.equal(plan.options.useCase, 'crypto_exchange');
    assert.equal(plan.options.fraudRate, 0.14);
    assert.equal(plan.options.transactionsMax, 45);
    assert.ok(plan.options.patterns.includes('kyc_abuse'));
    assert.ok(plan.options.patterns.includes('cross_border_anomaly'));
  });
});
