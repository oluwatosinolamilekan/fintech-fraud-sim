import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { readGeneratedDataset } from './dataset-io.js';
import type { GeneratedDataset, RiskLabel } from './types.js';

export interface DashboardSummary {
  total_users: number;
  total_transactions: number;
  suspicious_transactions: number;
  fraud_users: number;
  total_amount: number;
  suspicious_amount: number;
  fraud_rate: number;
  review_rate: number;
  top_patterns: Record<string, number>;
  top_reason_codes: Record<string, number>;
  risk_labels: Record<RiskLabel, number>;
  payment_rails: Record<string, number>;
  corridors: Record<string, number>;
}

export async function writeDashboardFromDirectory(inputDir: string, outPath: string): Promise<DashboardSummary> {
  const dataset = await readGeneratedDataset(inputDir);
  const summary = buildDashboardSummary(dataset);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, renderDashboardHtml(dataset, summary));
  return summary;
}

export function buildDashboardSummary(dataset: GeneratedDataset): DashboardSummary {
  const suspiciousTransactions = dataset.transactions.filter((transaction) => transaction.is_suspicious);
  const reviewTransactions = dataset.transactions.filter((transaction) => transaction.recommended_action !== 'allow');
  return {
    total_users: dataset.users.length,
    total_transactions: dataset.transactions.length,
    suspicious_transactions: suspiciousTransactions.length,
    fraud_users: dataset.users.filter((user) => user.is_fraud).length,
    total_amount: money(dataset.transactions.reduce((total, transaction) => total + transaction.amount, 0)),
    suspicious_amount: money(suspiciousTransactions.reduce((total, transaction) => total + transaction.amount, 0)),
    fraud_rate: ratio(dataset.users.filter((user) => user.is_fraud).length, dataset.users.length),
    review_rate: ratio(reviewTransactions.length, dataset.transactions.length),
    top_patterns: topCounts(dataset.transactions.map((transaction) => transaction.fraud_pattern).filter((pattern) => pattern !== 'none')),
    top_reason_codes: topCounts(dataset.transactions.flatMap((transaction) => transaction.reason_codes)),
    risk_labels: {
      low: dataset.users.filter((user) => user.risk_label === 'low').length,
      medium: dataset.users.filter((user) => user.risk_label === 'medium').length,
      high: dataset.users.filter((user) => user.risk_label === 'high').length,
      critical: dataset.users.filter((user) => user.risk_label === 'critical').length
    },
    payment_rails: topCounts(dataset.transactions.map((transaction) => transaction.payment_rail)),
    corridors: topCounts(dataset.transactions.map((transaction) => `${transaction.ip_country}-${transaction.beneficiary_country}`))
  };
}

