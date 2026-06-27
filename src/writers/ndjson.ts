import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GeneratedDataset } from '../types.js';

export async function writeNdjson(dataset: GeneratedDataset, outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(join(outDir, 'users.ndjson'), toNdjson(dataset.users)),
    writeFile(join(outDir, 'accounts.ndjson'), toNdjson(dataset.accounts)),
    writeFile(join(outDir, 'devices.ndjson'), toNdjson(dataset.devices)),
    writeFile(join(outDir, 'beneficiaries.ndjson'), toNdjson(dataset.beneficiaries)),
    writeFile(join(outDir, 'merchants.ndjson'), toNdjson(dataset.merchants)),
    writeFile(join(outDir, 'transactions.ndjson'), toNdjson(dataset.transactions)),
    writeFile(join(outDir, 'events.ndjson'), toNdjson(dataset.events)),
    writeFile(join(outDir, 'summary.ndjson'), toNdjson([dataset.summary]))
  ]);
}

export function toNdjson(rows: object[]): string {
  return `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
}
