import { FRAUD_PATTERNS } from './types.js';
import type { FraudPattern, GenerateOptions, UseCaseName } from './types.js';

export interface UseCasePreset {
  name: UseCaseName;
  label: string;
  platformExamples: string[];
  description: string;
  defaults: Pick<
    GenerateOptions,
    'users' | 'fraudRate' | 'country' | 'currency' | 'patterns' | 'transactionsMin' | 'transactionsMax'
  >;
}

export const USE_CASE_NAMES = [
  'consumer_fintech',
  'social_payments',
  'crypto_exchange',
  'marketplace_trust',
  'bank_aml',
  'bnpl_credit'
] as const satisfies readonly UseCaseName[];

export const USE_CASE_PRESETS: Record<UseCaseName, UseCasePreset> = {
  consumer_fintech: {
    name: 'consumer_fintech',
    label: 'Consumer fintech wallet',
    platformExamples: ['neobank', 'wallet app', 'card issuing app', 'mobile money app'],
    description: 'General wallet, transfer, and card-risk simulation for fraud rules, case queues, and QA fixtures.',
    defaults: {
      users: 5000,
      fraudRate: 0.08,
      country: 'NG',
      currency: 'NGN',
      patterns: ['mule_account', 'account_takeover', 'velocity_abuse', 'beneficiary_burst'],
      transactionsMin: 2,
      transactionsMax: 25
    }
  },
  social_payments: {
    name: 'social_payments',
    label: 'Social platform payments',
    platformExamples: ['Meta-style social commerce', 'X/Twitter-style creator payments', 'messaging app wallet'],
    description: 'Account takeover, payout abuse, and high-velocity payment behavior for social and creator platforms.',
    defaults: {
      users: 8000,
      fraudRate: 0.06,
      country: 'US',
      currency: 'USD',
      patterns: ['account_takeover', 'velocity_abuse', 'beneficiary_burst', 'cross_border_anomaly'],
      transactionsMin: 1,
      transactionsMax: 18
    }
  },
  crypto_exchange: {
    name: 'crypto_exchange',
    label: 'Crypto exchange AML',
    platformExamples: ['centralized crypto exchange', 'wallet on-ramp', 'stablecoin payments app'],
    description: 'Cross-border anomalies, mule behavior, KYC abuse, and transaction spikes for AML and withdrawal-risk testing.',
    defaults: {
      users: 10000,
      fraudRate: 0.12,
      country: 'US',
      currency: 'USD',
      patterns: ['cross_border_anomaly', 'mule_account', 'kyc_abuse', 'transaction_spike', 'velocity_abuse'],
      transactionsMin: 2,
      transactionsMax: 35
    }
  },
  marketplace_trust: {
    name: 'marketplace_trust',
    label: 'Marketplace trust and safety',
    platformExamples: ['ecommerce marketplace', 'delivery marketplace', 'gig platform', 'classifieds app'],
    description: 'Seller, buyer, payout, refund, and chargeback-risk simulation for marketplace trust systems.',
    defaults: {
      users: 7000,
      fraudRate: 0.07,
      country: 'GB',
      currency: 'GBP',
      patterns: ['chargeback_risk', 'transaction_spike', 'account_takeover', 'velocity_abuse'],
      transactionsMin: 1,
      transactionsMax: 22
    }
  },
  bank_aml: {
    name: 'bank_aml',
    label: 'Bank AML monitoring',
    platformExamples: ['retail bank', 'business bank', 'core banking QA', 'AML vendor integration'],
    description: 'Mule accounts, beneficiary bursts, and cross-border movement for monitoring, SAR triage, and audit demos.',
    defaults: {
      users: 12000,
      fraudRate: 0.1,
      country: 'NG',
      currency: 'NGN',
      patterns: ['mule_account', 'beneficiary_burst', 'cross_border_anomaly', 'transaction_spike'],
      transactionsMin: 3,
      transactionsMax: 30
    }
  },
  bnpl_credit: {
    name: 'bnpl_credit',
    label: 'BNPL and credit risk',
    platformExamples: ['BNPL checkout', 'consumer lending app', 'merchant financing product'],
    description: 'Chargeback, transaction spike, and identity/KYC abuse signals for credit-risk and repayment workflows.',
    defaults: {
      users: 6000,
      fraudRate: 0.09,
      country: 'US',
      currency: 'USD',
      patterns: ['chargeback_risk', 'transaction_spike', 'kyc_abuse', 'account_takeover'],
      transactionsMin: 1,
      transactionsMax: 16
    }
  }
};

export function parseUseCase(value?: string): UseCaseName | undefined {
  if (!value || value.trim() === '') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replace(/-/g, '_');
  if (!USE_CASE_NAMES.includes(normalized as UseCaseName)) {
    throw new Error(`Unknown use case: ${value}. Allowed use cases: ${USE_CASE_NAMES.join(', ')}`);
  }
  return normalized as UseCaseName;
}

export function patternsForUseCase(useCase: UseCaseName): FraudPattern[] {
  return [...USE_CASE_PRESETS[useCase].defaults.patterns];
}

export function allPatterns(): FraudPattern[] {
  return [...FRAUD_PATTERNS];
}
