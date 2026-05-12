import { SyntheticUser, GeneratedDataset, GenerateOptions } from './types.js';
import { applyFraudPattern, makeTransactionForUser, transactionCountForUser } from './patterns.js';
import {
  countryOtherThan,
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
    users.push(fraudIndexes.has(index) ? applyFraudPattern(baseUser, pattern, rng) : baseUser);
  }

  const transactions = users.flatMap((user) =>
    Array.from(
      { length: transactionCountForUser(user, options.transactionsMin, options.transactionsMax, rng) },
      (_, index) => makeTransactionForUser(user, options.currency.toUpperCase(), index, rng, baseTimeMs)
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
    transactions,
    summary: {
      total_users: users.length,
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
    reason_codes: []
  };
}
