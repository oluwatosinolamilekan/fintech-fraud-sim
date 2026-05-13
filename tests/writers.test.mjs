import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateDataset } from '../dist/generator.js';
import { writeCsv } from '../dist/writers/csv.js';
import { writeJson } from '../dist/writers/json.js';

describe('file writers', () => {
  it('writes CSV and JSON outputs', async () => {
    const out = await mkdtemp(join(tmpdir(), 'fintech-fraud-sim-writers-'));
    const dataset = generateDataset({
      users: 5,
      fraudRate: 0.2,
      format: 'both',
      out,
      country: 'NG',
      currency: 'NGN',
      patterns: ['beneficiary_burst'],
      seed: 'writer-test',
      transactionsMin: 1,
      transactionsMax: 2,
      pretty: true
    });

    try {
      await writeCsv(dataset, out);
      await writeJson(dataset, out, true);

      assert.match(await readFile(join(out, 'users.csv'), 'utf8'), /user_id,country/);
      assert.match(await readFile(join(out, 'users.csv'), 'utf8'), /risk_score,recommended_action/);
      assert.match(await readFile(join(out, 'transactions.csv'), 'utf8'), /risk_score,recommended_action/);
      assert.equal(JSON.parse(await readFile(join(out, 'users.json'), 'utf8')).length, 5);
      assert.equal(JSON.parse(await readFile(join(out, 'summary.json'), 'utf8')).total_users, 5);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});
