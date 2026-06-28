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
npx fintech-fraud-sim generate --users 2000 --fraud-rate 0.05 --format parquet --out ./warehouse-fixtures
npx fintech-fraud-sim generate --users 1000 --fraud-rate 0.1 --country NG
npx fintech-fraud-sim generate --users 1000 --country KE --platform remittance --payment-rails mobile_money,cashout
npx fintech-fraud-sim generate --config ./fraud-sim.config.json --format ndjson
npx fintech-fraud-sim generate --users 1000 --fraud-rate 0.08 --patterns mule,account_takeover,velocity_abuse
npx fintech-fraud-sim generate --users 5000 --fraud-rate 0.12 --patterns mule_account,structuring,layering --pattern-weights '{"mule_account":4,"structuring":2,"layering":1}'
npx fintech-fraud-sim generate --users 2000 --fraud-rate 0.12 --patterns fraud_ring,mule_account --format json --out ./ring-fixtures
npx fintech-fraud-sim generate --use-case crypto_exchange --format ndjson --out ./aml-fixtures
npx fintech-fraud-sim preview --use-case social_payments --limit 3 --pretty
npx fintech-fraud-sim profiles --pretty
npx fintech-fraud-sim platforms --pretty
npx fintech-fraud-sim use-cases --pretty
npx fintech-fraud-sim scenario "UK-Nigeria remittance mule cashout with beneficiary bursts" --out ./ai-scenario --seed demo --pretty
npx fintech-fraud-sim scenario "crypto exchange KYC abuse and cross-border withdrawal risk" --plan-only --pretty
npx fintech-fraud-sim benchmarks --pretty
npx fintech-fraud-sim benchmark --suite uk-fincrime --out ./uk-fincrime-benchmark --seed demo
npx fintech-fraud-sim benchmark --suite cross-border-remittance --users 10000 --out ./remittance-benchmark
npx fintech-fraud-sim ml-export --input ./uk-fincrime-benchmark --target transactions --out ./ml-training
npx fintech-fraud-sim ml-export --input ./data --target users --split 0.75 --out ./user-risk-training
npx fintech-fraud-sim ml-export --input ./data --target transactions --format json --split 0.7 --validation-split 0.15 --stratify --out ./model-ready
npx fintech-fraud-sim evaluate --truth ./uk-fincrime-benchmark/transactions.json --predictions ./model-predictions.csv --pretty
npx fintech-fraud-sim report --input ./uk-fincrime-benchmark --suite uk-fincrime --format html
npx fintech-fraud-sim dashboard --input ./uk-fincrime-benchmark --out ./uk-fincrime-dashboard.html
npx fintech-fraud-sim graph-export --input ./ring-fixtures --format csv --out ./fraud-graph
npx fintech-fraud-sim graph-export --input ./ring-fixtures --format cypher --out ./fraud-graph.cypher
npx fintech-fraud-sim rules-init --template aml --out ./rules.json --pretty
npx fintech-fraud-sim rules-test --input ./uk-fincrime-benchmark --rules ./rules.json --pretty
npx fintech-fraud-sim validate --input ./uk-fincrime-benchmark --pretty
npx fintech-fraud-sim serve --input ./uk-fincrime-benchmark --port 3333
npx fintech-fraud-sim preview --users 20 --fraud-rate 0.15 --limit 5 --pretty
npx fintech-fraud-sim schema --target all --out ./schemas --pretty
```

## Browser Demo

Open [fintech-fraud-sim.vercel.app](https://fintech-fraud-sim.vercel.app/) to see a landing page that explains the package, its synthetic-only safety promise, and its impact for fraud, compliance, QA, and ML teams. From there, launch the responsive Vue CDN + Tailwind static playground with persona presets, workflow cards, light/dark mode, scenario controls, pattern and rail toggles, output feature switches, KPI cards, CLI/config copy, sample-output tabs, a mini fraud graph, fraud-pattern mix, transaction exploration, generated-file previews, and per-transaction risk explanations without requiring a server or build step.

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
| `--format <csv\|json\|ndjson\|sql\|parquet\|both\|all>` | `both` | Output file format. `both` writes CSV and JSON; `all` writes CSV, JSON, NDJSON, SQL inserts, and Parquet fallback files. |
| `--out <path>` | `./output` | Output directory. |
| `--config <path>` | none | JSON config file with generation options. Explicit CLI flags override config values. |
| `--country <code>` | `NG` | Default 2-letter country code. |
| `--currency <code>` | `NGN` | Transaction currency code. |
| `--profile <code>` | same as `--country` | Country profile to use for local payment, KYC, merchant, account, and beneficiary behavior. |
| `--platform <name>` | none | Platform preset: `fintech`, `marketplace`, `crypto`, `social`, `gaming`, `lending`, or `remittance`. |
| `--payment-rails <list>` | profile/platform default | Comma-separated payment rails such as `bank_transfer`, `card`, `mobile_money`, `sepa`, `swift`, `crypto_wallet`, `cashout`, or `payout`. |
| `--patterns <list>` | `all` | Comma-separated fraud patterns. `mule` is accepted as an alias for `mule_account`; `fraud_ring` creates linked users with shared devices and beneficiaries. |
| `--pattern-weights <json>` | none | JSON object mapping fraud patterns to numeric weights, for example `{"mule_account":4,"structuring":2}`. |
| `--use-case <name>` | none | Apply production-oriented defaults for a product domain. Explicit flags override preset defaults. |
| `--seed <value>` | none | String or number seed for deterministic output. |
| `--transactions-min <number>` | `1` | Minimum transactions per non-fraud user. |
| `--transactions-max <number>` | `20` | Maximum transactions per non-fraud user. |
| `--pretty` | `false` | Format JSON output with indentation. |

### `preview`

Prints a small generated sample to stdout without writing files. It supports the same generation options as `generate`, plus:

| Option | Default | Description |
| --- | --- | --- |
| `--limit <number>` | `5` | Number of sample users and transactions to print. |

### `profiles`

Lists built-in country profiles. Profiles make generated datasets less NG-specific by changing default currency, identity/KYC labels, payment rails, account types, beneficiary types, merchant categories, and channels.

Built-in profiles include `NG`, `US`, `GB`, `EU`, `KE`, `GH`, and `ZA`.

### `platforms`

Lists platform presets. Platforms tune fraud defaults and payment behavior for products outside traditional Nigerian fintech, including `fintech`, `marketplace`, `crypto`, `social`, `gaming`, `lending`, and `remittance`.

### Config and Plugins

Use `--config` when you want a reusable generation setup:

```json
{
  "users": 2500,
  "fraudRate": 0.08,
  "country": "KE",
  "currency": "KES",
  "platform": "remittance",
  "paymentRails": ["mobile_money", "cashout", "bank_transfer"],
  "patterns": ["mule_account", "cross_border_anomaly", "beneficiary_burst"],
  "patternWeights": {
    "mule_account": 4,
    "cross_border_anomaly": 2,
    "beneficiary_burst": 1
  },
  "transactionsMin": 1,
  "transactionsMax": 12
}
```

Library users can register custom profiles and platform presets:

```ts
import {
  defineGenerationPlugin,
  registerGenerationPlugin
} from 'fintech-fraud-sim';

