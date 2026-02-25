const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Get version from command line argument
const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Error: Please provide a version number (e.g., node scripts/release.js 1.0.1)');
  process.exit(1);
}

// Simple semver validation
const semverRegex = /^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/i;
if (!semverRegex.test(newVersion)) {
  console.error(`Error: Invalid version format "${newVersion}". Use something like 1.0.1`);
  process.exit(1);
}

const tag = `v${newVersion}`;

try {
  console.log(`Starting release process for ${tag}...`);

  // 1. Run checks
  console.log('Running pre-release checks (lint, tests, type-check)...');
  execSync('pnpm release:check', { stdio: 'inherit' });

  // 2. Update package.json
  console.log(`Updating package.json to version ${newVersion}...`);
  pkg.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');

  // 3. Git operations
  console.log('Committing changes...');
  execSync('git add package.json', { stdio: 'inherit' });
  execSync(`git commit -m "chore: release ${tag}"`, { stdio: 'inherit' });

  console.log(`Creating tag ${tag}...`);
  execSync(`git tag ${tag}`, { stdio: 'inherit' });

  // 4. Push
  console.log('Pushing to origin...');
  execSync('git push origin main', { stdio: 'inherit' });
  execSync(`git push origin ${tag}`, { stdio: 'inherit' });

  console.log(`\nSuccessfully released ${tag}! GitHub Action should be starting now.`);
} catch (error) {
  console.error('\nRelease failed. Please check the errors above.');
  process.exit(1);
}
