import type { RulePack } from './rules.js';

export const RULE_TEMPLATES = {
  aml: {
    name: 'aml-monitoring-starter',
    match: 'all',
    rules: [
      {
        id: 'cross_border_high_value',
        description: 'Review high-value cross-border movement.',
        action: 'review',
        conditions: [
          { field: 'amount', operator: 'gte', value: 500000 },
          { field: 'country_mismatch', operator: 'eq', value: true }
        ]
      },
      {
        id: 'structuring_below_threshold',
        description: 'Catch rapid movement under review thresholds.',
        action: 'review',
        conditions: [
          { field: 'amount', operator: 'lt', value: 500000 },
          { field: 'reason_codes', operator: 'contains', value: 'STRUCTURING_BELOW_THRESHOLD' }
        ]
      },
      {
        id: 'networked_fraud_block',
        description: 'Block known linked network activity.',
        action: 'block',
        conditions: [
          { field: 'network_id', operator: 'exists' },
          { field: 'risk_score', operator: 'gte', value: 75 }
        ]
      }
    ]
  },
  'app-fraud': {
    name: 'app-fraud-starter',
    match: 'all',
    rules: [
      {
        id: 'account_takeover_signal',
        action: 'block',
        conditions: [
          { field: 'user_failed_login_attempts_24h', operator: 'gte', value: 8 },
          { field: 'user_ip_country_mismatch', operator: 'eq', value: true }
        ]
      },
      {
        id: 'beneficiary_burst_review',
        action: 'review',
        conditions: [
          { field: 'user_beneficiary_count_24h', operator: 'gte', value: 8 },
          { field: 'amount', operator: 'gte', value: 100000 }
        ]
      },
      {
        id: 'high_risk_score_block',
        action: 'block',
        conditions: [
          { field: 'risk_score', operator: 'gte', value: 85 }
        ]
      }
    ]
  },
  marketplace: {
    name: 'marketplace-trust-starter',
    match: 'all',
    rules: [
      {
        id: 'chargeback_or_refund_abuse',
        action: 'review',
        conditions: [
          { field: 'user_chargeback_count', operator: 'gte', value: 2 },
          { field: 'payment_rail', operator: 'in', value: ['card', 'merchant_payment'] }
        ]
      },
      {
        id: 'merchant_collusion_signal',
        action: 'block',
        conditions: [
          { field: 'reason_codes', operator: 'contains', value: 'MERCHANT_COLLUSION_SIGNAL' },
          { field: 'risk_score', operator: 'gte', value: 70 }
        ]
      },
      {
        id: 'promo_abuse_review',
        action: 'review',
        conditions: [
          { field: 'reason_codes', operator: 'contains', value: 'PROMO_ABUSE_PATTERN' }
        ]
      }
    ]
  }
} satisfies Record<string, RulePack>;
