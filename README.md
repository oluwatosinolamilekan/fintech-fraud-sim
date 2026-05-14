# fintech-fraud-sim


`fintech-fraud-sim` is a TypeScript CLI for generating synthetic fintech users and transactions with configurable suspicious fraud patterns. It is designed for testing fraud detection systems, dashboards, rule engines, QA pipelines, risk scoring packages, and model prototypes.

The generated data is synthetic only. It does not include real names, phone numbers, emails, BVNs, NINs, bank account numbers, or real personal data. Use it for testing, education, and fraud-model prototyping only.

## Usage

```bash
npx fintech-fraud-sim generate --users 1000 --fraud-rate 0.08
npx fintech-fraud-sim generate --users 5000 --fraud-rate 0.12 --format csv
npx fintech-fraud-sim generate --users 2000 --fraud-rate 0.05 --format json --out ./data
npx fintech-fraud-sim generate --users 2000 --fraud-rate 0.05 --format ndjson --out ./stream-data
npx fintech-fraud-sim generate --users 2000 --fraud-rate 0.05 --format sql --out ./db-seed
npx fintech-fraud-sim generate --users 1000 --fraud-rate 0.1 --country NG
npx fintech-fraud-sim generate --users 1000 --fraud-rate 0.08 --patterns mule,account_takeover,velocity_abuse
npx fintech-fraud-sim preview --users 20 --fraud-rate 0.15 --limit 5 --pretty
npx fintech-fraud-sim schema --target all --out ./schemas --pretty
```

Local development:

```bash
npm install
npm run build
npm test
npm run dev -- generate --users 100 --fraud-rate 0.1 --seed demo
```

## CLI Options

### `generate`

| Option | Default | Description |
| --- | --- | --- |
| `--users <number>` | `1000` | Number of synthetic users to generate. |
| `--fraud-rate <number>` | `0.05` | Fraction of users marked as fraud, between `0` and `1`. |
| `--format <csv\|json\|ndjson\|sql\|both\|all>` | `both` | Output file format. `both` writes CSV and JSON; `all` writes CSV, JSON, NDJSON, and SQL inserts. |
| `--out <path>` | `./output` | Output directory. |
| `--country <code>` | `NG` | Default 2-letter country code. |
| `--currency <code>` | `NGN` | Transaction currency code. |
| `--patterns <list>` | `all` | Comma-separated fraud patterns. `mule` is accepted as an alias for `mule_account`. |
| `--seed <value>` | none | String or number seed for deterministic output. |
| `--transactions-min <number>` | `1` | Minimum transactions per non-fraud user. |
| `--transactions-max <number>` | `20` | Maximum transactions per non-fraud user. |
| `--pretty` | `false` | Format JSON output with indentation. |

### `preview`

Prints a small generated sample to stdout without writing files. It supports the same generation options as `generate`, plus:

| Option | Default | Description |
| --- | --- | --- |
| `--limit <number>` | `5` | Number of sample users and transactions to print. |

### `schema`

Prints or exports JSON Schema files for the generated dataset.

| Option | Default | Description |
| --- | --- | --- |
| `--target <users\|accounts\|devices\|beneficiaries\|merchants\|transactions\|summary\|all>` | `all` | Schema target to print or export. |
| `--out <path>` | none | Directory to write schema files. Prints to stdout when omitted. |
| `--pretty` | `false` | Format schema JSON with indentation. |

## Output Files

Depending on `--format`, the CLI writes:

```text
users.csv
accounts.csv
devices.csv
beneficiaries.csv
merchants.csv
transactions.csv
users.json
accounts.json
devices.json
beneficiaries.json
merchants.json
transactions.json
summary.json
users.ndjson
accounts.ndjson
devices.ndjson
beneficiaries.ndjson
merchants.ndjson
transactions.ndjson
summary.ndjson
dataset.sql
```

Parquet is intentionally not emitted yet; it is planned for a later data/ML-team focused release.

`summary.json` includes:

```json
{
  "total_users": 1000,
  "total_accounts": 1000,
  "total_devices": 2180,
  "total_beneficiaries": 4620,
  "total_merchants": 125,
  "total_transactions": 12850,
  "fraud_rate_requested": 0.08,
  "fraud_users_generated": 80,
  "suspicious_transactions_generated": 612,
  "fraud_pattern_breakdown": {
    "account_takeover": 12,
    "velocity_abuse": 10
  },
  "generated_at": "2026-01-03T10:14:00.000Z",
  "seed": "demo"
}
```

## Generated User Fields

