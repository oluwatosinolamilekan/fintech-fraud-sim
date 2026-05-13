import { RecommendedAction, RiskLabel, SyntheticTransaction, SyntheticUser } from './types.js';

export function scoreUserRisk(user: Omit<SyntheticUser, 'risk_score' | 'recommended_action'>): number {
  let score = baseRiskScore(user.risk_label);

  if (user.is_fraud) score += 24;
  if (user.account_age_days <= 21) score += 12;
  if (user.kyc_status === 'pending') score += 8;
  if (user.kyc_status === 'rejected') score += 16;
  if (user.failed_kyc_attempts >= 3) score += 10;
  if (user.device_count >= 4) score += 8;
  if (user.ip_country !== user.declared_country) score += 12;
  if (user.failed_login_attempts_24h >= 8) score += 12;
  if (user.beneficiary_count_24h >= 8) score += 12;
  if (user.chargeback_count >= 2) score += 10;
  score += Math.min(user.reason_codes.length * 4, 16);

  return clampRiskScore(score);
}

export function scoreTransactionRisk(
  transaction: Omit<SyntheticTransaction, 'risk_score' | 'recommended_action'>,
  user?: SyntheticUser
): number {
  let score = user ? Math.round(user.risk_score * 0.45) : 10;

  if (transaction.is_suspicious) score += 30;
  if (transaction.status === 'reversed') score += 12;
  if (transaction.status === 'failed') score += 5;
  if (transaction.amount >= 500000) score += 10;
  if (transaction.amount >= 1000000) score += 10;
  if (user && transaction.ip_country !== user.country) score += 8;
  if (user && transaction.beneficiary_country !== user.country) score += 8;
  if (transaction.channel === 'api') score += 4;
  score += Math.min(transaction.reason_codes.length * 5, 20);

  return clampRiskScore(score);
}

export function actionForRiskScore(score: number): RecommendedAction {
  if (score >= 75) return 'block';
  if (score >= 45) return 'review';
  return 'allow';
}

function baseRiskScore(label: RiskLabel): number {
  switch (label) {
    case 'critical':
      return 58;
    case 'high':
      return 42;
    case 'medium':
      return 24;
    case 'low':
      return 8;
  }
}

function clampRiskScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