registerGenerationPlugin(defineGenerationPlugin({
  name: 'custom-region-pack',
  countryProfiles: [myCountryProfile],
  platformPresets: [myPlatformPreset]
}));
```

### `schema`

Prints or exports JSON Schema files for the generated dataset.

| Option | Default | Description |
| --- | --- | --- |
| `--target <users\|accounts\|devices\|beneficiaries\|merchants\|transactions\|events\|summary\|all>` | `all` | Schema target to print or export. |
| `--out <path>` | none | Directory to write schema files. Prints to stdout when omitted. |
| `--pretty` | `false` | Format schema JSON with indentation. |

### `use-cases`

Prints preset defaults and examples for teams building global-scale risk, fraud, trust, AML, and payment systems.

```bash
npx fintech-fraud-sim use-cases --pretty
```

Available presets:

| Use Case | Built For | Default Signals |
| --- | --- | --- |
| `consumer_fintech` | Neobank, wallet, mobile money, and card issuing apps. | Mule accounts, account takeover, velocity abuse, beneficiary bursts. |
| `social_payments` | Meta-style social commerce, X/Twitter-style creator payouts, messaging wallets. | Account takeover, payout velocity, beneficiary bursts, cross-border anomalies. |
| `crypto_exchange` | Crypto exchanges, fiat on-ramps, stablecoin wallet apps. | Cross-border anomalies, mule behavior, KYC abuse, transaction spikes. |
| `marketplace_trust` | Ecommerce, delivery, gig, and classifieds marketplaces. | Chargebacks, transaction spikes, account takeover, velocity abuse. |
| `bank_aml` | Retail banks, business banks, AML monitoring vendors. | Mule accounts, beneficiary bursts, cross-border movement, transaction spikes, fraud rings. |
| `bnpl_credit` | BNPL checkout, consumer lending, merchant financing. | Chargeback risk, transaction spikes, KYC abuse, account takeover. |

### AI Scenario Generation

Use `scenario` to turn a natural-language fraud, AML, fintech, or AI-risk prompt into a deterministic synthetic dataset configuration.

```bash
npx fintech-fraud-sim scenario "UK-Nigeria remittance mule cashout with beneficiary bursts" --out ./ai-scenario --seed demo --pretty
npx fintech-fraud-sim scenario "adversarial crypto exchange KYC abuse and cross-border withdrawal risk" --plan-only --pretty
npx fintech-fraud-sim scenario "10k users with 20% fraud, mostly structuring and layering, max 45 transactions" --plan-only --pretty
```

The command infers:

```text
country
currency
platform
use case
payment rails
fraud patterns
fraud intensity
transaction volume
```

When data is generated, the output directory includes `scenario_plan.json` alongside the normal generated files. The scenario plan explains the prompt, inferred signals, selected options, and rationale so teams can show how a natural-language AI prompt became a reproducible fraud benchmark. Scenario prompts also understand common numeric hints such as `10k users`, `20% fraud`, and `max 45 transactions`.

### UK + Global Fraud Benchmark Suite

Use benchmark suites when you need repeatable datasets for fraud model QA, risk rule regression tests, AML demos, open banking risk workflows, and evidence-friendly impact reporting.

```bash
npx fintech-fraud-sim benchmarks --pretty
npx fintech-fraud-sim benchmark --suite uk-fincrime --out ./uk-fincrime-benchmark --seed demo
npx fintech-fraud-sim benchmark --suite open-banking-risk --out ./open-banking-benchmark
npx fintech-fraud-sim benchmark --suite cross-border-remittance --out ./remittance-benchmark
npx fintech-fraud-sim benchmark --suite aml-sanctions --out ./aml-benchmark
npx fintech-fraud-sim benchmark --suite global-fraud-mix --out ./global-benchmark
```

Available suites:

| Suite | Built For | UK / Global Usefulness |
| --- | --- | --- |
| `uk_fincrime` | UK APP fraud, mule-account, takeover, cashout, and fraud-ring control testing. | Helps banks and fintechs test UK financial crime controls with synthetic-only data. |
| `open_banking_risk` | Consent, payment-initiation, account, and transaction-risk workflows. | Supports UK open banking and PSD2-style risk QA without exposing customer data. |
| `cross_border_remittance` | UK-to-global remittance corridors such as `GB-NG`, `GB-GH`, `GB-KE`, `GB-IN`, and `GB-PK`. | Helps money transfer and fintech teams test cross-border AML and fraud controls. |
| `aml_sanctions` | AML monitoring and synthetic sanctions-screening style fixtures. | Gives regtech teams safe data for false-positive, high-risk-flow, structuring, layering, and networked-fraud tests. |
| `global_fraud_mix` | Broad fintech fraud and model-evaluation datasets. | Useful for international fintech teams building from or into the UK market. |

Each benchmark writes the normal dataset files plus:

```text
benchmark_suite.json
impact_report.json
impact_report.html
```

`impact_report.json` and `impact_report.html` summarize fraud exposure, estimated preventable loss, review workload, customer friction events, corridor breakdowns, fraud patterns, and top risk reason codes.

### `ml-export`

Export generated JSON data as ML-ready train/test feature matrices and labels:

```bash
npx fintech-fraud-sim ml-export --input ./uk-fincrime-benchmark --target transactions --out ./ml-training
npx fintech-fraud-sim ml-export --input ./data --target users --split 0.75 --out ./user-risk-training
npx fintech-fraud-sim ml-export --input ./data --target transactions --format json --split 0.7 --validation-split 0.15 --stratify --out ./model-ready
```

The command writes:

```text
X_train.csv
y_train.csv
X_test.csv
y_test.csv
feature_metadata.json
```

`transactions` predicts `is_suspicious`; `users` predicts `is_fraud`. The exporter uses numeric features and one-hot encoded categorical fields while excluding direct target/leakage fields such as `fraud_pattern`, `recommended_action`, `reason_codes`, and generated risk scores by default.

ML export supports `--format csv|json`, `--validation-split`, `--stratify`, and `--include-leakage-fields` for debugging rule/model behavior. When `--validation-split` is set, the command also writes `X_validation` and `y_validation` files.

### `evaluate`

Evaluate fraud model predictions against generated transaction ground truth:

```bash
npx fintech-fraud-sim evaluate \
  --truth ./uk-fincrime-benchmark/transactions.json \
  --predictions ./model-predictions.csv \
  --pretty
