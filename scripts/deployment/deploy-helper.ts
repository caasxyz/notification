#!/usr/bin/env tsx
/**
 * Deployment Helper Script
 * 
 * Assists with deployment tasks including pre-deployment checks,
 * environment validation, and post-deployment verification.
 * 
 * Usage:
 *   npm run deploy:check
 *   npm run deploy:check -- --env production
 *   npm run deploy:check -- --full
 */

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import Table from 'cli-table3';

// Types
interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

interface Environment {
  name: string;
  branch: string;
  apiUrl: string;
  requiredSecrets: string[];
  requiredBindings: string[];
}

// Environment configurations
const environments: Record<string, Environment> = {
  development: {
    name: 'Development',
    branch: 'develop',
    apiUrl: 'http://localhost:8788',
    requiredSecrets: ['API_SECRET', 'ENCRYPT_KEY'],
    requiredBindings: ['DB', 'CONFIG_CACHE', 'RETRY_QUEUE'],
  },
  staging: {
    name: 'Staging',
    branch: 'staging',
    apiUrl: 'https://notification-system-staging.workers.dev',
    requiredSecrets: ['API_SECRET', 'ENCRYPT_KEY', 'TELEGRAM_BOT_TOKEN'],
    requiredBindings: ['DB', 'CONFIG_CACHE', 'RETRY_QUEUE'],
  },
  production: {
    name: 'Production',
    branch: 'main',
    apiUrl: 'https://notification-system.workers.dev',
    requiredSecrets: [
      'API_SECRET',
      'ENCRYPT_KEY',
      'TELEGRAM_BOT_TOKEN',
      'SLACK_WEBHOOK_URL',
      'LARK_APP_ID',
      'LARK_APP_SECRET',
    ],
    requiredBindings: ['DB', 'CONFIG_CACHE', 'RETRY_QUEUE'],
  },
};

