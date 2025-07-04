import 'dotenv/config';
import { LinkedInExtractor } from './extractors/LinkedInExtractor.js';
import { UsernameGenerator } from './generators/UsernameGenerator.js';
import { GitHubRecon } from './recon/GitHubRecon.js';
import { PublicExposureScanner } from './scanners/PublicExposureScanner.js';
import { SecretDetector } from './detectors/SecretDetector.js';
import { ReportGenerator } from './reports/ReportGenerator.js';
import { Logger } from './utils/Logger.js';

export class CredSweeper {
  constructor(options = {}) {
    this.options = {
      validate: false,
      deep: false,
      offline: false,
      company: null,
      output: 'report.html',
      ...options
    };
    
    this.logger = new Logger();
    this.results = {
      target: {},
      aliases: [],
      credentials: [],
      exposures: [],
      repositories: [],
      metadata: {
        scanDate: new Date().toISOString(),
        totalFindings: 0,
        riskLevel: 'LOW'
      }
    };
  }

  async scan(linkedinUrl) {
    this.logger.info('🕵️  Starting CredSweeper scan...');
    
    try {
      // Phase 1: Extract identity from LinkedIn
      await this.extractIdentity(linkedinUrl);
      
      // Phase 2: Generate username permutations
      await this.generateAliases();
      
      // Phase 3: GitHub reconnaissance
      await this.performGitHubRecon();
      
      // Phase 4: Public exposure discovery
      await this.scanPublicExposures();
      
      // Phase 5: Detect and validate secrets
      await this.detectSecrets();
      
      // Phase 6: Generate comprehensive report
      await this.generateReport();
      
      this.logger.success('✅ Scan completed successfully!');
      return this.results;
      
    } catch (error) {
      this.logger.error('❌ Scan failed:', error.message);
      throw error;
    }
  }

  async extractIdentity(linkedinUrl) {
    this.logger.info('📋 Extracting identity from LinkedIn...');
    
    const extractor = new LinkedInExtractor({
      offline: this.options.offline
    });
    
    this.results.target = await extractor.extract(linkedinUrl);
    
    if (this.options.company) {
      this.results.target.company = this.options.company;
    }
    
    this.logger.success(`Found target: ${this.results.target.name}`);
  }

  async generateAliases() {
    this.logger.info('🔄 Generating username permutations...');
    
    const generator = new UsernameGenerator();
    this.results.aliases = generator.generate(this.results.target);
    
    this.logger.success(`Generated ${this.results.aliases.length} potential aliases`);
  }

  async performGitHubRecon() {
    this.logger.info('🐙 Performing GitHub reconnaissance...');
    
    const recon = new GitHubRecon();
    const githubData = await recon.scan(this.results.aliases);
    
    this.results.repositories = githubData.repositories;
    this.results.exposures.push(...githubData.exposures);
    
    this.logger.success(`Found ${githubData.repositories.length} repositories`);
  }

  async scanPublicExposures() {
    this.logger.info('🌐 Scanning public exposures...');
    
    const scanner = new PublicExposureScanner({
      deep: this.options.deep
    });
    
    const exposures = await scanner.scan(this.results.aliases);
    this.results.exposures.push(...exposures);
    
    this.logger.success(`Found ${exposures.length} public exposures`);
  }

  async detectSecrets() {
    this.logger.info('🔍 Detecting and analyzing secrets...');
    
    const detector = new SecretDetector({
      validate: this.options.validate
    });
    
    // Scan all collected content for secrets
    const allContent = [
      ...this.results.repositories.map(r => r.content),
      ...this.results.exposures.map(e => e.content)
    ].filter(Boolean);
    
    for (const content of allContent) {
      const secrets = await detector.detect(content);
      this.results.credentials.push(...secrets);
    }
    
    // Update metadata
    this.results.metadata.totalFindings = this.results.credentials.length;
    this.results.metadata.riskLevel = this.calculateRiskLevel();
    
    this.logger.success(`Detected ${this.results.credentials.length} potential credentials`);
  }

  async generateReport() {
    this.logger.info('📊 Generating comprehensive report...');
    
    const generator = new ReportGenerator();
    await generator.generate(this.results, this.options.output);
    
    this.logger.success(`Report saved to: ${this.options.output}`);
  }

  calculateRiskLevel() {
    const credCount = this.results.credentials.length;
    const highRiskCreds = this.results.credentials.filter(c => c.confidence > 0.8).length;
    
    if (highRiskCreds > 5) return 'CRITICAL';
    if (highRiskCreds > 2) return 'HIGH';
    if (credCount > 10) return 'MEDIUM';
    return 'LOW';
  }
}