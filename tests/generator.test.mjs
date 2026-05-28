import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateDataset } from '../dist/generator.js';
import { defineGenerationPlugin, registerGenerationPlugin } from '../dist/plugins.js';

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
    assert.equal(dataset.accounts.length, 100);
    assert.ok(dataset.devices.length >= 100);
    assert.ok(dataset.beneficiaries.length >= 100);
    assert.ok(dataset.merchants.length > 0);
    assert.ok(dataset.transactions.length >= 100);
    assert.equal(dataset.summary.total_users, 100);
    assert.equal(dataset.summary.total_accounts, dataset.accounts.length);
    assert.equal(dataset.summary.total_devices, dataset.devices.length);
    assert.equal(dataset.summary.total_beneficiaries, dataset.beneficiaries.length);
    assert.equal(dataset.summary.total_merchants, dataset.merchants.length);
    assert.equal(dataset.summary.fraud_rate_requested, 0.1);
    assert.equal(dataset.summary.use_case, null);
    assert.equal(dataset.summary.fraud_users_generated, 10);
    assert.ok(dataset.summary.suspicious_transactions_generated > 0);
    assert.equal(dataset.users.every((user) => Number.isInteger(user.risk_score)), true);
    assert.equal(dataset.users.every((user) => ['allow', 'review', 'block'].includes(user.recommended_action)), true);
    assert.equal(dataset.transactions.every((transaction) => Number.isInteger(transaction.risk_score)), true);
    assert.equal(
      dataset.transactions.every((transaction) => ['allow', 'review', 'block'].includes(transaction.recommended_action)),
      true
    );
    assert.equal(dataset.transactions.every((transaction) => transaction.account_id && transaction.merchant_id), true);
    assert.equal(dataset.users.every((user) => user.identity_type && user.kyc_provider), true);
    assert.equal(dataset.transactions.every((transaction) => transaction.payment_rail), true);
  });

  it('generates deterministic output when seed is provided', () => {
    const first = generateDataset(baseOptions);
    const second = generateDataset(baseOptions);

    assert.deepEqual(second, first);
  });

  it('honors zero fraud rate', () => {
    const dataset = generateDataset({ ...baseOptions, fraudRate: 0 });

    assert.equal(dataset.summary.fraud_users_generated, 0);
    assert.equal(dataset.summary.fraud_networks_generated, 0);
    assert.equal(dataset.summary.networked_fraud_users_generated, 0);
    assert.equal(dataset.users.every((user) => !user.is_fraud), true);
    assert.equal(dataset.transactions.every((transaction) => !transaction.is_suspicious), true);
  });

  it('generates fraud rings with shared network entities', () => {
    const dataset = generateDataset({
      ...baseOptions,
      users: 30,
      fraudRate: 0.4,
      patterns: ['fraud_ring'],
      seed: 'fraud-ring-test',
      transactionsMin: 1,
      transactionsMax: 4
    });

    const networkedUsers = dataset.users.filter((user) => user.network_id);
    const networkedDevices = dataset.devices.filter((device) => device.network_id);
    const networkedBeneficiaries = dataset.beneficiaries.filter((beneficiary) => beneficiary.network_id);
    const networkedTransactions = dataset.transactions.filter((transaction) => transaction.network_id);
    const networkIds = new Set(networkedUsers.map((user) => user.network_id));

    assert.ok(dataset.summary.fraud_networks_generated > 0);
    assert.equal(dataset.summary.networked_fraud_users_generated, networkedUsers.length);
    assert.ok(networkedUsers.length >= 2);
    assert.ok(networkedDevices.length > 0);
    assert.ok(networkedBeneficiaries.length > 0);
    assert.ok(networkedTransactions.length > 0);
    assert.equal([...networkIds].every((networkId) => networkedUsers.filter((user) => user.network_id === networkId).length >= 2), true);
    assert.equal(networkedTransactions.every((transaction) => networkIds.has(transaction.network_id)), true);
  });

  it('validates fraud rate range', () => {
    assert.throws(() => generateDataset({ ...baseOptions, fraudRate: 1.2 }), /--fraud-rate/);
  });

  it('applies country profiles and platform presets', () => {
    const dataset = generateDataset({
      ...baseOptions,
      country: 'KE',
      currency: 'KES',
      platform: 'remittance',
      seed: 'global-case'
    });

    assert.equal(dataset.summary.country_profile, 'KE');
    assert.equal(dataset.summary.platform, 'remittance');
    assert.equal(dataset.users.every((user) => ['national_id', 'mobile_money_id', 'passport'].includes(user.identity_type)), true);
    assert.equal(dataset.transactions.some((transaction) => ['mobile_money', 'cashout', 'swift'].includes(transaction.payment_rail)), true);
  });

  it('allows plugins to register custom country profiles and platform presets', () => {
    registerGenerationPlugin(defineGenerationPlugin({
      name: 'unit-test-global-pack',
      countryProfiles: [{
        code: 'ZZ',
        label: 'Unit Test Region',
        currency: 'ZZD',
        channels: ['api', 'web'],
        paymentRails: ['crypto_wallet', 'payout'],
        accountTypes: ['crypto', 'wallet'],
        beneficiaryTypes: ['crypto_wallet', 'wallet'],
        merchantCategories: ['digital_goods'],
        identityTypes: ['passport', 'tax_id'],
        kycProviders: ['synthetic_unit_check'],
        bankCodeLength: 4
      }],
      platformPresets: [{
        name: 'creator_tokens',
        label: 'Creator token payouts',
        description: 'Synthetic creator token payout simulation.',
        merchantCategories: ['creator_payout', 'digital_goods'],
        defaults: {
          fraudRate: 0.2,
          patterns: ['account_takeover'],
          transactionsMin: 1,
          transactionsMax: 2,
          paymentRails: ['crypto_wallet', 'payout']
        }
      }]
    }));

    const dataset = generateDataset({
      ...baseOptions,
      users: 10,
      country: 'ZZ',
      currency: 'ZZD',
      platform: 'creator_tokens',
      seed: 'plugin-test'
    });

    assert.equal(dataset.summary.country_profile, 'ZZ');
    assert.equal(dataset.summary.platform, 'creator_tokens');
    assert.equal(dataset.users.every((user) => user.kyc_provider === 'synthetic_unit_check'), true);
    assert.equal(dataset.transactions.every((transaction) => ['crypto_wallet', 'payout'].includes(transaction.payment_rail)), true);
  });
});
