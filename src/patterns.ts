import { faker } from '@faker-js/faker';
import {
  Channel,
  FraudPattern,
  PaymentRail,
  RiskLabel,
  SyntheticBeneficiary,
  SyntheticTransaction,
  SyntheticUser,
  TransactionStatus
} from './types.js';
import { actionForRiskScore, scoreTransactionRisk } from './risk.js';
import { countryOtherThan, currencyMinorUnits, REVIEW_THRESHOLD, SimRandom, syntheticId } from './utils.js';

const HIGH_RISK_STATUSES: TransactionStatus[] = ['completed', 'pending', 'reversed'];
const CHANNELS: Channel[] = ['mobile_app', 'web', 'api', 'pos', 'ussd'];
const PAYMENT_RAILS: PaymentRail[] = ['bank_transfer', 'wallet_transfer', 'card', 'mobile_money', 'merchant_payment'];

export const PATTERN_DEFINITIONS: Record<FraudPattern, string> = {
  mule_account: 'New account with high beneficiary count and frequent incoming or outgoing transfers.',
  account_takeover: 'Device or country mismatch with failed logins and a sudden transaction spike.',
  velocity_abuse: 'Many transactions in a short period, often just below manual review thresholds.',
  kyc_abuse: 'Repeated failed KYC attempts, reused devices, and inconsistent location signals.',
  chargeback_risk: 'Prior chargebacks combined with high-value transactions.',
  transaction_spike: 'Transaction amount far above the user baseline.',
  cross_border_anomaly: 'Declared country differs from IP or beneficiary country.',
  beneficiary_burst: 'Many new beneficiaries added in the last 24 hours.'
};

export const PATTERN_REASON_CODES: Record<FraudPattern, string[]> = {
  mule_account: ['NEW_ACCOUNT', 'HIGH_BENEFICIARY_COUNT', 'RAPID_FUNDS_MOVEMENT'],
  account_takeover: ['DEVICE_CHANGE', 'IP_COUNTRY_MISMATCH', 'FAILED_LOGIN_SPIKE'],
  velocity_abuse: ['HIGH_TXN_VELOCITY', 'BELOW_REVIEW_THRESHOLD', 'SHORT_WINDOW_ACTIVITY'],
  kyc_abuse: ['MULTIPLE_FAILED_KYC', 'REUSED_DEVICE', 'COUNTRY_DATA_INCONSISTENT'],
  chargeback_risk: ['PRIOR_CHARGEBACKS', 'HIGH_VALUE_TRANSACTION', 'REVERSAL_HISTORY'],
  transaction_spike: ['AMOUNT_ABOVE_BASELINE', 'UNUSUAL_TRANSACTION_SPIKE'],
  cross_border_anomaly: ['DECLARED_COUNTRY_MISMATCH', 'CROSS_BORDER_BENEFICIARY'],
  beneficiary_burst: ['BENEFICIARY_BURST_24H', 'NEW_PAYEE_CLUSTER']
};

export function applyFraudPattern(user: SyntheticUser, pattern: FraudPattern, rng: SimRandom): SyntheticUser {
  const reasonCodes = [...PATTERN_REASON_CODES[pattern]];
  const riskLabel = riskForPattern(pattern);
  const suspiciousCountry = countryOtherThan(user.country, rng);

  const patched: SyntheticUser = {
    ...user,
    is_fraud: true,
    fraud_pattern: pattern,
    risk_label: riskLabel,
    reason_codes: reasonCodes
  };

  switch (pattern) {
    case 'mule_account':
      return {
        ...patched,
        account_age_days: rng.int(1, 21),
        kyc_status: rng.pick(['pending', 'verified']),
        beneficiary_count_24h: rng.int(8, 35),
        device_count: rng.int(2, 5)
      };
    case 'account_takeover':
      return {
        ...patched,
        device_count: rng.int(4, 10),
        ip_country: suspiciousCountry,
        failed_login_attempts_24h: rng.int(8, 35),
        beneficiary_count_24h: rng.int(2, 10)
      };
    case 'velocity_abuse':
      return {
        ...patched,
        beneficiary_count_24h: rng.int(3, 14),
        failed_login_attempts_24h: rng.int(0, 5),
        device_count: rng.int(1, 4)
      };
    case 'kyc_abuse':
      return {
        ...patched,
        kyc_status: 'rejected',
        failed_kyc_attempts: rng.int(3, 9),
        device_count: rng.int(4, 12),
        ip_country: suspiciousCountry,
        declared_country: rng.bool(0.7) ? suspiciousCountry : user.declared_country
      };
    case 'chargeback_risk':
      return {
        ...patched,
        chargeback_count: rng.int(2, 8),
        risk_label: 'high'
      };
    case 'transaction_spike':
      return {
        ...patched,
        beneficiary_count_24h: rng.int(1, 8),
        risk_label: 'high'
      };
    case 'cross_border_anomaly':
      return {
        ...patched,
        ip_country: suspiciousCountry,
        declared_country: user.country,
        beneficiary_count_24h: rng.int(1, 7)
      };
    case 'beneficiary_burst':
      return {
        ...patched,
        beneficiary_count_24h: rng.int(12, 45),
        account_age_days: rng.int(7, 120)
      };
  }
}

