#!/usr/bin/env node
/**
 * Builds dist/index.mjs: the whole server and its dependencies in one file.
 *
 * Consumed by the claude-plugins marketplace repo, which vendors this file
 * directly. npm pack cannot be used for that: npm never ships node_modules, and
 * this server's production dependencies are ~25 MB across ~3,600 files.
 */

import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { statSync } from 'fs';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

execFileSync('node', [join(rootDir, 'scripts', 'generate-version.js')], {
  cwd: rootDir,
  stdio: 'inherit'
});

// axios pulls CJS dependencies (form-data -> combined-stream) that call require()
// at load time. ESM output has no require, so provide a real one.
const banner = "import{createRequire as __cr}from'module';const require=__cr(import.meta.url);";

execFileSync(
  'npx',
  [
    'esbuild',
    'src/index.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--target=node18',
    `--banner:js=${banner}`,
    '--outfile=dist/index.mjs'
  ],
  { cwd: rootDir, stdio: 'inherit' }
);

const { size } = statSync(join(rootDir, 'dist', 'index.mjs'));
console.log(`Bundle: ${(size / 1024 / 1024).toFixed(2)} MB`);
