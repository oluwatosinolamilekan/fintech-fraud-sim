import type { BuiltInPlatformName, GenerationPlugin, PlatformName, PlatformPreset } from './types.js';

export const PLATFORM_NAMES = [
  'fintech',
  'marketplace',
  'crypto',
  'social',
  'gaming',
  'lending',
  'remittance'
] as const satisfies readonly BuiltInPlatformName[];

const builtInPresets: Record<BuiltInPlatformName, PlatformPreset> = {
  fintech: {
    name: 'fintech',
    label: 'Fintech wallet and banking',
    description: 'Wallet, account, transfer, card, and merchant-payment risk simulation.',
    merchantCategories: ['airtime', 'bill_payments', 'ecommerce', 'groceries', 'travel'],
    defaults: {
      fraudRate: 0.08,
      patterns: ['mule_account', 'account_takeover', 'velocity_abuse', 'beneficiary_burst'],
      transactionsMin: 2,
      transactionsMax: 24,
      paymentRails: ['bank_transfer', 'wallet_transfer', 'card', 'merchant_payment']
    }
  },
  marketplace: {
    name: 'marketplace',
    label: 'Marketplace trust and safety',
    description: 'Buyer, seller, refund, payout, and chargeback-risk simulation.',
    merchantCategories: ['ecommerce', 'groceries', 'travel', 'digital_goods'],
    defaults: {
      fraudRate: 0.07,
      patterns: ['chargeback_risk', 'transaction_spike', 'account_takeover', 'velocity_abuse'],
      transactionsMin: 1,
      transactionsMax: 22,
      paymentRails: ['card', 'bank_transfer', 'payout', 'merchant_payment']
    }
  },
  crypto: {
    name: 'crypto',
    label: 'Crypto exchange and wallet',
    description: 'Fiat on-ramp, withdrawal, wallet, and AML-oriented crypto risk simulation.',
    merchantCategories: ['digital_goods', 'gaming', 'remittance'],
    defaults: {
      fraudRate: 0.12,
      patterns: ['cross_border_anomaly', 'mule_account', 'kyc_abuse', 'transaction_spike', 'velocity_abuse'],
      transactionsMin: 2,
      transactionsMax: 35,
      paymentRails: ['crypto_wallet', 'bank_transfer', 'card', 'swift']
    }
  },
  social: {
    name: 'social',
    label: 'Social payments and creator payouts',
    description: 'Creator monetization, peer payments, account takeover, and payout abuse simulation.',
    merchantCategories: ['creator_payout', 'digital_goods', 'gaming'],
    defaults: {
      fraudRate: 0.06,
      patterns: ['account_takeover', 'velocity_abuse', 'beneficiary_burst', 'cross_border_anomaly'],
      transactionsMin: 1,
      transactionsMax: 18,
      paymentRails: ['wallet_transfer', 'payout', 'card', 'bank_transfer']
    }
  },
  gaming: {
    name: 'gaming',
    label: 'Gaming and digital goods',
    description: 'Wallet top-ups, digital goods, chargebacks, and high-velocity microtransaction simulation.',
    merchantCategories: ['gaming', 'digital_goods'],
    defaults: {
      fraudRate: 0.1,
      patterns: ['velocity_abuse', 'chargeback_risk', 'account_takeover', 'transaction_spike'],
      transactionsMin: 3,
      transactionsMax: 40,
      paymentRails: ['card', 'wallet_transfer', 'merchant_payment']
    }
  },
  lending: {
    name: 'lending',
    label: 'Lending and BNPL',
    description: 'Loan, credit, repayment, chargeback, and synthetic KYC abuse simulation.',
    merchantCategories: ['lending', 'ecommerce', 'bill_payments'],
    defaults: {
      fraudRate: 0.09,
      patterns: ['kyc_abuse', 'chargeback_risk', 'transaction_spike', 'account_takeover'],
      transactionsMin: 1,
      transactionsMax: 16,
      paymentRails: ['bank_transfer', 'card', 'ach', 'sepa']
    }
  },
  remittance: {
    name: 'remittance',
    label: 'Remittance and cross-border payments',
    description: 'Corridor, cashout, cross-border, beneficiary, and mule-account simulation.',
    merchantCategories: ['remittance', 'bill_payments'],
    defaults: {
      fraudRate: 0.11,
      patterns: ['cross_border_anomaly', 'mule_account', 'beneficiary_burst', 'transaction_spike'],
      transactionsMin: 2,
      transactionsMax: 28,
      paymentRails: ['swift', 'mobile_money', 'cashout', 'bank_transfer', 'wallet_transfer']
    }
  }
};

const registeredPresets = new Map<PlatformName, PlatformPreset>();

export function parsePlatform(value?: string): PlatformName | undefined {
  if (!value || value.trim() === '') return undefined;
  const normalized = value.trim().toLowerCase().replace(/-/g, '_') as PlatformName;
  if (!PLATFORM_NAMES.includes(normalized as BuiltInPlatformName) && !registeredPresets.has(normalized)) {
    throw new Error(`Unknown platform: ${value}. Allowed platforms: ${availablePlatformNames().join(', ')}`);
  }
  return normalized;
}

export function registerPlatformPreset(preset: PlatformPreset): void {
  registeredPresets.set(preset.name, preset);
}

export function registerPlatformPresetsFromPlugin(plugin: GenerationPlugin): void {
  for (const preset of plugin.platformPresets ?? []) {
    registerPlatformPreset(preset);
  }
}

export function getPlatformPreset(platform: PlatformName): PlatformPreset {
  const builtIn = builtInPresets[platform as BuiltInPlatformName];
  const preset = registeredPresets.get(platform) ?? builtIn;
  if (!preset) {
    throw new Error(`Unknown platform: ${platform}. Allowed platforms: ${availablePlatformNames().join(', ')}`);
  }
  return preset;
}

export function listPlatformPresets(): PlatformPreset[] {
  return [...Object.values(builtInPresets), ...registeredPresets.values()];
}

function availablePlatformNames(): string[] {
  return listPlatformPresets().map((preset) => preset.name);
}
