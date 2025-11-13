const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

// Update build/package.json version if VERSION_POSTFIX is set
const versionPostfix = process.env.VERSION_POSTFIX;

if (versionPostfix) {
  const buildPackageJsonPath = join(__dirname, 'build', 'package.json');

  if (existsSync(buildPackageJsonPath)) {
    const buildPackageJson = JSON.parse(readFileSync(buildPackageJsonPath, 'utf8'));
    const finalVersion = `${buildPackageJson.version}-${versionPostfix}`;
    buildPackageJson.version = finalVersion;
    writeFileSync(buildPackageJsonPath, JSON.stringify(buildPackageJson, null, 2) + '\n');
    console.log(`✓ Updated build/package.json version to: ${finalVersion}`);
  } else {
    console.error('Error: build/package.json not found');
    process.exit(1);
  }
} else {
  console.log('✓ No VERSION_POSTFIX set, using standard version');
}
