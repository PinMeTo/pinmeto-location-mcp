import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const rootDir = join(__dirname, '..');
const bundlePath = join(rootDir, 'dist', 'index.mjs');

/**
 * Spawn `command`/`args`, feed it `requests` over stdin, and collect the
 * JSON-RPC responses it prints to stdout before exiting.
 *
 * Guards against a hung child (a future keep-alive timer, or `initialize`
 * never responding) being left running with no cleanup path: if the process
 * doesn't close within `timeoutMs`, it is killed and the promise rejects
 * once the kill is confirmed by the 'close' event, so a caller never has to
 * poll for the process to actually be gone. The rejection error carries the
 * child's pid (for tests that want to double-check it exited) and any
 * captured stderr, since that's what makes a real failure diagnosable.
 */
function driveProcess(
  command: string,
  args: string[],
  requests: object[],
  timeoutMs = 10_000
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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
    let timedOut = false;
    child.stdout.on('data', c => (stdout += c));
    child.stderr.on('data', c => (stderr += c));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', () => {
      clearTimeout(timer);
      if (timedOut) {
        const err = new Error(
          `Timed out after ${timeoutMs}ms waiting for the process to exit. stderr:\n${stderr}`
        );
        (err as Error & { pid?: number }).pid = child.pid;
        reject(err);
        return;
      }
      const lines = stdout.trim().split('\n').filter(Boolean);
      if (!lines.length) {
        reject(new Error(`No stdout from process. stderr:\n${stderr}`));
        return;
      }
      resolve(lines.map(l => JSON.parse(l)));
    });

    for (const r of requests) child.stdin.write(JSON.stringify(r) + '\n');
    child.stdin.end();
  });
}

/** Drive one stdio session against the bundle and collect JSON-RPC responses. */
function driveServer(requests: object[]): Promise<any[]> {
  return driveProcess('node', [bundlePath], requests);
}

describe('single-file bundle', () => {
  beforeAll(() => {
    execFileSync('node', ['scripts/build-bundle.mjs'], { cwd: rootDir, stdio: 'inherit' });
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

  it('kills a hung child instead of leaving it orphaned', async () => {
    // Stands in for a future bundle regression (a keep-alive timer, or `initialize`
    // never responding): a process that ignores stdin EOF and never exits on its own.
    const hangingScript = 'process.stdin.resume(); setInterval(() => {}, 1000);';

    let caught: (Error & { pid?: number }) | undefined;
    try {
      await driveProcess('node', ['-e', hangingScript], [], 300);
    } catch (err) {
      caught = err as Error & { pid?: number };
    }

    expect(caught?.message).toMatch(/Timed out after 300ms/);
    expect(caught?.pid).toBeGreaterThan(0);

    // The rejection only fires from the 'close' event, i.e. after the OS has
    // already reaped the process -- so the pid must be dead by now, not just
    // kill()-requested. process.kill(pid, 0) throws ESRCH for a dead pid.
    expect(() => process.kill(caught!.pid as number, 0)).toThrow();
  });
});
