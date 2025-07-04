import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { CredSweeper } from '../core/CredSweeper.js';

export class CLIInterface {
  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  setupCommands() {
    this.program
      .name('credsweeper')
      .description('Personal OSINT & Credential Exposure Scanner')
      .version('1.0.0');

    this.program
      .command('scan')
      .description('Scan a LinkedIn profile for credential exposure')
      .argument('[url]', 'LinkedIn profile URL')
      .option('-l, --linkedin <url>', 'LinkedIn profile URL')
      .option('-c, --company <name>', 'Override company name')
      .option('-o, --output <file>', 'Output file path', 'report.html')
      .option('--validate', 'Validate found credentials', false)
      .option('--deep', 'Perform deep scanning', false)
      .option('--offline', 'Use offline mode', false)
      .action(async (url, options) => {
        // If URL is provided as positional argument, use it
        if (url && !options.linkedin) {
          options.linkedin = url;
        }
        await this.runScan(options);
      });

    this.program
      .command('demo')
      .description('Run a demonstration scan with mock data')
      .option('-o, --output <file>', 'Output file path', 'demo-report.html')
      .action(async (options) => {
        await this.runDemo(options);
      });
  }

  async run() {
    await this.program.parseAsync(process.argv);
  }

  async runScan(options) {
    // Get LinkedIn URL from positional argument if not provided as option
    const args = this.program.args;
    const linkedinUrl = options.linkedin || args[0];
    
    if (!linkedinUrl && !options.offline) {
      console.log(chalk.red('❌ LinkedIn URL is required unless using --offline mode'));
      console.log(chalk.yellow('Usage: credsweeper scan --linkedin "https://linkedin.com/in/username"'));
      console.log(chalk.yellow('   or: credsweeper scan "https://linkedin.com/in/username"'));
      return;
    }

    const spinner = ora('Initializing CredSweeper...').start();

    try {
      const credSweeper = new CredSweeper({
        validate: options.validate,
        deep: options.deep,
        offline: options.offline,
        company: options.company,
        output: options.output
      });

      spinner.text = 'Starting comprehensive scan...';
      const results = await credSweeper.scan(linkedinUrl);

      spinner.succeed('Scan completed successfully!');
      
      this.displayResults(results);
      
      console.log(chalk.green(`\n📊 Full report saved to: ${options.output}`));
      
    } catch (error) {
      spinner.fail('Scan failed');
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }
  }

  async runDemo(options) {
    const spinner = ora('Running demonstration scan...').start();

    try {
      const credSweeper = new CredSweeper({
        validate: false,
        deep: true,
        offline: true,
        output: options.output
      });

      // Use demo LinkedIn URL
      const results = await credSweeper.scan('https://linkedin.com/in/demo-user');

      spinner.succeed('Demo scan completed!');
      
      this.displayResults(results);
      
      console.log(chalk.green(`\n📊 Demo report saved to: ${options.output}`));
      console.log(chalk.yellow('\n💡 This was a demonstration with mock data.'));
      console.log(chalk.yellow('   Use real LinkedIn URLs for actual scanning.'));
      
    } catch (error) {
      spinner.fail('Demo failed');
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }
  }

  displayResults(results) {
    const { target, aliases, credentials, repositories, exposures, metadata } = results;

    console.log(chalk.blue('\n🕵️‍♂️  CREDSWEEPER RESULTS'));
    console.log(chalk.blue('═'.repeat(50)));

    // Target Information
    console.log(chalk.cyan('\n📋 Target Profile:'));
    console.log(`   Name: ${target.name}`);
    console.log(`   Company: ${target.company}`);
    console.log(`   Location: ${target.location}`);

    // Summary Statistics
    console.log(chalk.cyan('\n📊 Exposure Summary:'));
    console.log(`   Risk Level: ${this.colorizeRisk(metadata.riskLevel)}`);
    console.log(`   Total Credentials: ${chalk.yellow(metadata.totalFindings)}`);
    console.log(`   Generated Aliases: ${chalk.yellow(aliases.length)}`);
    console.log(`   GitHub Repositories: ${chalk.yellow(repositories.length)}`);
    console.log(`   Public Exposures: ${chalk.yellow(exposures.length)}`);

    // High-risk credentials
    const highRiskCreds = credentials.filter(c => c.riskLevel === 'CRITICAL' || c.riskLevel === 'HIGH');
    if (highRiskCreds.length > 0) {
      console.log(chalk.red('\n🚨 High-Risk Credentials Found:'));
      highRiskCreds.slice(0, 5).forEach(cred => {
        console.log(`   ${this.colorizeRisk(cred.riskLevel)} ${cred.description}`);
        console.log(`      Confidence: ${(cred.confidence * 100).toFixed(1)}%`);
      });
      
      if (highRiskCreds.length > 5) {
        console.log(`   ... and ${highRiskCreds.length - 5} more (see full report)`);
      }
    }

    // Repository highlights
    if (repositories.length > 0) {
      console.log(chalk.cyan('\n🐙 GitHub Repositories:'));
      repositories.slice(0, 3).forEach(repo => {
        console.log(`   ${repo.name} (${repo.language || 'Unknown'}) - ${repo.stars} stars`);
      });
      
      if (repositories.length > 3) {
        console.log(`   ... and ${repositories.length - 3} more repositories`);
      }
    }
  }

  colorizeRisk(riskLevel) {
    switch (riskLevel) {
      case 'CRITICAL':
        return chalk.red.bold(riskLevel);
      case 'HIGH':
        return chalk.red(riskLevel);
      case 'MEDIUM':
        return chalk.yellow(riskLevel);
      case 'LOW':
        return chalk.green(riskLevel);
      default:
        return chalk.gray(riskLevel);
    }
  }
}