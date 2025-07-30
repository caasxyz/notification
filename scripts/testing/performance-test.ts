#!/usr/bin/env tsx
import { performance } from 'perf_hooks';
import chalk from 'chalk';
import ora from 'ora';
import { CryptoUtils } from '../src/utils/crypto';

interface TestResult {
  name: string;
  duration: number;
  operations: number;
  opsPerSecond: number;
  memoryUsed: number;
}

class PerformanceTest {
  private apiUrl: string;
  private apiSecret: string;
  private results: TestResult[] = [];

  constructor(apiUrl: string = 'http://localhost:8787', apiSecret: string = 'test-secret-key') {
    this.apiUrl = apiUrl;
    this.apiSecret = apiSecret;
  }

  async run() {
    console.log(chalk.bold.cyan('\n🚀 Notification System Performance Test\n'));
    
    // Test 1: Single notification performance
    await this.testSingleNotification();
    
    // Test 2: Batch notification performance
    await this.testBatchNotifications();
    
    // Test 3: Template rendering performance
    await this.testTemplateRendering();
    
    // Test 4: Concurrent requests
    await this.testConcurrentRequests();
    
    // Display results
    this.displayResults();
  }

  private async testSingleNotification() {
    const spinner = ora('Testing single notification performance...').start();
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      const operations = 10;
      for (let i = 0; i < operations; i++) {
        await this.sendNotification({
          user_id: 'perf-test-user',
          channels: ['webhook'],
          template_key: 'welcome',
          variables: {
            name: `User ${i}`,
            timestamp: new Date().toISOString(),
          },
        });
      }
      
      const duration = performance.now() - startTime;
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;
      
      this.results.push({
        name: 'Single Notification',
        duration,
        operations,
        opsPerSecond: (operations / duration) * 1000,
        memoryUsed: memoryUsed / 1024 / 1024, // Convert to MB
      });
      
      spinner.succeed(chalk.green('Single notification test completed'));
    } catch (error) {
      spinner.fail(chalk.red(`Single notification test failed: ${error}`));
    }
  }

  private async testBatchNotifications() {
    const spinner = ora('Testing batch notification performance...').start();
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      const batchSize = 50;
      const users = Array.from({ length: batchSize }, (_, i) => ({
        user_id: `batch-user-${i}`,
        channels: ['webhook', 'telegram'] as any,
        template_key: 'notification',
        variables: {
          message: `Batch message ${i}`,
          index: i,
        },
      }));
      
      // Send all notifications in parallel
      await Promise.all(users.map(user => this.sendNotification(user)));
      
      const duration = performance.now() - startTime;
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;
      
      this.results.push({
        name: 'Batch Notifications',
        duration,
        operations: batchSize * 2, // 2 channels per user
        opsPerSecond: (batchSize * 2 / duration) * 1000,
        memoryUsed: memoryUsed / 1024 / 1024,
      });
      
      spinner.succeed(chalk.green('Batch notification test completed'));
    } catch (error) {
      spinner.fail(chalk.red(`Batch notification test failed: ${error}`));
    }
  }

  private async testTemplateRendering() {
    const spinner = ora('Testing template rendering performance...').start();
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      const operations = 100;
      const templates = ['welcome', 'notification', 'alert', 'reminder'];
      
      const promises = [];
      for (let i = 0; i < operations; i++) {
        const template = templates[i % templates.length];
        promises.push(
          this.sendNotification({
            user_id: 'template-test-user',
            channels: ['webhook'],
            template_key: template,
            variables: {
              var1: `Value ${i}`,
              var2: new Date().toISOString(),
              var3: Math.random(),
              nested: {
                data: `Nested ${i}`,
              },
            },
          })
        );
      }
      
      await Promise.all(promises);
      
      const duration = performance.now() - startTime;
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;
      
      this.results.push({
        name: 'Template Rendering',
        duration,
        operations,
        opsPerSecond: (operations / duration) * 1000,
        memoryUsed: memoryUsed / 1024 / 1024,
      });
      
      spinner.succeed(chalk.green('Template rendering test completed'));
    } catch (error) {
      spinner.fail(chalk.red(`Template rendering test failed: ${error}`));
    }
  }

  private async testConcurrentRequests() {
    const spinner = ora('Testing concurrent requests...').start();
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      const concurrency = 20;
      const requestsPerThread = 5;
      
      const threads = Array.from({ length: concurrency }, (_, threadId) => 
        Array.from({ length: requestsPerThread }, (_, reqId) => 
          this.sendNotification({
            user_id: `concurrent-user-${threadId}`,
            channels: ['webhook'],
            template_key: 'notification',
            variables: {
              thread: threadId,
              request: reqId,
              timestamp: Date.now(),
            },
            idempotency_key: `perf-${threadId}-${reqId}`,
          })
        )
      );
      
      // Flatten and execute all requests
      await Promise.all(threads.flat());
      
      const duration = performance.now() - startTime;
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;
      const totalOps = concurrency * requestsPerThread;
      
      this.results.push({
        name: 'Concurrent Requests',
        duration,
        operations: totalOps,
        opsPerSecond: (totalOps / duration) * 1000,
        memoryUsed: memoryUsed / 1024 / 1024,
      });
      
      spinner.succeed(chalk.green('Concurrent requests test completed'));
    } catch (error) {
      spinner.fail(chalk.red(`Concurrent requests test failed: ${error}`));
    }
  }

  private async sendNotification(data: any): Promise<any> {
    const body = JSON.stringify(data);
    const timestamp = Date.now().toString();
    const signature = await CryptoUtils.generateHMAC(
      timestamp + body,
      this.apiSecret
    );
    
    const response = await fetch(`${this.apiUrl}/api/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Signature': signature,
      },
      body,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    
    return response.json();
  }

  private displayResults() {
    console.log(chalk.bold.cyan('\n📊 Performance Test Results\n'));
    
    console.log(chalk.bold('Test Summary:'));
    console.log('─'.repeat(80));
    
    const headers = ['Test Name', 'Duration (ms)', 'Operations', 'Ops/Second', 'Memory (MB)'];
    const colWidths = [25, 15, 12, 12, 12];
    
    // Print headers
    console.log(
      headers.map((h, i) => chalk.bold(h.padEnd(colWidths[i]))).join(' ')
    );
    console.log('─'.repeat(80));
    
    // Print results
    this.results.forEach(result => {
      const row = [
        result.name,
        result.duration.toFixed(2),
        result.operations.toString(),
        result.opsPerSecond.toFixed(2),
        result.memoryUsed.toFixed(2),
      ];
      
      console.log(
        row.map((v, i) => {
          const value = v.padEnd(colWidths[i]);
          if (i === 3) {
            // Color code ops/second
            const ops = parseFloat(v);
            if (ops > 100) return chalk.green(value);
            if (ops > 50) return chalk.yellow(value);
            return chalk.red(value);
          }
          return value;
        }).join(' ')
      );
    });
    
    console.log('─'.repeat(80));
    
    // Calculate totals
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const totalOps = this.results.reduce((sum, r) => sum + r.operations, 0);
    const avgOpsPerSecond = (totalOps / totalDuration) * 1000;
    const totalMemory = this.results.reduce((sum, r) => sum + r.memoryUsed, 0);
    
    console.log(chalk.bold('\nOverall Performance:'));
    console.log(`  Total Operations: ${chalk.cyan(totalOps)}`);
    console.log(`  Total Duration: ${chalk.cyan(totalDuration.toFixed(2))} ms`);
    console.log(`  Average Ops/Second: ${chalk.cyan(avgOpsPerSecond.toFixed(2))}`);
    console.log(`  Total Memory Used: ${chalk.cyan(totalMemory.toFixed(2))} MB`);
    
    // Performance recommendations
    console.log(chalk.bold('\n💡 Performance Analysis:'));
    
    if (avgOpsPerSecond > 100) {
      console.log(chalk.green('✅ Excellent performance! System can handle high load.'));
    } else if (avgOpsPerSecond > 50) {
      console.log(chalk.yellow('⚠️  Good performance, but consider optimization for higher loads.'));
    } else {
      console.log(chalk.red('❌ Performance needs improvement. Consider:'));
      console.log('   - Adding database indexes');
      console.log('   - Implementing caching');
      console.log('   - Optimizing template rendering');
      console.log('   - Using connection pooling');
    }
    
    const avgMemoryPerOp = totalMemory / totalOps * 1000; // MB per 1000 ops
    if (avgMemoryPerOp < 10) {
      console.log(chalk.green('✅ Memory usage is efficient.'));
    } else if (avgMemoryPerOp < 20) {
      console.log(chalk.yellow('⚠️  Memory usage is acceptable but could be optimized.'));
    } else {
      console.log(chalk.red('❌ High memory usage detected. Check for memory leaks.'));
    }
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  const apiUrl = process.env.API_URL || 'http://localhost:8787';
  const apiSecret = process.env.API_SECRET || 'test-secret-key';
  
  const test = new PerformanceTest(apiUrl, apiSecret);
  test.run().catch(console.error);
}

export { PerformanceTest };