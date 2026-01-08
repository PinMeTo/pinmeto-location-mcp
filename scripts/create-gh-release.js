#!/usr/bin/env node
/**
 * Creates a draft GitHub release with the .mcpb artifact.
 *
 * Steps:
 * 1. Read version from package.json
 * 2. Create and push git tag
 * 3. Extract latest changelog section for release notes
 * 4. Create draft GitHub release with .mcpb artifact
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

/**
 * Run a command safely using execFileSync (no shell injection risk)
 */
function run(cmd, args, options = {}) {
  const fullCmd = [cmd, ...args].join(' ');
  console.log(`$ ${fullCmd}`);
  return execFileSync(cmd, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: options.silent ? 'pipe' : 'inherit',
    ...options
  });
}

function runSilent(cmd, args) {
  return run(cmd, args, { silent: true, stdio: 'pipe' }).trim();
}

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version;
const tag = `v${version}`;

console.log(`\nCreating release ${tag}...\n`);

// Check if tag already exists
let tagExists = false;
try {
  runSilent('git', ['rev-parse', tag]);
  tagExists = true;
  console.log(`Tag ${tag} already exists, skipping tag creation`);
} catch {
  // Tag doesn't exist, create it
  console.log(`Creating tag ${tag}...`);
  run('git', ['tag', tag]);
}

// Push tag to remote
console.log(`\nPushing tag ${tag} to remote...`);
try {
  run('git', ['push', 'origin', tag]);
} catch {
  // Tag might already be pushed
  console.log('Tag may already exist on remote, continuing...');
}

// Extract release notes from CHANGELOG.md
let releaseNotes = '';
const changelogPath = join(rootDir, 'CHANGELOG.md');

if (existsSync(changelogPath)) {
  const changelog = readFileSync(changelogPath, 'utf8');

  // Match the section for this version (handles both [X.Y.Z] and X.Y.Z formats)
  // Escape all regex special characters to prevent injection
  const versionEscaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionRegex = new RegExp(`## \\[?${versionEscaped}\\]?[^#]*?(?=## |$)`, 's');

  const match = changelog.match(sectionRegex);
  if (match) {
    // Remove the version header line, keep the content
    releaseNotes = match[0].replace(/^## \[?\d+\.\d+\.\d+\]?.*\n/, '').trim();
  }
}

if (!releaseNotes) {
  releaseNotes = `Release ${tag}`;
}

// Check for .mcpb artifact
const mcpbFile = 'pinmeto-location-mcp.mcpb';
const mcpbPath = join(rootDir, mcpbFile);
const hasArtifact = existsSync(mcpbPath);

if (!hasArtifact) {
  console.warn(`\nWarning: ${mcpbFile} not found. Release will be created without artifact.`);
  console.warn('Run "npx @anthropic-ai/mcpb pack" to create it.\n');
}

// Create draft GitHub release
console.log(`\nCreating draft GitHub release ${tag}...`);

// Write release notes to temp file to handle special characters
const notesFile = join(rootDir, '.release-notes.tmp');
writeFileSync(notesFile, releaseNotes);

try {
  const ghArgs = ['release', 'create', tag, '--draft', '--title', tag, '--notes-file', notesFile];
  if (hasArtifact) {
    ghArgs.push(mcpbPath);
  }
  run('gh', ghArgs);
  console.log(`\n✅ Draft release ${tag} created successfully!`);
  console.log(`\nNext steps:`);
  console.log(`1. Review the draft release on GitHub`);
  console.log(`2. Run "npm run release:publish" to publish it`);
} finally {
  // Clean up temp file
  try {
    unlinkSync(notesFile);
  } catch {
    // Ignore cleanup errors
  }
}
