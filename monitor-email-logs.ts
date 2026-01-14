#!/usr/bin/env npx ts-node
/**
 * Script to monitor and extract email verification tokens from backend logs
 * Run this in a separate terminal while testing the signup flow
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function monitorEmailLogs() {
  console.log('\n🔍 Monitoring backend for email verification logs...\n');
  console.log('Steps to test:');
  console.log('1. Go to http://localhost:3002/signup');
  console.log('2. Sign up with a new email');
  console.log('3. Watch this terminal for the verification token');
  console.log('4. Copy the token from the logs below\n');
  console.log('─'.repeat(80));

  const pollInterval = setInterval(async () => {
    try {
      // Get recent backend logs
      const { stdout } = await execAsync(
        'docker logs sentinel-backend --tail 20 2>/dev/null || echo "Docker container not running"'
      );

      // Look for email logs
      const lines = stdout.split('\n');
      const emailLines = lines.filter(
        (line) =>
          line.includes('📧') ||
          line.includes('EMAIL') ||
          line.includes('verification') ||
          line.includes('token')
      );

      if (emailLines.length > 0) {
        emailLines.forEach((line) => {
          if (line.trim()) {
            console.log(line);
          }
        });
      }
    } catch (error) {
      // Silently continue if docker isn't available
    }
  }, 2000);

  // Exit after 5 minutes
  setTimeout(() => {
    clearInterval(pollInterval);
    console.log('\n✅ Monitoring stopped');
  }, 300000);
}

monitorEmailLogs().catch(console.error);
