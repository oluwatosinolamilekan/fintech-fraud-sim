import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const execFileAsync = promisify(execFile);

describe('CLI', () => {
  it('reports the package version', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
    const result = await execFileAsync(process.execPath, ['dist/cli.js', '--version']);

    assert.equal(result.stdout.trim(), packageJson.version);
  });

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
      const users = JSON.parse(await readFile(join(out, 'users.json'), 'utf8'));
      const accounts = JSON.parse(await readFile(join(out, 'accounts.json'), 'utf8'));
      assert.equal(summary.total_users, 20);
      assert.equal(summary.total_accounts, 20);
      assert.equal(summary.fraud_users_generated, 4);
      assert.equal(accounts.length, 20);
      assert.equal(typeof users[0].risk_score, 'number');
      assert.ok(['allow', 'review', 'block'].includes(users[0].recommended_action));
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  it('prints preview samples without writing files', async () => {
    const result = await execFileAsync(process.execPath, [
      'dist/cli.js',
      'preview',
      '--users',
      '10',
      '--fraud-rate',
      '0.2',
      '--limit',
      '2',
      '--seed',
      'preview-test'
    ]);

    const preview = JSON.parse(result.stdout);
    assert.equal(preview.summary.total_users, 10);
    assert.equal(preview.users.length, 2);
    assert.equal(preview.transactions.length, 2);
    assert.equal(typeof preview.users[0].risk_score, 'number');
  });

  it('lists production use cases and applies a use case preset', async () => {
    const cases = await execFileAsync(process.execPath, ['dist/cli.js', 'use-cases']);
    const parsedCases = JSON.parse(cases.stdout);
    assert.ok(parsedCases.some((useCase) => useCase.name === 'social_payments'));

    const result = await execFileAsync(process.execPath, [
      'dist/cli.js',
      'preview',
      '--use-case',
      'social_payments',
      '--limit',
      '1',
      '--seed',
      'social-case'
    ]);
    const preview = JSON.parse(result.stdout);

    assert.equal(preview.summary.use_case, 'social_payments');
    assert.equal(preview.summary.total_users, 8000);
    assert.equal(preview.summary.fraud_rate_requested, 0.06);
  });

  it('prints and exports JSON schemas', async () => {
    const out = await mkdtemp(join(tmpdir(), 'fintech-fraud-sim-schema-'));

    try {
      const printed = await execFileAsync(process.execPath, [
        'dist/cli.js',
        'schema',
        '--target',
        'users',
        '--pretty'
      ]);
      const schema = JSON.parse(printed.stdout);

      assert.equal(schema.title, 'fintech-fraud-sim user');
      assert.ok(schema.required.includes('risk_score'));
      assert.ok(schema.required.includes('recommended_action'));
      const printedSummary = await execFileAsync(process.execPath, ['dist/cli.js', 'schema', '--target', 'summary']);
      assert.ok(JSON.parse(printedSummary.stdout).required.includes('use_case'));

      await execFileAsync(process.execPath, ['dist/cli.js', 'schema', '--target', 'all', '--out', out]);
      assert.equal(JSON.parse(await readFile(join(out, 'users.schema.json'), 'utf8')).title, 'fintech-fraud-sim user');
      assert.equal(JSON.parse(await readFile(join(out, 'accounts.schema.json'), 'utf8')).title, 'fintech-fraud-sim account');
      assert.equal(
        JSON.parse(await readFile(join(out, 'transactions.schema.json'), 'utf8')).title,
        'fintech-fraud-sim transaction'
      );
      assert.equal(JSON.parse(await readFile(join(out, 'summary.schema.json'), 'utf8')).title, 'fintech-fraud-sim summary');
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});
