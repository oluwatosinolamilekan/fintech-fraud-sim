import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GeneratedDataset } from '../types.js';

export async function writeJson(dataset: GeneratedDataset, outDir: string, pretty = false): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const spaces = pretty ? 2 : 0;
  await Promise.all([
    writeFile(join(outDir, 'users.json'), JSON.stringify(dataset.users, null, spaces)),
    writeFile(join(outDir, 'transactions.json'), JSON.stringify(dataset.transactions, null, spaces)),
    writeFile(join(outDir, 'summary.json'), JSON.stringify(dataset.summary, null, 2))
  ]);
}
