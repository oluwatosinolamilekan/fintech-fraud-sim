import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyFraudPattern, PATTERN_REASON_CODES } from '../dist/patterns.js';
import { parsePatterns, SimRandom } from '../dist/utils.js';

const baseUser = {
  user_id: 'usr_test',
  country: 'NG',
  identity_type: 'bvn_like_id',
  kyc_provider: 'synthetic_bvn_check',
  account_age_days: 400,
  kyc_status: 'verified',
  failed_kyc_attempts: 0,
  device_count: 1,
  ip_country: 'NG',
  declared_country: 'NG',
  failed_login_attempts_24h: 0,
  beneficiary_count_24h: 1,
  chargeback_count: 0,
  is_fraud: false,
  fraud_pattern: 'none',
  risk_label: 'low',
  reason_codes: []
};

describe('fraud patterns', () => {
  it('applies account takeover signals', () => {
    const user = applyFraudPattern(baseUser, 'account_takeover', new SimRandom('ato'));

    assert.equal(user.is_fraud, true);
    assert.equal(user.fraud_pattern, 'account_takeover');
    assert.ok(user.device_count >= 4);
    assert.ok(user.failed_login_attempts_24h >= 8);
    assert.deepEqual(user.reason_codes, PATTERN_REASON_CODES.account_takeover);
  });

  it('applies kyc abuse signals without personal data', () => {
    const user = applyFraudPattern(baseUser, 'kyc_abuse', new SimRandom('kyc'));

    assert.equal(user.kyc_status, 'rejected');
    assert.ok(user.failed_kyc_attempts >= 3);
    assert.equal(Object.keys(user).includes('email'), false);
    assert.equal(Object.keys(user).includes('phone_number'), false);
    assert.equal(Object.keys(user).includes('bank_account_number'), false);
  });

  it('supports mule as an alias for mule_account', () => {
    assert.deepEqual(parsePatterns('mule,velocity_abuse'), ['mule_account', 'velocity_abuse']);
  });
});
