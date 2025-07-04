#!/usr/bin/env node

import { CLIInterface } from './cli/CLIInterface.js';

const cli = new CLIInterface();
cli.run().catch(console.error);