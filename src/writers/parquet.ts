import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GeneratedDataset } from '../types.js';

const TABLES = [
  'users',
  'accounts',
  'devices',
  'beneficiaries',
  'merchants',
  'transactions',
  'events',
  'summary'
] as const;

type TableName = (typeof TABLES)[number];

export async function writeParquet(dataset: GeneratedDataset, outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const rowsByTable: Record<TableName, object[]> = {
    users: dataset.users,
    accounts: dataset.accounts,
    devices: dataset.devices,
    beneficiaries: dataset.beneficiaries,
    merchants: dataset.merchants,
    transactions: dataset.transactions,
    events: dataset.events,
    summary: [dataset.summary]
  };
  const manifest = {
    format: 'parquet-fallback-json',
    note: 'Dependency-free fallback. Files use .parquet names but contain columnar JSON payloads; install a Parquet writer integration before using them as binary Parquet.',
    tables: Object.fromEntries(TABLES.map((table) => [table, `${table}.parquet`]))
  };

  await Promise.all([
    ...TABLES.map((table) => writeFile(join(outDir, `${table}.parquet`), toColumnarJson(rowsByTable[table]))),
    writeFile(join(outDir, 'parquet_manifest.json'), JSON.stringify(manifest, null, 2))
  ]);
}

function toColumnarJson(rows: object[]): string {
  const columns = new Map<string, unknown[]>();
  for (const [rowIndex, row] of rows.entries()) {
    const record = row as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!columns.has(key)) {
        columns.set(key, Array.from({ length: rowIndex }, () => null));
      }
    }
    for (const [key, values] of columns) {
      values.push(record[key] ?? null);
    }
  }
  return JSON.stringify({ rows: rows.length, columns: Object.fromEntries(columns) });
}
