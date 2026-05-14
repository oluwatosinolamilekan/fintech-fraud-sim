import {
  DeviceType,
  SyntheticAccount,
  SyntheticBeneficiary,
  SyntheticDevice,
  SyntheticMerchant,
  SyntheticUser,
  GeneratedDataset,
  GenerateOptions
} from './types.js';
import { applyFraudPattern, makeTransactionForUser, transactionCountForUser } from './patterns.js';
import { actionForRiskScore, scoreUserRisk } from './risk.js';
import {
  countryOtherThan,
  currencyMinorUnits,
  normalizeCountry,
  seedFaker,
  SimRandom,
  syntheticId,
  validateGenerateOptions
} from './utils.js';

export function generateDataset(options: GenerateOptions): GeneratedDataset {
  validateGenerateOptions(options);
  seedFaker(options.seed);
  const rng = new SimRandom(options.seed ?? Date.now());
  const country = normalizeCountry(options.country);
  const baseTimeMs = generationBaseTime(options.seed, rng);
  const fraudTarget = Math.round(options.users * options.fraudRate);
  const fraudIndexes = new Set(rng.sample(Array.from({ length: options.users }, (_, index) => index), fraudTarget));
  const users: SyntheticUser[] = [];

  for (let index = 0; index < options.users; index += 1) {
    const pattern = rng.pick(options.patterns);
    const baseUser = makeBaseUser(country, rng);
    const user = fraudIndexes.has(index) ? applyFraudPattern(baseUser, pattern, rng) : baseUser;
    const riskScore = scoreUserRisk(user);
    users.push({
      ...user,
      risk_score: riskScore,
      recommended_action: actionForRiskScore(riskScore)
    });
  }

  const accounts = users.map((user) => makeAccountForUser(user, options.currency.toUpperCase(), rng, baseTimeMs));
  const devices = users.flatMap((user) => makeDevicesForUser(user, rng, baseTimeMs));
  const beneficiaries = users.flatMap((user) => makeBeneficiariesForUser(user, rng, baseTimeMs));
  const merchants = makeMerchants(country, Math.max(12, Math.ceil(options.users / 8)), rng);
  const accountByUserId = new Map(accounts.map((account) => [account.user_id, account]));
  const devicesByUserId = groupByUserId(devices);
  const beneficiariesByUserId = groupByUserId(beneficiaries);
  const merchantIds = merchants.map((merchant) => merchant.merchant_id);

  const transactions = users.flatMap((user) =>
    Array.from(
      { length: transactionCountForUser(user, options.transactionsMin, options.transactionsMax, rng) },
      (_, index) => makeTransactionForUser(user, options.currency.toUpperCase(), index, rng, baseTimeMs, {
        accountId: accountByUserId.get(user.user_id)?.account_id ?? accounts[0].account_id,
        deviceIds: (devicesByUserId.get(user.user_id) ?? devices).map((device) => device.device_id),
        beneficiaries: beneficiariesByUserId.get(user.user_id) ?? beneficiaries,
        merchantIds
      })
    )
  );

  const fraudPatternBreakdown = users.reduce<Record<string, number>>((accumulator, user) => {
    if (user.is_fraud) {
      accumulator[user.fraud_pattern] = (accumulator[user.fraud_pattern] ?? 0) + 1;
    }
    return accumulator;
  }, {});

  return {
    users,
    accounts,
    devices,
    beneficiaries,
    merchants,
    transactions,
    summary: {
      total_users: users.length,
      total_accounts: accounts.length,
      total_devices: devices.length,
      total_beneficiaries: beneficiaries.length,
      total_merchants: merchants.length,
      total_transactions: transactions.length,
      fraud_rate_requested: options.fraudRate,
      fraud_users_generated: users.filter((user) => user.is_fraud).length,
      suspicious_transactions_generated: transactions.filter((transaction) => transaction.is_suspicious).length,
      fraud_pattern_breakdown: fraudPatternBreakdown,
      generated_at: new Date(baseTimeMs).toISOString(),
      seed: options.seed ?? null
    }
  };
}

function generationBaseTime(seed: string | number | undefined, rng: SimRandom): number {
  if (seed === undefined) {
    return Date.now();
  }
  return Date.UTC(2026, 0, 1, 0, 0, 0) + rng.int(0, 365 * 24 * 60 * 60) * 1000;
}

function makeBaseUser(country: string, rng: SimRandom): SyntheticUser {
  const countryMismatch = rng.bool(0.05);
  return {
    user_id: syntheticId('usr', rng),
    country,
    account_age_days: rng.int(30, 2500),
    kyc_status: rng.pick(['verified', 'verified', 'verified', 'pending']),
    failed_kyc_attempts: rng.int(0, 1),
    device_count: rng.int(1, 3),
    ip_country: countryMismatch ? countryOtherThan(country, rng) : country,
    declared_country: country,
    failed_login_attempts_24h: rng.int(0, 3),
    beneficiary_count_24h: rng.int(0, 3),
    chargeback_count: rng.bool(0.92) ? 0 : rng.int(1, 2),
    is_fraud: false,
    fraud_pattern: 'none',
    risk_label: rng.bool(0.85) ? 'low' : 'medium',
    risk_score: 0,
    recommended_action: 'allow',
    reason_codes: []
  };
}