// Check functions
async function checkGitStatus(): Promise<CheckResult> {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim()) {
      return {
        name: 'Git Status',
        status: 'warn',
        message: 'Uncommitted changes detected',
        details: status.trim().split('\n').slice(0, 5).join('\n'),
      };
    }
    
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    return {
      name: 'Git Status',
      status: 'pass',
      message: `Clean working directory on branch: ${branch}`,
    };
  } catch (error) {
    return {
      name: 'Git Status',
      status: 'fail',
      message: 'Failed to check git status',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkBranch(env: Environment): Promise<CheckResult> {
  try {
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    if (currentBranch !== env.branch) {
      return {
        name: 'Branch Check',
        status: 'warn',
        message: `Not on recommended branch for ${env.name}`,
        details: `Current: ${currentBranch}, Expected: ${env.branch}`,
      };
    }
    return {
      name: 'Branch Check',
      status: 'pass',
      message: `On correct branch: ${currentBranch}`,
    };
  } catch (error) {
    return {
      name: 'Branch Check',
      status: 'fail',
      message: 'Failed to check branch',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkDependencies(): Promise<CheckResult> {
  try {
    execSync('npm ls --depth=0', { encoding: 'utf8', stdio: 'pipe' });
    return {
      name: 'Dependencies',
      status: 'pass',
      message: 'All dependencies installed',
    };
  } catch {
    return {
      name: 'Dependencies',
      status: 'fail',
      message: 'Missing or invalid dependencies',
      details: 'Run "npm install" to fix',
    };
  }
}

async function checkTypeScript(): Promise<CheckResult> {
  const spinner = ora('Running TypeScript check...').start();
  try {
    execSync('npm run typecheck', { encoding: 'utf8', stdio: 'pipe' });
    spinner.stop();
    return {
      name: 'TypeScript',
      status: 'pass',
      message: 'No type errors found',
    };
  } catch (error) {
    spinner.stop();
    return {
      name: 'TypeScript',
      status: 'fail',
      message: 'TypeScript errors found',
      details: 'Run "npm run typecheck" to see details',
    };
  }
}

async function checkTests(): Promise<CheckResult> {
  const spinner = ora('Running tests...').start();
  try {
    execSync('npm test', { encoding: 'utf8', stdio: 'pipe' });
    spinner.stop();
    return {
      name: 'Tests',
      status: 'pass',
      message: 'All tests passing',
    };
  } catch {
    spinner.stop();
    return {
      name: 'Tests',
      status: 'fail',
      message: 'Test failures detected',
      details: 'Run "npm test" to see details',
    };
  }
}

async function checkWranglerConfig(): Promise<CheckResult> {
  try {
    await fs.access('wrangler.toml');
    const content = await fs.readFile('wrangler.toml', 'utf8');
    
    if (content.includes('your-database-id') || content.includes('your-kv-namespace-id')) {
      return {
        name: 'Wrangler Config',
        status: 'fail',
        message: 'Placeholder values found in wrangler.toml',
        details: 'Update database and KV namespace IDs',
      };
    }
    
    return {
      name: 'Wrangler Config',
      status: 'pass',
      message: 'wrangler.toml configured',
    };
  } catch {
    return {
      name: 'Wrangler Config',
      status: 'fail',
      message: 'wrangler.toml not found',
      details: 'Copy wrangler.toml.template and configure',
    };
  }
}

async function checkSecrets(env: Environment): Promise<CheckResult> {
  try {
    const output = execSync(`wrangler secret list --env ${env.name.toLowerCase()}`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    
    const configuredSecrets = output
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.trim());
    
    const missing = env.requiredSecrets.filter(
      secret => !configuredSecrets.some(line => line.includes(secret))
    );
    
    if (missing.length > 0) {
      return {
        name: 'Secrets',
        status: 'fail',
        message: `Missing ${missing.length} required secrets`,
        details: `Missing: ${missing.join(', ')}`,
      };
    }
    
    return {
      name: 'Secrets',
      status: 'pass',
      message: 'All required secrets configured',
    };
  } catch (error) {
    return {
      name: 'Secrets',
      status: 'warn',
      message: 'Unable to verify secrets',
      details: 'Ensure wrangler is logged in',
    };
  }
}

async function checkBuildSize(): Promise<CheckResult> {
  try {
    execSync('npm run build', { encoding: 'utf8', stdio: 'pipe' });
    const stats = await fs.stat('dist/index.js');
    const sizeInKB = stats.size / 1024;
    
    if (sizeInKB > 1000) {
      return {
        name: 'Build Size',
        status: 'warn',
        message: `Build size is ${sizeInKB.toFixed(2)} KB`,
        details: 'Consider optimizing bundle size',
      };
    }
    
    return {
      name: 'Build Size',
      status: 'pass',
      message: `Build size: ${sizeInKB.toFixed(2)} KB`,
    };
  } catch {
    return {
      name: 'Build Size',
      status: 'fail',
      message: 'Build failed',
      details: 'Run "npm run build" to see errors',
    };
  }
}

async function checkDatabaseMigrations(): Promise<CheckResult> {
  try {
    const pending = execSync('npx drizzle-kit check', { encoding: 'utf8', stdio: 'pipe' });
    
    if (pending.includes('pending')) {
      return {
        name: 'Database Migrations',
        status: 'warn',
        message: 'Pending migrations detected',
        details: 'Run migrations before deploying',
      };
    }
    
    return {
      name: 'Database Migrations',
      status: 'pass',
      message: 'Database schema up to date',
    };
  } catch {
    return {
      name: 'Database Migrations',
      status: 'warn',
      message: 'Unable to check migrations',
      details: 'Ensure database is accessible',
    };
  }
}

// Main deployment check
async function runChecks(options: { env: string; full: boolean }) {
  console.log(chalk.blue('\n🚀 Deployment Pre-flight Check\n'));
  
  const env = environments[options.env];
  if (!env) {
    console.error(chalk.red(`Unknown environment: ${options.env}`));
    console.log('Available environments:', Object.keys(environments).join(', '));
    process.exit(1);
  }
  
  console.log(chalk.blue(`Environment: ${env.name}`));
  console.log(chalk.gray(`API URL: ${env.apiUrl}\n`));
  
  const checks: CheckResult[] = [];
  
  // Basic checks
  checks.push(await checkGitStatus());
  checks.push(await checkBranch(env));
  checks.push(await checkDependencies());
  checks.push(await checkWranglerConfig());
  
  // Extended checks for full mode
  if (options.full) {
    checks.push(await checkTypeScript());
    checks.push(await checkTests());
    checks.push(await checkBuildSize());
    checks.push(await checkDatabaseMigrations());
    checks.push(await checkSecrets(env));
  }
  
  // Display results
  const table = new Table({
    head: ['Check', 'Status', 'Message'],
    style: { head: ['cyan'] },
  });
  
  let hasFailures = false;
  let hasWarnings = false;
  
  checks.forEach(check => {
    const statusIcon = {
      pass: chalk.green('✓'),
      fail: chalk.red('✗'),
      warn: chalk.yellow('⚠'),
    }[check.status];
    
    if (check.status === 'fail') hasFailures = true;
    if (check.status === 'warn') hasWarnings = true;
    
    table.push([
      check.name,
      statusIcon,
      check.message + (check.details ? `\n${chalk.gray(check.details)}` : ''),
    ]);
  });
  
  console.log(table.toString());
  
  // Summary
  console.log('\n' + chalk.blue('Summary:'));
  const passed = checks.filter(c => c.status === 'pass').length;
  const failed = checks.filter(c => c.status === 'fail').length;
  const warned = checks.filter(c => c.status === 'warn').length;
  
  console.log(`  ${chalk.green(`✓ Passed: ${passed}`)}`);
  if (warned > 0) console.log(`  ${chalk.yellow(`⚠ Warnings: ${warned}`)}`);
  if (failed > 0) console.log(`  ${chalk.red(`✗ Failed: ${failed}`)}`);
  
  if (hasFailures) {
    console.log(chalk.red('\n❌ Deployment blocked due to failures'));
    process.exit(1);
  } else if (hasWarnings) {
    console.log(chalk.yellow('\n⚠️  Deployment possible but has warnings'));
  } else {
    console.log(chalk.green('\n✅ Ready for deployment!'));
  }
  
  // Deployment command
  console.log(chalk.blue('\nTo deploy:'));
  console.log(chalk.gray(`  wrangler deploy --env ${options.env}`));
}

// Post-deployment verification
async function verifyDeployment(env: Environment) {
  console.log(chalk.blue('\n🔍 Post-deployment Verification\n'));
  
  const spinner = ora('Checking deployment...').start();
  
  try {
    // Health check
    const healthResponse = await fetch(`${env.apiUrl}/api/health`);
    const healthData = await healthResponse.json();
    
    spinner.succeed('Health check passed');
    console.log(chalk.gray(JSON.stringify(healthData, null, 2)));
    
    // Version check
    if (healthData.version) {
      console.log(`\nDeployed version: ${chalk.green(healthData.version)}`);
    }
    
    console.log(chalk.green('\n✅ Deployment verified successfully!'));
  } catch (error) {
    spinner.fail('Deployment verification failed');
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

// CLI setup
program
  .name('deploy-helper')
  .description('Deployment helper for the notification system')
  .version('1.0.0');

program
  .command('check')
  .description('Run pre-deployment checks')
  .option('-e, --env <environment>', 'Target environment', 'development')
  .option('-f, --full', 'Run all checks including tests', false)
  .action(async (options) => {
    await runChecks(options);
  });

program
  .command('verify <environment>')
  .description('Verify deployment after completion')
  .action(async (envName) => {
    const env = environments[envName];
    if (!env) {
      console.error(chalk.red(`Unknown environment: ${envName}`));
      process.exit(1);
    }
    await verifyDeployment(env);
  });

// Default to check command
if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log('\n💡 Quick start: npm run deploy:check');
}

program.parse();