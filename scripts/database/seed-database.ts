#!/usr/bin/env tsx
/**
 * Database Seeding Script
 * 
 * Seeds the database with test data for development and testing.
 * Supports different seed profiles and custom data files.
 * 
 * Usage:
 *   npm run db:seed
 *   npm run db:seed -- --profile minimal
 *   npm run db:seed -- --file custom-seed.json
 */

import { drizzle } from 'drizzle-orm/d1';
import chalk from 'chalk';
import ora from 'ora';
import { program } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { systemConfigs, notificationTemplatesV2, templateContents, userConfigs, notificationLogs, idempotencyKeys } from '../src/db/schema';

// Types
interface SeedProfile {
  name: string;
  description: string;
  users: number;
  templates: number;
  notifications: number;
}

interface SeedData {
  systemConfigs: Array<{
    config_key: string;
    config_value: string;
    description?: string;
  }>;
  users: Array<{
    id: string;
    configs: Array<{
      channel: string;
      config: any;
    }>;
  }>;
  templates: Array<{
    key: string;
    name: string;
    description: string;
    variables: string[];
    channels: Array<{
      type: string;
      subject?: string;
      content: string;
      contentType: string;
    }>;
  }>;
  notifications?: Array<{
    userId: string;
    templateKey: string;
    channel: string;
    variables: Record<string, any>;
  }>;
}

// Seed profiles
const profiles: Record<string, SeedProfile> = {
  minimal: {
    name: 'Minimal',
    description: 'Basic setup with essential data',
    users: 2,
    templates: 3,
    notifications: 0,
  },
  standard: {
    name: 'Standard',
    description: 'Typical development setup',
    users: 5,
    templates: 8,
    notifications: 20,
  },
  comprehensive: {
    name: 'Comprehensive',
    description: 'Full test data for all features',
    users: 10,
    templates: 15,
    notifications: 100,
  },
};

// Default seed data generator
function generateSeedData(profile: SeedProfile): SeedData {
  const data: SeedData = {
    systemConfigs: [
      {
        config_key: 'max_retry_attempts',
        config_value: '3',
        description: 'Maximum number of retry attempts for failed notifications',
      },
      {
        config_key: 'retry_delay_seconds',
        config_value: '60',
        description: 'Delay in seconds between retry attempts',
      },
      {
        config_key: 'cleanup_retention_hours',
        config_value: '168',
        description: 'Hours to retain notification logs before cleanup (168 = 7 days)',
      },
      {
        config_key: 'rate_limit_per_minute',
        config_value: '100',
        description: 'Maximum notifications per minute per user',
      },
    ],
    users: [],
    templates: [],
    notifications: [],
  };
  
  // Generate users
  for (let i = 1; i <= profile.users; i++) {
    data.users.push({
      id: `test-user-${i}`,
      configs: [
        {
          channel: 'webhook',
          config: {
            webhook_url: `https://webhook.site/test-user-${i}`,
            headers: {
              'X-User-ID': `test-user-${i}`,
              'X-Test': 'true',
            },
          },
        },
        {
          channel: 'telegram',
          config: {
            bot_token: `test-bot-token-${i}`,
            chat_id: `${1000000 + i}`,
          },
        },
      ],
    });
  }
  
  // Generate templates
  const templateTypes = [
    {
      key: 'welcome',
      name: 'Welcome Message',
      description: 'Sent to new users upon registration',
      variables: ['userName', 'companyName'],
      channels: [
        {
          type: 'webhook',
          content: JSON.stringify({
            type: 'welcome',
            user: '{{userName}}',
            message: 'Welcome to {{companyName}}!',
          }),
          contentType: 'json',
        },
        {
          type: 'telegram',
          content: '🎉 Welcome {{userName}}!\n\nWelcome to {{companyName}}! We are excited to have you on board.',
          contentType: 'text',
        },
      ],
    },
    {
      key: 'password-reset',
      name: 'Password Reset',
      description: 'Password reset request',
      variables: ['userName', 'resetLink', 'expiryTime'],
      channels: [
        {
          type: 'webhook',
          content: JSON.stringify({
            type: 'password-reset',
            user: '{{userName}}',
            link: '{{resetLink}}',
            expiry: '{{expiryTime}}',
          }),
          contentType: 'json',
        },
      ],
    },
    {
      key: 'order-confirmation',
      name: 'Order Confirmation',
      description: 'Order confirmation notification',
      variables: ['orderId', 'userName', 'totalAmount', 'items'],
      channels: [
        {
          type: 'webhook',
          content: JSON.stringify({
            type: 'order-confirmation',
            orderId: '{{orderId}}',
            user: '{{userName}}',
            total: '{{totalAmount}}',
            items: '{{items}}',
          }),
          contentType: 'json',
        },
        {
          type: 'slack',
          content: 'Order #{{orderId}} confirmed for {{userName}}. Total: ${{totalAmount}}',
          contentType: 'text',
        },
      ],
    },
    {
      key: 'alert',
      name: 'System Alert',
      description: 'System alerts and warnings',
      variables: ['severity', 'message', 'timestamp'],
      channels: [
        {
          type: 'slack',
          content: ':warning: [{{severity}}] {{message}} at {{timestamp}}',
          contentType: 'text',
        },
        {
          type: 'webhook',
          content: JSON.stringify({
            severity: '{{severity}}',
            message: '{{message}}',
            timestamp: '{{timestamp}}',
          }),
          contentType: 'json',
        },
      ],
    },
    {
      key: 'reminder',
      name: 'Reminder',
      description: 'General reminder notification',
      variables: ['title', 'description', 'dueDate'],
      channels: [
        {
          type: 'telegram',
          content: '⏰ Reminder: {{title}}\n\n{{description}}\n\nDue: {{dueDate}}',
          contentType: 'text',
        },
      ],
    },
  ];
  
  // Add templates based on profile
  data.templates = templateTypes.slice(0, Math.min(profile.templates, templateTypes.length));
  
  // Generate additional templates if needed
  for (let i = templateTypes.length + 1; i <= profile.templates; i++) {
    data.templates.push({
      key: `test-template-${i}`,
      name: `Test Template ${i}`,
      description: `Test template number ${i}`,
      variables: ['var1', 'var2', 'var3'],
      channels: [
        {
          type: 'webhook',
          content: JSON.stringify({
            test: true,
            templateId: i,
            var1: '{{var1}}',
            var2: '{{var2}}',
            var3: '{{var3}}',
          }),
          contentType: 'json',
        },
      ],
    });
  }
  
  // Generate notifications
  for (let i = 0; i < profile.notifications; i++) {
    const user = data.users[i % data.users.length];
    const template = data.templates[i % data.templates.length];
    
    data.notifications!.push({
      userId: user.id,
      templateKey: template.key,
      channel: user.configs[0].channel,
      variables: template.variables.reduce((vars, v) => {
        vars[v] = `test-${v}-${i}`;
        return vars;
      }, {} as Record<string, any>),
    });
  }
  
  return data;
}

