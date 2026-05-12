import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const execFileAsync = promisify(execFile);

describe('CLI', () => {
  it('generates JSON files from the generate command', async () => {
    const out = await mkdtemp(join(tmpdir(), 'fintech-fraud-sim-'));

    try {
      const result = await execFileAsync(process.execPath, [
        'dist/cli.js',
        'generate',
        '--users',
        '20',
        '--fraud-rate',
        '0.2',
        '--format',
        'json',
        '--out',
        out,
        '--seed',
        'cli-test'
      ]);

      assert.match(result.stdout, /Generated 20 users/);
      const summary = JSON.parse(await readFile(join(out, 'summary.json'), 'utf8'));
      assert.equal(summary.total_users, 20);
      assert.equal(summary.fraud_users_generated, 4);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});
