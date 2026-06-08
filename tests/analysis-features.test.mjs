import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateDataset } from '../dist/generator.js';
import { writeJson } from '../dist/writers/json.js';
import { buildDashboardSummary, writeDashboardFromDirectory } from '../dist/dashboard.js';
import { buildFraudGraph, writeGraphExportFromDirectory } from '../dist/graph.js';
import { simulateRules, simulateRulesFromDirectory } from '../dist/rules.js';

function fixtureDataset(out) {
  return generateDataset({
    users: 30,
    fraudRate: 0.2,
    format: 'json',
    out,
    country: 'GB',
    currency: 'GBP',
    patterns: ['fraud_ring', 'account_takeover', 'beneficiary_burst'],
    seed: 'analysis-features-test',
    transactionsMin: 2,
    transactionsMax: 6,
    pretty: true
  });
}

describe('analysis features', () => {
  it('builds an interactive dashboard from generated JSON output', async () => {
    const out = await mkdtemp(join(tmpdir(), 'fintech-fraud-dashboard-'));
    const dataset = fixtureDataset(out);

    try {
      await writeJson(dataset, out, true);
      const summary = buildDashboardSummary(dataset);
      assert.equal(summary.total_users, 30);
      assert.ok(summary.suspicious_transactions > 0);

      const dashboardPath = join(out, 'dashboard.html');
      const written = await writeDashboardFromDirectory(out, dashboardPath);
      const html = await readFile(dashboardPath, 'utf8');

      assert.equal(written.total_transactions, dataset.transactions.length);
      assert.match(html, /Transaction explorer/);
      assert.match(html, /Fraud networks/);
      assert.match(html, /const data = /);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  it('exports fraud network graphs as JSON and CSV', async () => {
    const out = await mkdtemp(join(tmpdir(), 'fintech-fraud-graph-'));
    const dataset = fixtureDataset(out);

    try {
      await writeJson(dataset, out, true);
      const graph = buildFraudGraph(dataset);
      assert.ok(graph.nodes.some((node) => node.label === 'User'));
      assert.ok(graph.nodes.some((node) => node.label === 'Transaction'));
      assert.ok(graph.edges.some((edge) => edge.type === 'INITIATED'));

      const jsonPath = join(out, 'graph.json');
      const written = await writeGraphExportFromDirectory(out, jsonPath, 'json');
      const parsed = JSON.parse(await readFile(jsonPath, 'utf8'));
      assert.equal(parsed.summary.nodes, written.summary.nodes);

      const csvDir = join(out, 'graph-csv');
      await writeGraphExportFromDirectory(out, csvDir, 'csv');
      assert.match(await readFile(join(csvDir, 'nodes.csv'), 'utf8'), /id,label,properties/);
      assert.match(await readFile(join(csvDir, 'edges.csv'), 'utf8'), /source,target,type/);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  it('simulates JSON rules against generated transactions', async () => {
    const out = await mkdtemp(join(tmpdir(), 'fintech-fraud-rules-'));
    const dataset = fixtureDataset(out);
    const rulePack = {
      name: 'high-risk-review',
      rules: [
        {
          id: 'high_risk_score',
          action: 'block',
          conditions: [{ field: 'risk_score', operator: 'gte', value: 75 }]
        },
        {
          id: 'country_mismatch',
          action: 'review',
          conditions: [{ field: 'country_mismatch', operator: 'eq', value: true }]
        }
      ]
    };

    try {
      await writeJson(dataset, out, true);
      const summary = simulateRules(dataset, rulePack);
      assert.equal(summary.total_transactions, dataset.transactions.length);
      assert.ok(summary.matched_transactions > 0);
      assert.ok(summary.precision >= 0);
      assert.ok(summary.rule_breakdown.high_risk_score > 0);

      const rulesPath = join(out, 'rules.json');
      const resultPath = join(out, 'rules-result.json');
      await writeFile(rulesPath, JSON.stringify(rulePack));
      await simulateRulesFromDirectory(out, rulesPath, resultPath, true);
      const written = JSON.parse(await readFile(resultPath, 'utf8'));
      assert.equal(written.rule_pack, 'high-risk-review');
      assert.ok(Array.isArray(written.matches));
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});
