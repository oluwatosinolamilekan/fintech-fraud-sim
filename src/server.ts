import { createServer, type ServerResponse } from 'node:http';
import { readGeneratedDataset } from './dataset-io.js';

export interface ServeOptions {
  input: string;
  port?: number;
}

export async function serveDataset(options: ServeOptions): Promise<{ url: string; close: () => Promise<void> }> {
  const dataset = await readGeneratedDataset(options.input);
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    response.setHeader('access-control-allow-origin', '*');
    response.setHeader('content-type', 'application/json; charset=utf-8');

    if (url.pathname === '/summary') return send(response, dataset.summary);
    if (url.pathname === '/users') return send(response, dataset.users);
    if (url.pathname === '/accounts') return send(response, dataset.accounts);
    if (url.pathname === '/devices') return send(response, dataset.devices);
    if (url.pathname === '/beneficiaries') return send(response, dataset.beneficiaries);
    if (url.pathname === '/merchants') return send(response, dataset.merchants);
    if (url.pathname === '/transactions') return send(response, dataset.transactions);
    if (url.pathname === '/events') return send(response, dataset.events);
    if (url.pathname.startsWith('/risk/')) {
      const transactionId = decodeURIComponent(url.pathname.slice('/risk/'.length));
      const transaction = dataset.transactions.find((row) => row.transaction_id === transactionId);
      if (!transaction) return send(response, { error: 'transaction not found' }, 404);
      return send(response, {
        transaction_id: transaction.transaction_id,
        risk_score: transaction.risk_score,
        recommended_action: transaction.recommended_action,
        is_suspicious: transaction.is_suspicious,
        fraud_pattern: transaction.fraud_pattern,
        reason_codes: transaction.reason_codes
      });
    }
    return send(response, {
      name: 'fintech-fraud-sim API',
      endpoints: ['/summary', '/users', '/accounts', '/devices', '/beneficiaries', '/merchants', '/transactions', '/events', '/risk/:transactionId']
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 3333, resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : options.port ?? 3333;
  return {
    url: `http://localhost:${port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

function send(response: ServerResponse, body: unknown, status = 200): void {
  response.statusCode = status;
  response.end(JSON.stringify(body));
}
