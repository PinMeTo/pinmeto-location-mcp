#!/usr/bin/env node
/**
 * Verifies the packed .mcpb before it is attached to a release.
 *
 * Two things went wrong with the first v4.1.0 bundle that this catches:
 *
 * 1. Claude Desktop refuses to install any bundle containing a path with ".." in it
 *    (path traversal check). Untracked local directories are packed unless listed in
 *    .mcpbignore, and one of them held files named "review-<sha>..<sha>.diff".
 * 2. An unanchored "dist" rule in .mcpbignore stripped node_modules/<pkg>/dist too, so
 *    the server crashed on startup with MODULE_NOT_FOUND once installed.
 *
 * Checks: no unsafe paths, only the expected top-level entries, and the server inside
 * the bundle actually starts and answers tools/list.
 */

import { execFileSync, spawnSync } from 'child_process';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const mcpbPath = join(rootDir, 'pinmeto-location-mcp.mcpb');

const ALLOWED_TOP_LEVEL = new Set([
  'build',
  'node_modules',
  'img',
  'package.json',
  'manifest.json',
  'README.md',
  'LICENSE'
]);

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

if (!existsSync(mcpbPath)) {
  fail(`${mcpbPath} not found. Run "npx @anthropic-ai/mcpb pack" first.`);
}

// `unzip -Z1` prints one entry path per line with no header or footer.
const entries = execFileSync('unzip', ['-Z1', mcpbPath], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const unsafe = entries.filter(p => p.split('/').includes('..') || p.startsWith('/'));
if (unsafe.length > 0) {
  fail(`Unsafe paths in bundle (Claude Desktop will refuse to install):\n  ${unsafe.join('\n  ')}`);
}

const topLevel = new Set(entries.map(p => p.split('/')[0]));
const unexpected = [...topLevel].filter(name => !ALLOWED_TOP_LEVEL.has(name));
if (unexpected.length > 0) {
  fail(
    `Unexpected top-level entries in bundle: ${unexpected.join(', ')}\n` +
      'Add them to .mcpbignore (anchor with a leading "/" so the rule only matches the repo root).'
  );
}

const missing = [...ALLOWED_TOP_LEVEL].filter(name => !topLevel.has(name));
if (missing.length > 0) {
  fail(`Bundle is missing expected top-level entries: ${missing.join(', ')}`);
}

// Start the packed server from a scratch directory and make sure it answers tools/list.
const scratch = mkdtempSync(join(tmpdir(), 'mcpb-verify-'));
try {
  execFileSync('unzip', ['-q', mcpbPath, '-d', scratch]);

  const messages = [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'verify-mcpb', version: '0' }
      }
    },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }
  ];

  const result = spawnSync(process.execPath, [join(scratch, 'build', 'index.js')], {
    input: messages.map(m => JSON.stringify(m)).join('\n') + '\n',
    encoding: 'utf8',
    timeout: 20_000,
    env: {
      ...process.env,
      PINMETO_ACCOUNT_ID: 'verify',
      PINMETO_APP_ID: 'verify',
      PINMETO_APP_SECRET: 'verify'
    }
  });

  if (result.error) {
    fail(`Packed server failed to start: ${result.error.message}`);
  }

  const responses = result.stdout
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
  const toolsResponse = responses.find(r => r.id === 2);

  if (!toolsResponse?.result?.tools) {
    fail(
      `Packed server did not answer tools/list (exit ${result.status}).\nstderr:\n${result.stderr}`
    );
  }

  const tools = toolsResponse.result.tools;
  const dialects = new Set(tools.flatMap(t => [t.inputSchema?.$schema, t.outputSchema?.$schema]));
  const expectedDialect = 'https://json-schema.org/draft/2020-12/schema';
  if (dialects.size !== 1 || !dialects.has(expectedDialect)) {
    fail(`Tool schemas must all declare ${expectedDialect}; found: ${[...dialects].join(', ')}`);
  }

  console.log(
    `✅ ${mcpbPath.split('/').pop()}: ${entries.length} entries, no unsafe paths, ` +
      `packed server answers tools/list with ${tools.length} tools (JSON Schema 2020-12).`
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