export function renderDashboardHtml(dataset: GeneratedDataset, summary = buildDashboardSummary(dataset)): string {
  const payload = {
    summary,
    transactions: dataset.transactions.map((transaction) => ({
      transaction_id: transaction.transaction_id,
      user_id: transaction.user_id,
      amount: transaction.amount,
      currency: transaction.currency,
      payment_rail: transaction.payment_rail,
      channel: transaction.channel,
      status: transaction.status,
      fraud_pattern: transaction.fraud_pattern,
      risk_score: transaction.risk_score,
      recommended_action: transaction.recommended_action,
      is_suspicious: transaction.is_suspicious,
      reason_codes: transaction.reason_codes,
      corridor: `${transaction.ip_country}-${transaction.beneficiary_country}`,
      timestamp: transaction.timestamp,
      network_id: transaction.network_id
    })),
    networks: dataset.users
      .filter((user) => user.network_id)
      .map((user) => ({
        user_id: user.user_id,
        network_id: user.network_id,
        fraud_pattern: user.fraud_pattern,
        risk_score: user.risk_score,
        reason_codes: user.reason_codes
      }))
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>fintech-fraud-sim dashboard</title>
  <style>
    :root { color-scheme: light; --ink:#1f2933; --muted:#627083; --line:#d8dee7; --bg:#f7f8fb; --panel:#fff; --accent:#0f766e; --warn:#b45309; --bad:#be123c; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 14px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
    header { padding: 22px 28px 16px; border-bottom: 1px solid var(--line); background: var(--panel); }
    h1 { margin: 0 0 4px; font-size: 24px; letter-spacing: 0; }
    h2 { margin: 0 0 12px; font-size: 16px; }
    main { padding: 20px 28px 32px; display: grid; gap: 18px; }
    .subtle { color: var(--muted); }
    .metrics { display: grid; grid-template-columns: repeat(6, minmax(130px, 1fr)); gap: 12px; }
    .metric, section { border: 1px solid var(--line); background: var(--panel); border-radius: 8px; }
    .metric { padding: 12px; min-height: 86px; }
    .metric span { display: block; color: var(--muted); font-size: 12px; }
    .metric strong { display: block; margin-top: 8px; font-size: 22px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(280px, 1fr)); gap: 18px; }
    section { padding: 16px; overflow: hidden; }
    .bars { display: grid; gap: 8px; }
    .bar { display: grid; grid-template-columns: minmax(110px, 1fr) 4fr auto; gap: 10px; align-items: center; }
    .track { height: 10px; border-radius: 999px; background: #edf1f5; overflow: hidden; }
    .fill { height: 100%; background: var(--accent); }
    .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    input, select { height: 36px; border: 1px solid var(--line); border-radius: 6px; padding: 0 10px; background: #fff; color: var(--ink); }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { padding: 8px 6px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { color: var(--muted); font-size: 12px; font-weight: 600; }
    .pill { display: inline-flex; border-radius: 999px; padding: 2px 7px; font-size: 12px; background: #eef5f4; color: #115e59; }
    .pill.block { background: #fff1f2; color: var(--bad); }
    .pill.review { background: #fff7ed; color: var(--warn); }
    @media (max-width: 1000px) { .metrics { grid-template-columns: repeat(2, minmax(130px, 1fr)); } .grid { grid-template-columns: 1fr; } }
    @media (max-width: 640px) { header, main { padding-left: 14px; padding-right: 14px; } .metrics { grid-template-columns: 1fr; } .bar { grid-template-columns: 1fr; } table { font-size: 12px; } }
  </style>
</head>
<body>
  <header>
    <h1>fintech-fraud-sim dashboard</h1>
    <div class="subtle">Interactive synthetic fraud dataset review</div>
  </header>
  <main>
    <div class="metrics" id="metrics"></div>
    <div class="grid">
      <section><h2>Fraud patterns</h2><div class="bars" id="patterns"></div></section>
      <section><h2>Reason codes</h2><div class="bars" id="reasons"></div></section>
      <section><h2>Payment rails</h2><div class="bars" id="rails"></div></section>
      <section><h2>Corridors</h2><div class="bars" id="corridors"></div></section>
    </div>
    <section>
      <h2>Transaction explorer</h2>
      <div class="controls">
        <input id="search" placeholder="Search transaction, user, reason">
        <select id="action"><option value="">All actions</option><option value="allow">Allow</option><option value="review">Review</option><option value="block">Block</option></select>
        <select id="suspicious"><option value="">All labels</option><option value="true">Suspicious</option><option value="false">Not suspicious</option></select>
        <select id="pattern"><option value="">All patterns</option></select>
      </div>
      <table>
        <thead><tr><th>Transaction</th><th>Amount</th><th>Risk</th><th>Pattern</th><th>Action</th><th>Reasons</th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </section>
    <section>
      <h2>Fraud networks</h2>
      <table>
        <thead><tr><th>Network</th><th>User</th><th>Pattern</th><th>Risk</th><th>Reasons</th></tr></thead>
        <tbody id="networkRows"></tbody>
      </table>
    </section>
  </main>
  <script>
    const data = ${safeJson(payload)};
    const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
    const money = (value) => fmt.format(value);
    const text = (value) => String(value ?? "");
    const metrics = [
      ["Users", data.summary.total_users],
      ["Transactions", data.summary.total_transactions],
      ["Fraud users", data.summary.fraud_users],
      ["Suspicious txns", data.summary.suspicious_transactions],
      ["Suspicious amount", data.summary.suspicious_amount],
      ["Review/block rate", Math.round(data.summary.review_rate * 100) + "%"]
    ];
    document.getElementById("metrics").innerHTML = metrics.map(([label, value]) => '<div class="metric"><span>' + label + '</span><strong>' + money(value) + '</strong></div>').join("");
    function renderBars(id, counts) {
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const max = Math.max(1, ...entries.map((entry) => entry[1]));
      document.getElementById(id).innerHTML = entries.length ? entries.map(([label, count]) => '<div class="bar"><span>' + label + '</span><div class="track"><div class="fill" style="width:' + ((count / max) * 100).toFixed(1) + '%"></div></div><strong>' + count + '</strong></div>').join("") : '<div class="subtle">No values</div>';
    }
    renderBars("patterns", data.summary.top_patterns);
    renderBars("reasons", data.summary.top_reason_codes);
    renderBars("rails", data.summary.payment_rails);
    renderBars("corridors", data.summary.corridors);
    const patternSelect = document.getElementById("pattern");
    [...new Set(data.transactions.map((row) => row.fraud_pattern))].sort().forEach((pattern) => {
      const option = document.createElement("option");
      option.value = pattern;
      option.textContent = pattern;
      patternSelect.appendChild(option);
    });
    function renderRows() {
      const search = document.getElementById("search").value.toLowerCase();
      const action = document.getElementById("action").value;
      const suspicious = document.getElementById("suspicious").value;
      const pattern = document.getElementById("pattern").value;
      const rows = data.transactions.filter((row) => {
        const haystack = [row.transaction_id, row.user_id, row.fraud_pattern, row.recommended_action, row.reason_codes.join(" ")].join(" ").toLowerCase();
        return (!search || haystack.includes(search)) && (!action || row.recommended_action === action) && (!suspicious || String(row.is_suspicious) === suspicious) && (!pattern || row.fraud_pattern === pattern);
      }).slice(0, 100);
      document.getElementById("rows").innerHTML = rows.map((row) => '<tr><td>' + row.transaction_id + '<br><span class="subtle">' + row.user_id + '</span></td><td>' + row.currency + ' ' + money(row.amount) + '<br><span class="subtle">' + row.payment_rail + '</span></td><td>' + row.risk_score + '</td><td>' + row.fraud_pattern + '</td><td><span class="pill ' + row.recommended_action + '">' + row.recommended_action + '</span></td><td>' + row.reason_codes.join(", ") + '</td></tr>').join("");
    }
    ["search", "action", "suspicious", "pattern"].forEach((id) => document.getElementById(id).addEventListener("input", renderRows));
    renderRows();
    document.getElementById("networkRows").innerHTML = data.networks.slice(0, 100).map((row) => '<tr><td>' + row.network_id + '</td><td>' + row.user_id + '</td><td>' + row.fraud_pattern + '</td><td>' + row.risk_score + '</td><td>' + row.reason_codes.join(", ") + '</td></tr>').join("") || '<tr><td colspan="5" class="subtle">No linked fraud networks in this dataset.</td></tr>';
  </script>
</body>
</html>`;
}

function topCounts(values: string[], limit = 12): Record<string, number> {
  const counts = values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit));
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('</', '<\\/');
}
