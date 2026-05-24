import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BENCHMARK_SUITES,
  buildImpactReport,
  evaluatePredictions,
  generateBenchmarkSuite,
  parseBenchmarkSuite
} from '../dist/benchmarks.js';

describe('benchmark suites', () => {
  it('parses benchmark suite names and exposes UK/global relevance', () => {
    assert.equal(parseBenchmarkSuite('uk-fincrime'), 'uk_fincrime');
    assert.ok(BENCHMARK_SUITES.uk_fincrime.ukGlobalUsefulness.some((item) => item.includes('UK')));
    assert.ok(BENCHMARK_SUITES.cross_border_remittance.corridors.includes('GB-NG'));
  });

  it('generates deterministic benchmark datasets with impact reports', () => {
    const run = generateBenchmarkSuite('uk_fincrime', {
      users: 40,
      seed: 'benchmark-test',
      out: './output',
      format: 'json',
      pretty: false
    });

    assert.equal(run.dataset.summary.total_users, 40);
    assert.equal(run.dataset.summary.fraud_rate_requested, BENCHMARK_SUITES.uk_fincrime.defaults.fraudRate);
    assert.equal(run.report.suite, 'uk_fincrime');
    assert.ok(run.report.operational_impact.estimated_preventable_loss > 0);
    assert.ok(Object.keys(run.report.pattern_breakdown).length > 0);
  });

  it('evaluates model predictions with pattern-level metrics', () => {
    const run = generateBenchmarkSuite('open_banking_risk', {
      users: 30,
      seed: 'evaluation-test',
      out: './output',
      format: 'json',
      pretty: false
    });
    const predictions = new Map(
      run.dataset.transactions.map((transaction) => [
        transaction.transaction_id,
        { transaction_id: transaction.transaction_id, risk_score: transaction.risk_score }
      ])
    );
    const evaluation = evaluatePredictions(
      run.dataset.transactions,
      (transactionId) => predictions.get(transactionId),
      75
    );

    assert.equal(evaluation.total, run.dataset.transactions.length);
    assert.ok(evaluation.precision >= 0);
    assert.ok(evaluation.recall >= 0);
    assert.ok(Object.keys(evaluation.pattern_detection_rate).length > 0);
  });

  it('builds a generic impact report for generated datasets', () => {
    const run = generateBenchmarkSuite('global_fraud_mix', {
      users: 25,
      seed: 'impact-test',
      out: './output',
      format: 'json',
      pretty: false
    });
    const report = buildImpactReport(run.dataset, null, null);

    assert.equal(report.suite, null);
    assert.equal(report.totals.users, 25);
    assert.ok(report.economy_relevance.some((item) => item.includes('synthetic fraud data')));
  });
});
