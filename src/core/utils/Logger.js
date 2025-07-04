import chalk from 'chalk';

export class Logger {
  constructor(options = {}) {
    this.options = {
      level: process.env.LOG_LEVEL || 'info',
      timestamp: true,
      ...options
    };
  }

  info(message, ...args) {
    this.log('info', chalk.blue('ℹ'), message, ...args);
  }

  success(message, ...args) {
    this.log('success', chalk.green('✓'), message, ...args);
  }

  warn(message, ...args) {
    this.log('warn', chalk.yellow('⚠'), message, ...args);
  }

  error(message, ...args) {
    this.log('error', chalk.red('✗'), message, ...args);
  }

  debug(message, ...args) {
    if (this.options.level === 'debug') {
      this.log('debug', chalk.gray('🐛'), message, ...args);
    }
  }

  log(level, icon, message, ...args) {
    const timestamp = this.options.timestamp 
      ? chalk.gray(`[${new Date().toISOString()}]`) 
      : '';
    
    console.log(`${timestamp} ${icon} ${message}`, ...args);
  }
}