export function transactionCountForUser(user: SyntheticUser, min: number, max: number, rng: SimRandom): number {
  if (!user.is_fraud) {
    return rng.int(min, max);
  }
  switch (user.fraud_pattern) {
    case 'velocity_abuse':
      return Math.max(max, rng.int(25, 60));
    case 'mule_account':
      return Math.max(max, rng.int(15, 45));
    case 'account_takeover':
      return Math.max(max, rng.int(10, 35));
    case 'beneficiary_burst':
      return Math.max(max, rng.int(12, 40));
    default:
      return rng.int(Math.max(min, 3), Math.max(max, 8));
  }
}

export function makeTransactionForUser(
  user: SyntheticUser,
  currency: string,
  index: number,
  rng: SimRandom,
  baseTimeMs: number,
  relations: {
    accountId: string;
    deviceIds: string[];
    beneficiaries: SyntheticBeneficiary[];
    merchantIds: string[];
    channels?: Channel[];
    paymentRails?: PaymentRail[];
  }
): SyntheticTransaction {
  const pattern = user.fraud_pattern;
  const isSuspicious = user.is_fraud && (index < suspiciousTransactionQuota(pattern, rng) || rng.bool(0.55));
  const reasonCodes = isSuspicious && user.is_fraud ? transactionReasonCodes(pattern as FraudPattern) : [];
  const amount = amountForPattern(pattern, isSuspicious, rng);
  const beneficiaryCountry =
    isSuspicious && (pattern === 'cross_border_anomaly' || pattern === 'account_takeover')
      ? countryOtherThan(user.country, rng)
      : rng.bool(0.9)
        ? user.country
        : countryOtherThan(user.country, rng);
  const ipCountry =
    isSuspicious && (pattern === 'account_takeover' || pattern === 'cross_border_anomaly' || pattern === 'kyc_abuse')
      ? countryOtherThan(user.country, rng)
      : user.ip_country;
  const minutesAgo = isSuspicious && (pattern === 'velocity_abuse' || pattern === 'beneficiary_burst')
    ? rng.int(0, 180)
    : rng.int(0, 60 * 24 * 60);

  const transactionWithoutRisk: Omit<SyntheticTransaction, 'risk_score' | 'recommended_action'> = {
    transaction_id: syntheticId('txn', rng),
    user_id: user.user_id,
    account_id: relations.accountId,
    timestamp: new Date(baseTimeMs - minutesAgo * 60_000).toISOString(),
    amount,
    currency,
    payment_rail: paymentRailForPattern(pattern, isSuspicious, relations.paymentRails ?? PAYMENT_RAILS, rng),
    channel: channelForPattern(pattern, isSuspicious, relations.channels ?? CHANNELS, rng),
    beneficiary_id: beneficiaryForCountry(relations.beneficiaries, beneficiaryCountry, rng).beneficiary_id,
    beneficiary_country: beneficiaryCountry,
    merchant_id: rng.pick(relations.merchantIds),
    device_id: isSuspicious && pattern === 'account_takeover'
      ? relations.deviceIds[relations.deviceIds.length - 1]
      : rng.pick(relations.deviceIds),
    ip_country: ipCountry,
    status: isSuspicious ? rng.pick(HIGH_RISK_STATUSES) : rng.pick(['completed', 'completed', 'pending', 'failed']),
    is_suspicious: isSuspicious,
    fraud_pattern: isSuspicious && user.is_fraud ? pattern : 'none',
    reason_codes: reasonCodes
  };
  const riskScore = scoreTransactionRisk(transactionWithoutRisk, user);

  return {
    ...transactionWithoutRisk,
    risk_score: riskScore,
    recommended_action: actionForRiskScore(riskScore)
  };
}