`user_id`, `country`, `account_age_days`, `kyc_status`, `failed_kyc_attempts`, `device_count`, `ip_country`, `declared_country`, `failed_login_attempts_24h`, `beneficiary_count_24h`, `chargeback_count`, `is_fraud`, `fraud_pattern`, `risk_label`, `risk_score`, `recommended_action`, `reason_codes`.

## Generated Account Fields

`account_id`, `user_id`, `account_type`, `currency`, `balance`, `status`, `opened_at`, `daily_limit`, `is_fraud_linked`.

## Generated Device Fields

`device_id`, `user_id`, `device_type`, `os`, `first_seen_at`, `last_seen_at`, `country`, `is_trusted`, `is_fraud_linked`.

## Generated Beneficiary Fields

`beneficiary_id`, `user_id`, `beneficiary_type`, `beneficiary_country`, `bank_code`, `added_at`, `is_recent`, `is_fraud_linked`.

## Generated Merchant Fields

`merchant_id`, `merchant_name`, `category`, `country`, `risk_tier`, `is_high_risk`.

## Generated Transaction Fields

`transaction_id`, `user_id`, `account_id`, `timestamp`, `amount`, `currency`, `channel`, `beneficiary_id`, `beneficiary_country`, `merchant_id`, `device_id`, `ip_country`, `status`, `is_suspicious`, `fraud_pattern`, `risk_score`, `recommended_action`, `reason_codes`.

## Risk Scoring

Generated users and transactions include a `risk_score` from `0` to `100` and a `recommended_action`:

| Action | Score Range | Typical Use |
| --- | --- | --- |
| `allow` | `0-44` | Low-risk records for normal test traffic. |
| `review` | `45-74` | Queues for manual review, rules testing, and dashboard triage. |
| `block` | `75-100` | High-risk fraud simulations for decline/block flows. |

## Fraud Patterns

| Pattern | Signals |
| --- | --- |
| `mule_account` | New account, high beneficiary count, frequent funds movement. |
| `account_takeover` | Device change, IP country mismatch, failed login spike. |
| `velocity_abuse` | Many transactions in a short period, often below review thresholds. |
| `kyc_abuse` | Multiple failed KYC attempts, reused device, inconsistent country data. |
| `chargeback_risk` | Prior chargebacks and high-value transactions. |
| `transaction_spike` | Transaction amount far above baseline. |
| `cross_border_anomaly` | Declared country differs from IP or beneficiary country. |
| `beneficiary_burst` | Many new beneficiaries added within 24 hours. |

## Example Output

User:

```json
{
  "user_id": "usr_693649_684895",
  "country": "NG",
  "account_age_days": 9,
  "kyc_status": "verified",
  "failed_kyc_attempts": 0,
  "device_count": 4,
  "ip_country": "NG",
  "declared_country": "NG",
  "failed_login_attempts_24h": 1,
  "beneficiary_count_24h": 22,
  "chargeback_count": 0,
  "is_fraud": true,
  "fraud_pattern": "mule_account",
  "risk_label": "critical",
  "risk_score": 100,
  "recommended_action": "block",
  "reason_codes": ["NEW_ACCOUNT", "HIGH_BENEFICIARY_COUNT", "RAPID_FUNDS_MOVEMENT"]
}
```

Transaction:

```json
{
  "transaction_id": "txn_616304_629760",
  "user_id": "usr_693649_684895",
  "account_id": "acct_883692_381742",
  "timestamp": "2026-01-02T17:52:00.000Z",
  "amount": 1250050.28,
  "currency": "NGN",
  "channel": "mobile_app",
  "beneficiary_id": "bene_550156_152713",
  "beneficiary_country": "NG",
  "merchant_id": "mch_876104_347620",
  "device_id": "dev_561681_118099",
  "ip_country": "NG",
  "status": "completed",
  "is_suspicious": true,
  "fraud_pattern": "mule_account",
  "risk_score": 96,
  "recommended_action": "block",
  "reason_codes": ["NEW_ACCOUNT", "HIGH_BENEFICIARY_COUNT", "RAPID_FUNDS_MOVEMENT"]
}
```

## Programmatic API

```ts
import { generateDataset } from 'fintech-fraud-sim';

const dataset = generateDataset({
  users: 1000,
  fraudRate: 0.08,
  format: 'both',
  out: './output',
  country: 'NG',
  currency: 'NGN',
  patterns: ['mule_account', 'account_takeover'],
  seed: 'demo',
  transactionsMin: 1,
  transactionsMax: 20,
  pretty: false
});
```