// Main seeding function
async function main() {
  program
    .name('seed-database')
    .description('Seed the database with test data')
    .version('1.0.0')
    .option('-p, --profile <profile>', 'Seed profile to use', 'standard')
    .option('-f, --file <path>', 'Custom seed data file (JSON)')
    .option('--clear-only', 'Only clear the database without seeding')
    .option('--no-clear', 'Skip clearing existing data')
    .option('--dry-run', 'Show what would be seeded without actually doing it')
    .action(async (options) => {
      console.log(chalk.blue('\n🌱 Database Seeding\n'));
      
      try {
        // Load seed data
        let seedData: SeedData;
        
        if (options.file) {
          // Load from file
          const filePath = path.resolve(process.cwd(), options.file);
          const fileContent = await fs.readFile(filePath, 'utf-8');
          seedData = JSON.parse(fileContent);
          console.log(chalk.blue(`📄 Using seed data from ${options.file}`));
        } else {
          // Use profile
          const profile = profiles[options.profile];
          if (!profile) {
            console.error(chalk.red(`Unknown profile: ${options.profile}`));
            console.log('Available profiles:', Object.keys(profiles).join(', '));
            process.exit(1);
          }
          
          console.log(chalk.blue(`📋 Using ${profile.name} profile`));
          console.log(chalk.gray(`   ${profile.description}`));
          seedData = generateSeedData(profile);
        }
        
        // Show summary
        console.log(chalk.blue('\n📊 Seed Data Summary:\n'));
        console.log(`  System Configs: ${chalk.green(seedData.systemConfigs.length)}`);
        console.log(`  Users:          ${chalk.green(seedData.users.length)}`);
        console.log(`  Templates:      ${chalk.green(seedData.templates.length)}`);
        console.log(`  Notifications:  ${chalk.green(seedData.notifications?.length || 0)}`);
        
        if (options.dryRun) {
          console.log(chalk.yellow('\n⚠️  Dry run mode - no data will be inserted'));
          console.log('\nSample data:');
          console.log(chalk.gray(JSON.stringify(seedData, null, 2).substring(0, 500) + '...'));
          return;
        }
        
        // Note about actual implementation
        console.log(chalk.yellow('\n⚠️  Note: This is a template implementation.'));
        console.log('To actually seed the database:');
        console.log('1. Connect to D1 using Wrangler or in your Worker');
        console.log('2. Use the drizzle instance to insert data');
        console.log('3. Run within the Cloudflare Workers environment');
        
        console.log('\nExample implementation:');
        console.log(chalk.gray(`
  // In your Worker or using Wrangler
  const db = drizzle(env.DB);
  
  // Clear existing data
  await db.delete(notificationLogs);
  await db.delete(templateContents);
  await db.delete(notificationTemplatesV2);
  await db.delete(userConfigs);
  await db.delete(systemConfigs);
  
  // Insert system configs
  for (const config of seedData.systemConfigs) {
    await db.insert(systemConfigs).values(config);
  }
  
  // Insert users and templates...
        `));
        
        console.log(chalk.green('\n✓ Seed data generated successfully'));
        
      } catch (error) {
        console.error(chalk.red('\n✗ Seeding failed:'), error);
        process.exit(1);
      }
    });

  // Show available profiles if no arguments
  if (!process.argv.slice(2).length) {
    console.log(chalk.blue('\n📚 Available Seed Profiles:\n'));
    
    Object.entries(profiles).forEach(([key, profile]) => {
      console.log(`  ${chalk.yellow(key.padEnd(15))} - ${profile.description}`);
      console.log(`                   Users: ${profile.users}, Templates: ${profile.templates}, Notifications: ${profile.notifications}`);
    });
    
    console.log('\n💡 Usage Examples:');
    console.log('  npm run db:seed                     # Use standard profile');
    console.log('  npm run db:seed -- --profile minimal # Use minimal profile');
    console.log('  npm run db:seed -- --file data.json  # Use custom data file');
    console.log('  npm run db:seed -- --dry-run         # Preview without inserting');
  }

  program.parse();
}

// Run the script
main().catch(console.error);