function beneficiaryForCountry(
  beneficiaries: SyntheticBeneficiary[],
  country: string,
  rng: SimRandom
): SyntheticBeneficiary {
  const countryMatches = beneficiaries.filter((beneficiary) => beneficiary.beneficiary_country === country);
  return rng.pick(countryMatches.length > 0 ? countryMatches : beneficiaries);
}

function riskForPattern(pattern: FraudPattern): RiskLabel {
  if (pattern === 'account_takeover' || pattern === 'mule_account' || pattern === 'velocity_abuse') {
    return 'critical';
  }
  if (pattern === 'chargeback_risk' || pattern === 'transaction_spike' || pattern === 'beneficiary_burst') {
    return 'high';
  }
  return 'medium';
}

function suspiciousTransactionQuota(pattern: SyntheticUser['fraud_pattern'], rng: SimRandom): number {
  switch (pattern) {
    case 'velocity_abuse':
      return rng.int(10, 25);
    case 'mule_account':
      return rng.int(8, 20);
    case 'beneficiary_burst':
      return rng.int(6, 18);
    case 'account_takeover':
      return rng.int(5, 15);
    default:
      return rng.int(1, 5);
  }
}

function transactionReasonCodes(pattern: FraudPattern): string[] {
  return [...PATTERN_REASON_CODES[pattern]];
}

function amountForPattern(pattern: SyntheticUser['fraud_pattern'], isSuspicious: boolean, rng: SimRandom): number {
  if (!isSuspicious) {
    return currencyMinorUnits(rng.float(500, 180000));
  }
  switch (pattern) {
    case 'velocity_abuse':
      return currencyMinorUnits(rng.float(REVIEW_THRESHOLD * 0.82, REVIEW_THRESHOLD * 0.99));
    case 'chargeback_risk':
      return currencyMinorUnits(rng.float(700000, 4500000));
    case 'transaction_spike':
      return currencyMinorUnits(rng.float(900000, 6000000));
    case 'mule_account':
      return currencyMinorUnits(rng.float(200000, 2500000));
    default:
      return currencyMinorUnits(rng.float(100000, 1800000));
  }
}

function paymentRailForPattern(
  pattern: SyntheticUser['fraud_pattern'],
  isSuspicious: boolean,
  rails: PaymentRail[],
  rng: SimRandom
): PaymentRail {
  if (!isSuspicious) {
    return rng.pick(rails);
  }
  if (pattern === 'cross_border_anomaly') {
    return pickPreferredRail(['swift', 'sepa', 'crypto_wallet', 'mobile_money', 'bank_transfer'], rails, rng);
  }
  if (pattern === 'beneficiary_burst' || pattern === 'mule_account') {
    return pickPreferredRail(['bank_transfer', 'wallet_transfer', 'mobile_money', 'cashout'], rails, rng);
  }
  if (pattern === 'chargeback_risk') {
    return pickPreferredRail(['card', 'merchant_payment'], rails, rng);
  }
  return rng.pick(rails);
}

function pickPreferredRail(preferred: PaymentRail[], rails: PaymentRail[], rng: SimRandom): PaymentRail {
  const matches = preferred.filter((rail) => rails.includes(rail));
  return rng.pick(matches.length > 0 ? matches : rails);
}

function channelForPattern(pattern: SyntheticUser['fraud_pattern'], isSuspicious: boolean, channels: Channel[], rng: SimRandom): Channel {
  if (!isSuspicious) {
    return rng.pick(channels);
  }
  if (pattern === 'velocity_abuse') {
    return pickPreferredChannel(['api', 'mobile_app'], channels, rng);
  }
  if (pattern === 'account_takeover') {
    return pickPreferredChannel(['web', 'mobile_app'], channels, rng);
  }
  return rng.pick(channels);
}

function pickPreferredChannel(preferred: Channel[], channels: Channel[], rng: SimRandom): Channel {
  const matches = preferred.filter((channel) => channels.includes(channel));
  return rng.pick(matches.length > 0 ? matches : channels);
}

export function fakeTimestampWithinLastYear(rng: SimRandom): string {
  const date = faker.date.recent({ days: rng.int(1, 365) });
  return date.toISOString();
}
