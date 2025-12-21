#!/usr/bin/env node
/**
 * Updates version badges in README.md to match package.json version.
 * Run after `changeset version` bumps the package version.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;

// Read README.md
const readmePath = join(rootDir, 'README.md');
let readme = readFileSync(readmePath, 'utf8');

// Replace all version patterns (v1.2.3 format)
const versionPattern = /v\d+\.\d+\.\d+/g;
const newVersion = `v${version}`;

const originalReadme = readme;
readme = readme.replace(versionPattern, newVersion);

if (readme !== originalReadme) {
  writeFileSync(readmePath, readme);
  console.log(`Updated README.md badges to ${newVersion}`);
} else {
  console.log(`README.md badges already at ${newVersion}`);
}
