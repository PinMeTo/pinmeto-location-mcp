import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const rootDir = join(__dirname, '..');
const bundlePath = join(rootDir, 'dist', 'index.mjs');

/** Drive one stdio session against the bundle and collect JSON-RPC responses. */
function driveServer(requests: object[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [bundlePath], {
      env: {
        ...process.env,
        PINMETO_ACCOUNT_ID: 'test_account',
        PINMETO_APP_ID: 'test_id',
        PINMETO_APP_SECRET: 'test_secret'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', c => (stdout += c));
    child.stderr.on('data', c => (stderr += c));

    child.on('error', reject);
    child.on('close', () => {
      const lines = stdout.trim().split('\n').filter(Boolean);
      if (!lines.length) {
        reject(new Error(`No stdout from bundle. stderr:\n${stderr}`));
        return;
      }
      resolve(lines.map(l => JSON.parse(l)));
    });

    for (const r of requests) child.stdin.write(JSON.stringify(r) + '\n');
    child.stdin.end();
  });
}

describe('single-file bundle', () => {
  beforeAll(() => {
    execFileSync('node', ['scripts/build-bundle.js'], { cwd: rootDir, stdio: 'inherit' });
  }, 60_000);

  it('emits one self-contained file', () => {
    expect(existsSync(bundlePath)).toBe(true);
  });

  it('completes an initialize handshake reporting the package.json version', async () => {
    const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
    const [init] = await driveServer([
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'bundle-test', version: '0.0.0' }
        }
      }
    ]);

    expect(init.result.serverInfo.version).toBe(pkg.version);
  });

  it('lists all 12 tools with titles', async () => {
    const responses = await driveServer([
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'bundle-test', version: '0.0.0' }
        }
      },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' }
    ]);

    const tools = responses.find(r => r.id === 2)?.result?.tools;
    expect(tools).toHaveLength(12);
    for (const tool of tools) {
      expect(tool.title, `${tool.name} is missing a title`).toBeTruthy();
    }
  });
});