```

Prediction files can be JSON or CSV and should include `transaction_id` plus one of `risk_score`, `score`, `prediction`, `predicted_suspicious`, or `is_suspicious`.

The output includes:

```text
precision
recall
f1_score
false_positive_rate
false_negative_rate
pattern_detection_rate
estimated_fraud_loss_prevented
estimated_manual_review_cost
```

### `report`

Build or rebuild an economic impact report from a generated JSON output directory:

```bash
npx fintech-fraud-sim report --input ./uk-fincrime-benchmark --suite uk-fincrime --format html
```

This is useful for demos, technical articles, portfolio evidence, and explaining how synthetic fraud data can support safer fintech innovation, privacy-preserving AI development, and UK/global financial crime control testing.

### `dashboard`

Build a self-contained interactive HTML dashboard from generated JSON files:

```bash
npx fintech-fraud-sim dashboard --input ./uk-fincrime-benchmark --out ./uk-fincrime-dashboard.html
```

The dashboard includes KPI tiles, fraud-pattern breakdowns, top reason codes, payment rails, corridors, searchable transaction exploration, action filters, suspicious-label filters, pattern filters, and a fraud-network table. It does not require a server.

### `graph-export`

Export generated data as a fraud network graph:

```bash
npx fintech-fraud-sim graph-export --input ./ring-fixtures --format json --out ./fraud-graph.json
npx fintech-fraud-sim graph-export --input ./ring-fixtures --format csv --out ./fraud-graph
npx fintech-fraud-sim graph-export --input ./ring-fixtures --format cypher --out ./fraud-graph.cypher
npx fintech-fraud-sim graph-export --input ./ring-fixtures --format graphml --out ./fraud-graph.graphml
```

`json`, `cypher`, and `graphml` write a single file. `csv` writes `nodes.csv`, `edges.csv`, and `graph_summary.json` to the output directory. Graph nodes include users, accounts, devices, beneficiaries, merchants, transactions, and fraud networks. Edges connect ownership, device use, beneficiary additions, transaction initiation, payment targets, merchant activity, and network links.

### `rules-init`

Write a starter JSON rule pack before running `rules-test`:

```bash
npx fintech-fraud-sim rules-init --template aml --out ./rules.json --pretty
npx fintech-fraud-sim rules-init --template app-fraud --out ./app-rules.json
npx fintech-fraud-sim rules-init --template marketplace --out ./marketplace-rules.json
```

Templates are intentionally small and editable. They give teams a working baseline for AML monitoring, app fraud controls, and marketplace trust workflows.

### `rules-test`

Run a JSON rule pack against generated transactions:

```bash
npx fintech-fraud-sim rules-test --input ./uk-fincrime-benchmark --rules ./rules.json --out ./rule-results.json --pretty
```

Example rule pack:

```json
{
  "name": "starter-fraud-rules",
  "rules": [
    {
      "id": "high_risk_score",
      "action": "block",
      "conditions": [
        { "field": "risk_score", "operator": "gte", "value": 75 }
      ]
    },
    {
      "id": "cross_border_high_value",
      "action": "review",
      "conditions": [
        { "field": "amount", "operator": "gte", "value": 500000 },
        { "field": "country_mismatch", "operator": "eq", "value": true }
      ]
    }
  ]
}
```

Supported operators are `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `contains`, and `exists`. Rule facts include transaction fields plus useful derived/user fields such as `country_mismatch`, `corridor`, `reason_code_count`, `user_kyc_status`, `user_account_age_days`, `user_device_count`, `user_failed_login_attempts_24h`, `user_beneficiary_count_24h`, and `user_ip_country_mismatch`.