function makeAccountForUser(user: SyntheticUser, currency: string, rng: SimRandom, baseTimeMs: number): SyntheticAccount {
  const openedDaysAgo = Math.max(user.account_age_days, 1);
  const isRestricted = user.risk_score >= 75 || user.fraud_pattern === 'kyc_abuse';
  return {
    account_id: syntheticId('acct', rng),
    user_id: user.user_id,
    account_type: rng.pick(['wallet', 'savings', 'current']),
    currency,
    balance: currencyMinorUnits(rng.float(0, user.is_fraud ? 450000 : 2500000)),
    status: isRestricted ? 'restricted' : 'active',
    opened_at: new Date(baseTimeMs - openedDaysAgo * 24 * 60 * 60 * 1000).toISOString(),
    daily_limit: currencyMinorUnits(user.kyc_status === 'verified' ? rng.float(500000, 5000000) : rng.float(50000, 500000)),
    is_fraud_linked: user.is_fraud
  };
}

function makeDevicesForUser(user: SyntheticUser, rng: SimRandom, baseTimeMs: number): SyntheticDevice[] {
  return Array.from({ length: Math.max(1, user.device_count) }, (_, index) => {
    const firstSeenDaysAgo = rng.int(1, Math.max(2, user.account_age_days));
    const deviceType = rng.pick<DeviceType>(['android', 'ios', 'web', 'pos_terminal']);
    const isTakeoverDevice = user.fraud_pattern === 'account_takeover' && index === user.device_count - 1;
    return {
      device_id: syntheticId(isTakeoverDevice ? 'dev_new' : 'dev', rng),
      user_id: user.user_id,
      device_type: deviceType,
      os: osForDevice(deviceType, rng),
      first_seen_at: new Date(baseTimeMs - firstSeenDaysAgo * 24 * 60 * 60 * 1000).toISOString(),
      last_seen_at: new Date(baseTimeMs - rng.int(0, 30) * 60 * 60 * 1000).toISOString(),
      country: isTakeoverDevice ? user.ip_country : user.country,
      is_trusted: !isTakeoverDevice && rng.bool(user.is_fraud ? 0.55 : 0.9),
      is_fraud_linked: user.is_fraud && (isTakeoverDevice || rng.bool(0.35))
    };
  });
}

function makeBeneficiariesForUser(user: SyntheticUser, rng: SimRandom, baseTimeMs: number): SyntheticBeneficiary[] {
  const count = Math.max(1, Math.min(user.beneficiary_count_24h + rng.int(1, 4), 50));
  return Array.from({ length: count }, (_, index) => {
    const isRecent = index < user.beneficiary_count_24h || rng.bool(0.15);
    const country = user.fraud_pattern === 'cross_border_anomaly' && index === 0
      ? countryOtherThan(user.country, rng)
      : rng.bool(0.85)
        ? user.country
        : countryOtherThan(user.country, rng);
    return {
      beneficiary_id: syntheticId('bene', rng),
      user_id: user.user_id,
      beneficiary_type: rng.pick(['bank_account', 'wallet', 'card']),
      beneficiary_country: country,
      bank_code: String(rng.int(10, 999)).padStart(3, '0'),
      added_at: new Date(baseTimeMs - (isRecent ? rng.int(1, 24) * 60 * 60 * 1000 : rng.int(2, 365) * 24 * 60 * 60 * 1000)).toISOString(),
      is_recent: isRecent,
      is_fraud_linked: user.is_fraud && (isRecent || rng.bool(0.4))
    };
  });
}

function makeMerchants(country: string, count: number, rng: SimRandom): SyntheticMerchant[] {
  return Array.from({ length: count }, (_, index) => {
    const category = rng.pick<SyntheticMerchant['category']>(['airtime', 'bill_payments', 'ecommerce', 'gaming', 'groceries', 'travel']);
    const riskTier = category === 'gaming' || rng.bool(0.08)
      ? rng.pick<SyntheticMerchant['risk_tier']>(['high', 'critical'])
      : rng.pick<SyntheticMerchant['risk_tier']>(['low', 'low', 'medium']);
    return {
      merchant_id: syntheticId('mch', rng),
      merchant_name: `Synthetic Merchant ${String(index + 1).padStart(3, '0')}`,
      category,
      country: rng.bool(0.9) ? country : countryOtherThan(country, rng),
      risk_tier: riskTier,
      is_high_risk: riskTier === 'high' || riskTier === 'critical'
    };
  });
}

function osForDevice(deviceType: SyntheticDevice['device_type'], rng: SimRandom): string {
  if (deviceType === 'android') return rng.pick(['Android 13', 'Android 14', 'Android 15']);
  if (deviceType === 'ios') return rng.pick(['iOS 17', 'iOS 18']);
  if (deviceType === 'web') return rng.pick(['Chrome', 'Safari', 'Edge', 'Firefox']);
  return rng.pick(['Verifone VX', 'PAX A920', 'Sunmi P2']);
}

function groupByUserId<T extends { user_id: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    grouped.set(row.user_id, [...(grouped.get(row.user_id) ?? []), row]);
  }
  return grouped;
}
