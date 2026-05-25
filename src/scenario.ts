import type { FraudPattern, GenerateOptions, OutputFormat, PaymentRail, PlatformName, UseCaseName } from './types.js';

export interface ScenarioOverrides {
  users?: number;
  fraudRate?: number;
  format?: OutputFormat;
  out?: string;
  seed?: string | number;
  pretty?: boolean;
}

export interface ScenarioPlan {
  prompt: string;
  title: string;
  summary: string;
  inferred_signals: string[];
  rationale: string[];
  options: GenerateOptions;
}

interface ScenarioTemplate {
  title: string;
  summary: string;
  users: number;
  fraudRate: number;
  country: string;
  currency: string;
  platform?: PlatformName;
  useCase?: UseCaseName;
  paymentRails?: PaymentRail[];
  patterns: FraudPattern[];
  transactionsMin: number;
  transactionsMax: number;
}

const DEFAULT_TEMPLATE: ScenarioTemplate = {
  title: 'AI-inferred fintech fraud scenario',
  summary: 'General fintech fraud simulation inferred from natural language.',
  users: 2500,
  fraudRate: 0.08,
  country: 'NG',
  currency: 'NGN',
  platform: 'fintech',
  useCase: 'consumer_fintech',
  paymentRails: ['bank_transfer', 'wallet_transfer', 'card', 'merchant_payment'],
  patterns: ['mule_account', 'account_takeover', 'velocity_abuse', 'beneficiary_burst'],
  transactionsMin: 2,
  transactionsMax: 24
};

export function inferScenarioFromPrompt(prompt: string, overrides: ScenarioOverrides = {}): ScenarioPlan {
  const normalizedPrompt = normalizePrompt(prompt);
  if (normalizedPrompt.length === 0) {
    throw new Error('Scenario prompt cannot be empty');
  }

  const template = buildTemplate(normalizedPrompt);
  const explicitPatterns = inferPatterns(normalizedPrompt);
  const intensity = inferIntensity(normalizedPrompt);
  const options: GenerateOptions = {
    users: overrides.users ?? template.users,
    fraudRate: overrides.fraudRate ?? intensity.fraudRate ?? template.fraudRate,
    format: overrides.format ?? 'json',
    out: overrides.out ?? './scenario-output',
    country: template.country,
    currency: template.currency,
    profile: template.country,
    platform: template.platform,
    paymentRails: template.paymentRails,
    patterns: explicitPatterns.length > 0 ? explicitPatterns : template.patterns,
    seed: overrides.seed,
    transactionsMin: template.transactionsMin,
    transactionsMax: intensity.transactionsMax ?? template.transactionsMax,
    pretty: overrides.pretty ?? false,
    useCase: template.useCase
  };

  return {
    prompt,
    title: template.title,
    summary: template.summary,
    inferred_signals: inferSignals(normalizedPrompt, options),
    rationale: buildRationale(normalizedPrompt, options, intensity.label),
    options
  };
}

