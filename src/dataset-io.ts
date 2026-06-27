import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  GeneratedDataset,
  SyntheticAccount,
  SyntheticBeneficiary,
  SyntheticDevice,
  SyntheticEvent,
  SyntheticMerchant,
  SyntheticTransaction,
  SyntheticUser
} from './types.js';

export async function readGeneratedDataset(inputDir: string): Promise<GeneratedDataset> {
  const [users, accounts, devices, beneficiaries, merchants, transactions, events, summary] = await Promise.all([
    readJson<SyntheticUser[]>(join(inputDir, 'users.json')),
    readJson<SyntheticAccount[]>(join(inputDir, 'accounts.json')),
    readJson<SyntheticDevice[]>(join(inputDir, 'devices.json')),
    readJson<SyntheticBeneficiary[]>(join(inputDir, 'beneficiaries.json')),
    readJson<SyntheticMerchant[]>(join(inputDir, 'merchants.json')),
    readJson<SyntheticTransaction[]>(join(inputDir, 'transactions.json')),
    readOptionalJson<SyntheticEvent[]>(join(inputDir, 'events.json'), []),
    readJson<GeneratedDataset['summary']>(join(inputDir, 'summary.json'))
  ]);

  return { users, accounts, devices, beneficiaries, merchants, transactions, events, summary };
}

async function readJson<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as T;
}

async function readOptionalJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return await readJson<T>(path);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}