The output includes matched transactions, rule/action breakdowns, precision, recall, F1 score, false positives, and false negatives against the generated `is_suspicious` labels.

### `validate`

Validate a generated JSON output directory before using it in tests, dashboards, or model pipelines:

```bash
npx fintech-fraud-sim validate --input ./uk-fincrime-benchmark --pretty
```

Validation checks duplicate IDs, broken user/account/device/beneficiary/merchant references, invalid risk scores, invalid fraud patterns, summary count drift, and event references. It exits with a non-zero status when validation errors are found.

### `serve`

Serve a generated JSON dataset through a dependency-free local HTTP API:

```bash
npx fintech-fraud-sim serve --input ./uk-fincrime-benchmark --port 3333
```

Available endpoints include `/summary`, `/users`, `/accounts`, `/devices`, `/beneficiaries`, `/merchants`, `/transactions`, `/events`, and `/risk/:transactionId`.

## Output Files

Depending on `--format`, the CLI writes:

```text
users.csv
accounts.csv
devices.csv
beneficiaries.csv
merchants.csv
transactions.csv
events.csv
users.json
accounts.json
devices.json
beneficiaries.json
merchants.json
transactions.json
events.json
summary.json
users.ndjson
accounts.ndjson
devices.ndjson
beneficiaries.ndjson
merchants.ndjson
transactions.ndjson
events.ndjson
summary.ndjson
dataset.sql
users.parquet
transactions.parquet
events.parquet
parquet_manifest.json
```