function buildTemplate(prompt: string): ScenarioTemplate {
  if (hasAny(prompt, ['crypto', 'stablecoin', 'wallet on-ramp', 'on ramp', 'exchange', 'withdrawal'])) {
    return {
      title: 'AI-inferred crypto exchange AML scenario',
      summary: 'Crypto exchange and wallet risk simulation with KYC, withdrawal, velocity, and cross-border signals.',
      users: 4000,
      fraudRate: 0.12,
      country: countryForPrompt(prompt),
      currency: currencyForPrompt(prompt),
      platform: 'crypto',
      useCase: 'crypto_exchange',
      paymentRails: ['crypto_wallet', 'bank_transfer', 'card', 'swift'],
      patterns: ['cross_border_anomaly', 'mule_account', 'kyc_abuse', 'transaction_spike', 'velocity_abuse'],
      transactionsMin: 2,
      transactionsMax: 35
    };
  }

  if (hasAny(prompt, ['remittance', 'corridor', 'diaspora', 'cross-border', 'cross border', 'cashout', 'cash-out'])) {
    return {
      title: 'AI-inferred remittance fraud scenario',
      summary: 'Cross-border remittance simulation focused on corridor risk, beneficiary bursts, mule accounts, and cashout.',
      users: 3500,
      fraudRate: 0.11,
      country: countryForPrompt(prompt, 'GB'),
      currency: currencyForPrompt(prompt, 'GBP'),
      platform: 'remittance',
      paymentRails: ['swift', 'mobile_money', 'cashout', 'bank_transfer', 'wallet_transfer'],
      patterns: ['cross_border_anomaly', 'mule_account', 'beneficiary_burst', 'transaction_spike'],
      transactionsMin: 2,
      transactionsMax: 30
    };
  }

  if (hasAny(prompt, ['bank', 'aml', 'sanction', 'money laundering', 'layering', 'structuring', 'financial crime'])) {
    return {
      title: 'AI-inferred bank AML scenario',
      summary: 'Bank AML and financial-crime simulation for mule activity, layering-style movement, and suspicious beneficiaries.',
      users: 5000,
      fraudRate: 0.1,
      country: countryForPrompt(prompt, 'GB'),
      currency: currencyForPrompt(prompt, 'GBP'),
      platform: 'fintech',
      useCase: 'bank_aml',
      paymentRails: ['bank_transfer', 'swift', 'cashout', 'wallet_transfer'],
      patterns: ['mule_account', 'beneficiary_burst', 'cross_border_anomaly', 'transaction_spike', 'kyc_abuse'],
      transactionsMin: 3,
      transactionsMax: 32
    };
  }

  if (hasAny(prompt, ['marketplace', 'seller', 'buyer', 'refund', 'chargeback', 'ecommerce', 'gig'])) {
    return {
      title: 'AI-inferred marketplace trust scenario',
      summary: 'Marketplace trust and safety simulation with chargebacks, payout abuse, account takeover, and transaction spikes.',
      users: 3000,
      fraudRate: 0.07,
      country: countryForPrompt(prompt, 'GB'),
      currency: currencyForPrompt(prompt, 'GBP'),
      platform: 'marketplace',
      useCase: 'marketplace_trust',
      paymentRails: ['card', 'bank_transfer', 'payout', 'merchant_payment'],
      patterns: ['chargeback_risk', 'transaction_spike', 'account_takeover', 'velocity_abuse'],
      transactionsMin: 1,
      transactionsMax: 22
    };
  }

  if (hasAny(prompt, ['social', 'creator', 'payout', 'peer', 'messaging'])) {
    return {
      title: 'AI-inferred social payments scenario',
      summary: 'Social payments and creator-payout simulation with account takeover, payout velocity, and beneficiary abuse.',
      users: 3000,
      fraudRate: 0.06,
      country: countryForPrompt(prompt, 'US'),
      currency: currencyForPrompt(prompt, 'USD'),
      platform: 'social',
      useCase: 'social_payments',
      paymentRails: ['wallet_transfer', 'payout', 'card', 'bank_transfer'],
      patterns: ['account_takeover', 'velocity_abuse', 'beneficiary_burst', 'cross_border_anomaly'],
      transactionsMin: 1,
      transactionsMax: 20
    };
  }

  return {
    ...DEFAULT_TEMPLATE,
    country: countryForPrompt(prompt, DEFAULT_TEMPLATE.country),
    currency: currencyForPrompt(prompt, DEFAULT_TEMPLATE.currency)
  };
}

function inferPatterns(prompt: string): FraudPattern[] {
  const patterns = new Set<FraudPattern>();
  if (hasAny(prompt, ['mule', 'cashout', 'cash-out', 'rapid in out', 'rapid-in-out'])) patterns.add('mule_account');
  if (hasAny(prompt, ['takeover', 'ato', 'device change', 'failed login', 'login spike'])) patterns.add('account_takeover');
  if (hasAny(prompt, ['velocity', 'rapid', 'burst transactions', 'many transactions', 'high frequency'])) patterns.add('velocity_abuse');
  if (hasAny(prompt, ['kyc', 'identity', 'document', 'onboarding'])) patterns.add('kyc_abuse');
  if (hasAny(prompt, ['chargeback', 'refund', 'dispute'])) patterns.add('chargeback_risk');
  if (hasAny(prompt, ['spike', 'large transaction', 'high value', 'unusual amount'])) patterns.add('transaction_spike');
  if (hasAny(prompt, ['cross-border', 'cross border', 'corridor', 'foreign beneficiary', 'country mismatch', 'remittance', 'uk-nigeria', 'gb-ng', 'uk-ghana', 'gb-gh', 'uk-kenya', 'gb-ke'])) patterns.add('cross_border_anomaly');
  if (hasAny(prompt, ['beneficiary', 'new payee', 'payee cluster', 'many payees'])) patterns.add('beneficiary_burst');
  return [...patterns];
}

