#!/usr/bin/env node

import 'dotenv/config';
import { CLIInterface } from './cli/CLIInterface.js';

const cli = new CLIInterface();
cli.run().catch(console.error);