import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { readGeneratedDataset } from './dataset-io.js';
import type { GeneratedDataset } from './types.js';
import { toCsv } from './writers/csv.js';

export type GraphExportFormat = 'json' | 'csv' | 'cypher' | 'graphml';

export interface GraphNode {
  id: string;
  label: string;
  properties: Record<string, string | number | boolean | null>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, string | number | boolean | null>;
}

export interface FraudGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: {
    nodes: number;
    edges: number;
    fraud_networks: number;
    suspicious_transactions: number;
  };
}

export async function writeGraphExportFromDirectory(inputDir: string, outPath: string, format: GraphExportFormat): Promise<FraudGraph> {
  const dataset = await readGeneratedDataset(inputDir);
  const graph = buildFraudGraph(dataset);

  if (format === 'csv') {
    await mkdir(outPath, { recursive: true });
    await Promise.all([
      writeFile(join(outPath, 'nodes.csv'), toGraphNodeCsv(graph.nodes)),
      writeFile(join(outPath, 'edges.csv'), toGraphEdgeCsv(graph.edges)),
      writeFile(join(outPath, 'graph_summary.json'), JSON.stringify(graph.summary, null, 2))
    ]);
    return graph;
  }

  await mkdir(dirname(outPath), { recursive: true });
  const body = format === 'json'
    ? JSON.stringify(graph, null, 2)
    : format === 'cypher'
      ? toCypher(graph)
      : toGraphMl(graph);
  await writeFile(outPath, body);
  return graph;
}

export function buildFraudGraph(dataset: GeneratedDataset): FraudGraph {
  const nodesById = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const addNode = (node: GraphNode): void => {
    nodesById.set(node.id, node);
  };
  const addEdge = (source: string, target: string, type: string, properties: GraphEdge['properties'] = {}): void => {
    if (!nodesById.has(source) || !nodesById.has(target)) return;
    edges.push({
      id: `edge_${edges.length + 1}`,
      source,
      target,
      type,
      properties
    });
  };

  for (const user of dataset.users) {
    addNode({
      id: user.user_id,
      label: 'User',
      properties: {
        country: user.country,
        is_fraud: user.is_fraud,
        fraud_pattern: user.fraud_pattern,
        risk_score: user.risk_score,
        recommended_action: user.recommended_action,
        network_id: user.network_id
      }
    });
    if (user.network_id) {
      addNode({
        id: user.network_id,
        label: 'FraudNetwork',
        properties: { network_id: user.network_id }
      });
    }
  }

  for (const account of dataset.accounts) {
    addNode({
      id: account.account_id,
      label: 'Account',
      properties: {
        account_type: account.account_type,
        currency: account.currency,
        balance: account.balance,
        status: account.status,
        is_fraud_linked: account.is_fraud_linked
      }
    });
  }

  for (const device of dataset.devices) {
    addNode({
      id: device.device_id,
      label: 'Device',
      properties: {
        device_type: device.device_type,
        os: device.os,
        country: device.country,
        is_trusted: device.is_trusted,
        is_fraud_linked: device.is_fraud_linked,
        network_id: device.network_id
      }
    });
  }

  for (const beneficiary of dataset.beneficiaries) {
    addNode({
      id: beneficiary.beneficiary_id,
      label: 'Beneficiary',
      properties: {
        beneficiary_type: beneficiary.beneficiary_type,
        beneficiary_country: beneficiary.beneficiary_country,
        is_recent: beneficiary.is_recent,
        is_fraud_linked: beneficiary.is_fraud_linked,
        network_id: beneficiary.network_id
      }
    });
  }

  for (const merchant of dataset.merchants) {
    addNode({
      id: merchant.merchant_id,
      label: 'Merchant',
      properties: {
        merchant_name: merchant.merchant_name,
        category: merchant.category,
        country: merchant.country,
        risk_tier: merchant.risk_tier,
        is_high_risk: merchant.is_high_risk
      }
    });
  }

  for (const transaction of dataset.transactions) {
    addNode({
      id: transaction.transaction_id,
      label: 'Transaction',
      properties: {
        amount: transaction.amount,
        currency: transaction.currency,
        payment_rail: transaction.payment_rail,
        channel: transaction.channel,
        status: transaction.status,
        is_suspicious: transaction.is_suspicious,
        fraud_pattern: transaction.fraud_pattern,
        risk_score: transaction.risk_score,
        recommended_action: transaction.recommended_action,
        network_id: transaction.network_id
      }
    });
  }

  for (const user of dataset.users) {
    if (user.network_id) addEdge(user.user_id, user.network_id, 'MEMBER_OF', { fraud_pattern: user.fraud_pattern });
  }
  for (const account of dataset.accounts) addEdge(account.user_id, account.account_id, 'OWNS', {});
  for (const device of dataset.devices) addEdge(device.user_id, device.device_id, 'USES_DEVICE', {});
  for (const beneficiary of dataset.beneficiaries) addEdge(beneficiary.user_id, beneficiary.beneficiary_id, 'ADDED_BENEFICIARY', {});
  for (const transaction of dataset.transactions) {
    addEdge(transaction.user_id, transaction.transaction_id, 'INITIATED', { is_suspicious: transaction.is_suspicious });
    addEdge(transaction.account_id, transaction.transaction_id, 'FUNDED', {});
    addEdge(transaction.transaction_id, transaction.device_id, 'USED_DEVICE', {});
    addEdge(transaction.transaction_id, transaction.beneficiary_id, 'PAID_BENEFICIARY', {});
    addEdge(transaction.transaction_id, transaction.merchant_id, 'AT_MERCHANT', {});
    if (transaction.network_id) addEdge(transaction.transaction_id, transaction.network_id, 'LINKED_TO_NETWORK', {});
  }

  const nodes = [...nodesById.values()];
  return {
    nodes,
    edges,
    summary: {
      nodes: nodes.length,
      edges: edges.length,
      fraud_networks: new Set(dataset.users.map((user) => user.network_id).filter(Boolean)).size,
      suspicious_transactions: dataset.transactions.filter((transaction) => transaction.is_suspicious).length
    }
  };
}