Parquet output currently uses a dependency-free fallback writer: files use `.parquet` names but contain columnar JSON payloads plus `parquet_manifest.json`. This keeps the `--format parquet` workflow available without native dependencies; replace the writer with a binary Parquet integration before loading these files into strict Parquet-only tools.

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
  "fraud_networks_generated": 3,
  "networked_fraud_users_generated": 18,
  "use_case": "consumer_fintech",
  "platform": "fintech",
  "country_profile": "NG",
  "generated_at": "2026-01-03T10:14:00.000Z",
  "seed": "demo"
}
```

## Generated User Fields

`user_id`, `country`, `identity_type`, `kyc_provider`, `account_age_days`, `kyc_status`, `failed_kyc_attempts`, `device_count`, `ip_country`, `declared_country`, `failed_login_attempts_24h`, `beneficiary_count_24h`, `chargeback_count`, `is_fraud`, `fraud_pattern`, `risk_label`, `risk_score`, `recommended_action`, `reason_codes`, `network_id`.

## Generated Account Fields

`account_id`, `user_id`, `account_type`, `currency`, `balance`, `status`, `opened_at`, `daily_limit`, `is_fraud_linked`.

## Generated Device Fields

`device_id`, `user_id`, `device_type`, `os`, `first_seen_at`, `last_seen_at`, `country`, `is_trusted`, `is_fraud_linked`, `network_id`.

## Generated Beneficiary Fields

`beneficiary_id`, `user_id`, `beneficiary_type`, `beneficiary_country`, `bank_code`, `added_at`, `is_recent`, `is_fraud_linked`, `network_id`.

## Generated Merchant Fields

`merchant_id`, `merchant_name`, `category`, `country`, `risk_tier`, `is_high_risk`.

## Generated Transaction Fields

`transaction_id`, `user_id`, `account_id`, `timestamp`, `amount`, `currency`, `payment_rail`, `channel`, `beneficiary_id`, `beneficiary_country`, `merchant_id`, `device_id`, `ip_country`, `status`, `is_suspicious`, `fraud_pattern`, `risk_score`, `recommended_action`, `reason_codes`, `network_id`.

## Generated Event Fields

`event_id`, `event_type`, `timestamp`, `user_id`, `entity_id`, `entity_type`, `risk_score`, `recommended_action`, `is_suspicious`, `fraud_pattern`, `reason_codes`, `network_id`.

Events are derived from the generated users, KYC attempts, devices, beneficiaries, transactions, and rule-style decisions. They are useful for stream processors, sequence models, replay tests, and fraud-control demos that need more than static transaction rows.

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
| `fraud_ring` | Coordinated accounts linked by a shared `network_id`, shared devices, shared beneficiaries, and clustered cashout behavior. |
| `synthetic_identity` | New identity with repeated KYC friction and inconsistent identity signals. |
| `friendly_fraud` | Customer-like behavior that later produces disputes, reversals, or chargebacks. |
| `promo_abuse` | Low-value high-frequency activity designed to exploit incentives or referral rewards. |
| `merchant_collusion` | Suspicious users and high-risk merchants linked through repeated routed payments. |
| `refund_abuse` | Refund-heavy behavior with repeat reversals and merchant interactions. |
| `sanctions_false_positive` | Synthetic watchlist-like review signals without real sanctions or real people. |
| `structuring` | Repeated transactions intentionally kept below review thresholds. |
| `layering` | Rapid movement across rails, beneficiaries, or corridors to mimic AML layering behavior. |

### Fraud Rings and Networked Fraud

When `fraud_ring` is selected, the generator groups eligible fraud users into synthetic networks. Network members receive the same `network_id`, and suspicious transactions can reference shared ring devices and beneficiaries. The output still uses the normal `users`, `devices`, `beneficiaries`, and `transactions` files, so graph systems can connect users through repeated `network_id`, `device_id`, and `beneficiary_id` values without requiring a separate graph export.

## Example Output

User:

```json
{
  "user_id": "usr_693649_684895",
  "country": "NG",
  "identity_type": "bvn_like_id",
  "kyc_provider": "synthetic_bvn_check",
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
  "reason_codes": ["NEW_ACCOUNT", "HIGH_BENEFICIARY_COUNT", "RAPID_FUNDS_MOVEMENT"],
  "network_id": null
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
  "payment_rail": "bank_transfer",
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
  "reason_codes": ["NEW_ACCOUNT", "HIGH_BENEFICIARY_COUNT", "RAPID_FUNDS_MOVEMENT"],
  "network_id": null
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
  platform: 'fintech',
  paymentRails: ['bank_transfer', 'wallet_transfer', 'card'],
  patterns: ['mule_account', 'account_takeover', 'structuring'],
  patternWeights: {
    mule_account: 4,
    account_takeover: 2,
    structuring: 1
  },
  seed: 'demo',
  transactionsMin: 1,
  transactionsMax: 20,
  pretty: false,
  useCase: 'consumer_fintech'
});
```

Validate generated data in code:

```ts
import { generateDataset, validateDataset } from 'fintech-fraud-sim';

const dataset = generateDataset({
  users: 500,
  fraudRate: 0.1,
  format: 'json',
  out: './output',
  country: 'GB',
  currency: 'GBP',
  patterns: ['structuring', 'layering'],
  transactionsMin: 1,
  transactionsMax: 12,
  pretty: false
});

const validation = validateDataset(dataset);
if (!validation.valid) {
  console.error(validation.issues);
}
```

Use presets directly when you want realistic defaults that still stay fully deterministic with a seed:

```ts
import { USE_CASE_PRESETS, generateDataset } from 'fintech-fraud-sim';

const preset = USE_CASE_PRESETS.crypto_exchange;

const dataset = generateDataset({
  ...preset.defaults,
  format: 'ndjson',
  out: './aml-fixtures',
  seed: 'aml-regression-001',
  pretty: false,
  useCase: preset.name
});
```
