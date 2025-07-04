#!/usr/bin/env node

import { CredSweeper } from './core/CredSweeper.js';
import { CLIInterface } from './cli/CLIInterface.js';
import { WebInterface } from './web/WebInterface.js';

async function main() {
  const args = process.argv.slice(2);
  
  // Check if running in web mode
  if (args.includes('--web')) {
    const webInterface = new WebInterface();
    await webInterface.start();
    return;
  }
  
  // Default to CLI mode
  const cli = new CLIInterface();
  await cli.run();
}

main().catch(console.error);