export function toGraphNodeCsv(nodes: GraphNode[]): string {
  return toCsv(
    nodes.map((node) => ({
      id: node.id,
      label: node.label,
      properties: JSON.stringify(node.properties)
    })),
    ['id', 'label', 'properties']
  );
}

export function toGraphEdgeCsv(edges: GraphEdge[]): string {
  return toCsv(
    edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      properties: JSON.stringify(edge.properties)
    })),
    ['id', 'source', 'target', 'type', 'properties']
  );
}

export function toCypher(graph: FraudGraph): string {
  const nodeStatements = graph.nodes.map((node) => {
    const properties = { id: node.id, ...node.properties };
    return `MERGE (n:${safeCypherName(node.label)} {id: ${cypherValue(node.id)}}) SET n += ${cypherValue(properties)};`;
  });
  const edgeStatements = graph.edges.map((edge) => {
    const properties = { id: edge.id, ...edge.properties };
    return `MATCH (source {id: ${cypherValue(edge.source)}}), (target {id: ${cypherValue(edge.target)}}) MERGE (source)-[r:${safeCypherName(edge.type)} {id: ${cypherValue(edge.id)}}]->(target) SET r += ${cypherValue(properties)};`;
  });
  return [...nodeStatements, ...edgeStatements, ''].join('\n');
}

export function toGraphMl(graph: FraudGraph): string {
  const nodes = graph.nodes.map((node) => `    <node id="${xml(node.id)}">
      <data key="label">${xml(node.label)}</data>
      <data key="properties">${xml(JSON.stringify(node.properties))}</data>
    </node>`).join('\n');
  const edges = graph.edges.map((edge) => `    <edge id="${xml(edge.id)}" source="${xml(edge.source)}" target="${xml(edge.target)}">
      <data key="type">${xml(edge.type)}</data>
      <data key="properties">${xml(JSON.stringify(edge.properties))}</data>
    </edge>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <key id="label" for="node" attr.name="label" attr.type="string"/>
  <key id="properties" for="all" attr.name="properties" attr.type="string"/>
  <key id="type" for="edge" attr.name="type" attr.type="string"/>
  <graph id="fintech-fraud-sim" edgedefault="directed">
${nodes}
${edges}
  </graph>
</graphml>
`;
}

function cypherValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(cypherValue).join(', ')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${safeCypherName(key)}: ${cypherValue(item)}`)
      .join(', ')}}`;
  }
  return JSON.stringify(String(value));
}

function safeCypherName(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, '_') || 'value';
}

function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
