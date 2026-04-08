import test from 'node:test';
import assert from 'node:assert/strict';
import { LogWhispererConfig, LogWhispererShipper } from './logWhispererShipper';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createConfig(overrides: Partial<LogWhispererConfig> = {}): LogWhispererConfig {
  return {
    enabled: true,
    pushUrl: 'http://localhost:4318/api/v1/logs/push',
    service: 'sentinel-stack',
    source: 'render-webapp',
    batchSize: 50,
    flushMs: 5000,
    requestTimeoutMs: 1000,
    maxQueueSize: 5000,
    retryBaseMs: 20,
    retryMaxMs: 50,
    redactionFields: ['password', 'authorization', 'token'],
    ...overrides,
  };
}

test('batches logs and sends when batch size is reached', async () => {
  const requests: any[] = [];
  const shipper = new LogWhispererShipper(createConfig({ batchSize: 3, flushMs: 60_000 }), {
    fetchImpl: async (_url, init) => {
      requests.push(JSON.parse(String(init?.body || '{}')));
      return { ok: true, status: 200 } as Response;
    },
  });

  shipper.info('one', { sequence: 1 });
  shipper.info('two', { sequence: 2 });
  await wait(40);
  assert.equal(requests.length, 0);

  shipper.info('three', { sequence: 3 });
  await wait(40);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].lines.length, 3);
  assert.equal(shipper.getStats().totalSent, 3);
  await shipper.shutdown();
});

test('retries with exponential backoff on network failure', async () => {
  let attempt = 0;
  const shipper = new LogWhispererShipper(createConfig({ batchSize: 1, retryBaseMs: 15, retryMaxMs: 30 }), {
    fetchImpl: async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error('network down');
      }
      return { ok: true, status: 200 } as Response;
    },
  });

  shipper.error('retry-me', { id: 'abc' });
  await wait(140);

  assert.equal(attempt >= 2, true);
  assert.equal(shipper.getStats().totalSent, 1);
  assert.equal(shipper.getStats().totalFailed, 1);
  await shipper.shutdown();
});

test('shutdown flushes queued logs before exit', async () => {
  const requests: any[] = [];
  const shipper = new LogWhispererShipper(createConfig({ batchSize: 50, flushMs: 60_000 }), {
    fetchImpl: async (_url, init) => {
      requests.push(JSON.parse(String(init?.body || '{}')));
      return { ok: true, status: 200 } as Response;
    },
  });

  shipper.warn('queued-1');
  shipper.warn('queued-2');
  shipper.warn('queued-3');

  await shipper.shutdown(2000);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].lines.length, 3);
  assert.equal(shipper.getStats().queuedCount, 0);
  assert.equal(shipper.getStats().totalSent, 3);
});

test('push payload matches expected schema and redacts sensitive fields', async () => {
  let capturedPayload: any = null;
  let capturedHeaders: any = null;

  const shipper = new LogWhispererShipper(
    createConfig({ batchSize: 1, apiKey: 'test-api-key' }),
    {
      fetchImpl: async (_url, init) => {
        capturedPayload = JSON.parse(String(init?.body || '{}'));
        capturedHeaders = init?.headers;
        return { ok: true, status: 200 } as Response;
      },
    }
  );

  shipper.info('request completed', {
    http_status: 200,
    response_time_ms: 12,
    authorization: 'Bearer secret-token',
    nested: {
      password: 'super-secret',
    },
  });

  await wait(40);
  await shipper.shutdown();

  assert.equal(capturedPayload.source, 'render-webapp');
  assert.equal(capturedPayload.format_hint, 'json');
  assert.equal(capturedPayload.service_override, 'sentinel-stack');
  assert.equal(Array.isArray(capturedPayload.lines), true);

  const parsedLine = JSON.parse(capturedPayload.lines[0]);
  assert.equal(typeof parsedLine.timestamp, 'string');
  assert.equal(parsedLine.service, 'sentinel-stack');
  assert.equal(parsedLine.level, 'INFO');
  assert.equal(parsedLine.message, 'request completed');
  assert.equal(parsedLine.metadata.http_status, 200);
  assert.equal(parsedLine.metadata.response_time_ms, 12);
  assert.equal(parsedLine.metadata.authorization, '[REDACTED]');
  assert.equal(parsedLine.metadata.nested.password, '[REDACTED]');

  assert.equal((capturedHeaders as Record<string, string>)['x-api-key'], 'test-api-key');
});
