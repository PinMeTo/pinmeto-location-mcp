/**
 * Post-process CHANGELOG.md to match Keep-a-Changelog format
 *
 * Transforms changeset output:
 *   ## 3.1.0           →  ## [3.1.0] - 2025-12-22
 *   ### Minor Changes  →  ### Added
 *   ### Patch Changes  →  ### Fixed
 *
 * Also ensures "All notable changes..." header is at the top
 */

import { readFileSync, writeFileSync } from 'fs';

const CHANGELOG_PATH = 'CHANGELOG.md';

// Get today's date in YYYY-MM-DD format
const today = new Date().toISOString().split('T')[0];

// Read changelog
let content = readFileSync(CHANGELOG_PATH, 'utf-8');

// 1. Add brackets and date to version headers (only those without date)
//    Matches: ## 3.1.0 (but not ## [3.1.0] - date)
content = content.replace(
  /^## (\d+\.\d+\.\d+)$/gm,
  `## [$1] - ${today}`
);

// 2. Transform section headers to Keep-a-Changelog style
content = content.replace(/^### Minor Changes$/gm, '### Added');
content = content.replace(/^### Patch Changes$/gm, '### Fixed');
content = content.replace(/^### Major Changes$/gm, '### Changed');

// 3. Ensure header is at top (after # Changelog)
const headerLine = 'All notable changes to this project will be documented in this file.';
if (!content.includes(headerLine)) {
  content = content.replace(
    /^# Changelog\n+/m,
    `# Changelog\n\n${headerLine}\n\n`
  );
} else {
  // Move header to right after # Changelog if it exists elsewhere
  content = content.replace(headerLine + '\n', '');
  content = content.replace(
    /^# Changelog\n+/m,
    `# Changelog\n\n${headerLine}\n\n`
  );
}

// 4. Remove any "Thanks @username!" patterns that might slip through
content = content.replace(/\s*Thanks \[@[^\]]+\]\([^)]+\)!\s*-?\s*/g, '');

// 5. Clean up excessive newlines
content = content.replace(/\n{3,}/g, '\n\n');

// Write back
writeFileSync(CHANGELOG_PATH, content);

console.log(`Formatted CHANGELOG.md with date ${today}`);