function inferIntensity(prompt: string): { fraudRate?: number; transactionsMax?: number; label?: string } {
  if (hasAny(prompt, ['hard mode', 'adversarial', 'evasion', 'evade', 'sophisticated'])) {
    return { fraudRate: 0.14, transactionsMax: 45, label: 'adversarial/high-intensity' };
  }
  if (hasAny(prompt, ['high fraud', 'high-risk', 'high risk', 'severe', 'heavy'])) {
    return { fraudRate: 0.12, transactionsMax: 36, label: 'high-intensity' };
  }
  if (hasAny(prompt, ['low fraud', 'low-risk', 'low risk', 'light'])) {
    return { fraudRate: 0.04, transactionsMax: 18, label: 'low-intensity' };
  }
  return {};
}

function inferSignals(prompt: string, options: GenerateOptions): string[] {
  return [
    `country:${options.country}`,
    `currency:${options.currency}`,
    ...(options.platform ? [`platform:${options.platform}`] : []),
    ...(options.useCase ? [`use_case:${options.useCase}`] : []),
    ...options.patterns.map((pattern) => `pattern:${pattern}`),
    ...(options.paymentRails ?? []).map((rail) => `payment_rail:${rail}`),
    ...(hasAny(prompt, ['uk-nigeria', 'gb-ng', 'nigeria', 'lagos']) ? ['corridor:GB-NG/NG'] : []),
    ...(hasAny(prompt, ['uk-ghana', 'gb-gh', 'ghana', 'accra']) ? ['corridor:GB-GH/GH'] : []),
    ...(hasAny(prompt, ['uk-kenya', 'gb-ke', 'kenya', 'nairobi']) ? ['corridor:GB-KE/KE'] : [])
  ];
}

function buildRationale(prompt: string, options: GenerateOptions, intensityLabel?: string): string[] {
  const rationale = [
    `Selected ${options.country}/${options.currency} because the prompt mentions a matching market or no stronger market signal.`,
    `Selected ${options.patterns.join(', ')} because the prompt maps to those fraud typologies.`,
    `Selected ${options.transactionsMin}-${options.transactionsMax} transactions per normal user to fit the scenario activity level.`
  ];
  if (options.platform) {
    rationale.push(`Selected ${options.platform} platform defaults for product-specific rails and behavior.`);
  }
  if (intensityLabel) {
    rationale.push(`Applied ${intensityLabel} fraud intensity from the prompt language.`);
  }
  return rationale;
}

function countryForPrompt(prompt: string, fallback = 'NG'): string {
  if (hasAny(prompt, ['united kingdom', 'uk ', ' uk', 'gb', 'britain', 'london'])) return 'GB';
  if (hasAny(prompt, ['nigeria', 'ng ', ' ng', 'lagos'])) return 'NG';
  if (hasAny(prompt, ['ghana', 'gh ', ' gh', 'accra'])) return 'GH';
  if (hasAny(prompt, ['kenya', 'ke ', ' ke', 'nairobi'])) return 'KE';
  if (hasAny(prompt, ['united states', 'usa', 'us ', ' us', 'america'])) return 'US';
  if (hasAny(prompt, ['europe', 'eu ', ' eu', 'sepa'])) return 'EU';
  if (hasAny(prompt, ['south africa', 'za ', ' za'])) return 'ZA';
  return fallback;
}

function currencyForPrompt(prompt: string, fallback?: string): string {
  const country = countryForPrompt(prompt, fallback === 'GBP' ? 'GB' : fallback === 'USD' ? 'US' : undefined);
  const currencies: Record<string, string> = {
    GB: 'GBP',
    NG: 'NGN',
    GH: 'GHS',
    KE: 'KES',
    US: 'USD',
    EU: 'EUR',
    ZA: 'ZAR'
  };
  return currencies[country] ?? fallback ?? 'NGN';
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function normalizePrompt(prompt: string): string {
  return ` ${prompt.trim().toLowerCase().replace(/[_/]+/g, '-').replace(/\s+/g, ' ')} `;
}
