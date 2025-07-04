import crypto from 'crypto';
import { Logger } from '../utils/Logger.js';

export class SecretDetector {
  constructor(options = {}) {
    this.options = options;
    this.logger = new Logger();
    this.patterns = this.initializePatterns();
  }

  initializePatterns() {
    return {
      // AWS Credentials
      aws_access_key: {
        pattern: /AKIA[0-9A-Z]{16}/g,
        description: 'AWS Access Key ID',
        severity: 'HIGH'
      },
      aws_secret_key: {
        pattern: /[A-Za-z0-9/+=]{40}/g,
        description: 'AWS Secret Access Key',
        severity: 'HIGH',
        context: ['aws', 'secret', 'key']
      },
      
      // API Keys
      generic_api_key: {
        pattern: /[Aa][Pp][Ii]_?[Kk][Ee][Yy].*[=:]\s*['"]*([A-Za-z0-9_\-]{20,})['"]*|[Aa][Pp][Ii][Kk][Ee][Yy].*[=:]\s*['"]*([A-Za-z0-9_\-]{20,})['"]*|api_key.*[=:]\s*['"]*([A-Za-z0-9_\-]{20,})['"]*/gi,
        description: 'Generic API Key',
        severity: 'MEDIUM'
      },
      
      // Database Credentials
      db_password: {
        pattern: /(?:password|passwd|pwd).*[=:]\s*['"]*([^'"\s]{8,})['"]*|DB_PASS.*[=:]\s*['"]*([^'"\s]{8,})['"]*/gi,
        description: 'Database Password',
        severity: 'HIGH'
      },
      
      // JWT Tokens
      jwt_token: {
        pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
        description: 'JWT Token',
        severity: 'MEDIUM'
      },
      
      // Private Keys
      private_key: {
        pattern: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
        description: 'Private Key',
        severity: 'CRITICAL'
      },
      
      // Email/Password Combinations
      email_password: {
        pattern: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s*[:|=]\s*([^\s]{6,})/g,
        description: 'Email/Password Combination',
        severity: 'HIGH'
      },
      
      // GitHub Tokens
      github_token: {
        pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
        description: 'GitHub Token',
        severity: 'HIGH'
      },
      
      // Slack Tokens
      slack_token: {
        pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g,
        description: 'Slack Token',
        severity: 'MEDIUM'
      },
      
      // Generic Secrets
      generic_secret: {
        pattern: /(?:secret|token|key|password).*[=:]\s*['"]*([A-Za-z0-9_\-!@#$%^&*()+=]{12,})['"]*|SECRET.*[=:]\s*['"]*([A-Za-z0-9_\-!@#$%^&*()+=]{12,})['"]*/gi,
        description: 'Generic Secret',
        severity: 'MEDIUM'
      }
    };
  }

  async detect(content) {
    const secrets = [];
    
    if (!content || typeof content !== 'string') {
      return secrets;
    }

    // Split content into lines for context
    const lines = content.split('\n');
    
    for (const [patternName, patternConfig] of Object.entries(this.patterns)) {
      const matches = this.findMatches(content, patternConfig, lines);
      secrets.push(...matches.map(match => ({
        ...match,
        type: patternName,
        description: patternConfig.description,
        severity: patternConfig.severity
      })));
    }

    // Filter and score secrets
    const filteredSecrets = this.filterSecrets(secrets);
    const scoredSecrets = await this.scoreSecrets(filteredSecrets);
    
    return scoredSecrets;
  }

  findMatches(content, patternConfig, lines) {
    const matches = [];
    let match;
    
    while ((match = patternConfig.pattern.exec(content)) !== null) {
      const matchedText = match[0];
      const lineNumber = this.findLineNumber(content, match.index, lines);
      const context = this.extractContext(lines, lineNumber);
      
      matches.push({
        value: matchedText,
        lineNumber: lineNumber,
        context: context,
        position: match.index,
        entropy: this.calculateEntropy(matchedText),
        foundAt: new Date().toISOString()
      });
    }
    
    // Reset regex lastIndex
    patternConfig.pattern.lastIndex = 0;
    
    return matches;
  }

  findLineNumber(content, position, lines) {
    let currentPos = 0;
    for (let i = 0; i < lines.length; i++) {
      currentPos += lines[i].length + 1; // +1 for newline
      if (currentPos > position) {
        return i + 1;
      }
    }
    return lines.length;
  }

  extractContext(lines, lineNumber) {
    const contextLines = 2;
    const start = Math.max(0, lineNumber - contextLines - 1);
    const end = Math.min(lines.length, lineNumber + contextLines);
    
    return lines.slice(start, end).join('\n');
  }

  calculateEntropy(text) {
    const freq = {};
    for (const char of text) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const length = text.length;
    
    for (const count of Object.values(freq)) {
      const p = count / length;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }

  filterSecrets(secrets) {
    return secrets.filter(secret => {
      // Filter out common false positives
      const falsePositives = [
        /^(test|example|sample|demo|placeholder)/i,
        /^(your|my|the)_/i,
        /^(123|abc|xxx)/i,
        /password123/i,
        /changeme/i
      ];
      
      return !falsePositives.some(fp => fp.test(secret.value));
    });
  }

  async scoreSecrets(secrets) {
    return secrets.map(secret => {
      let confidence = 0.5; // Base confidence
      
      // Entropy scoring
      if (secret.entropy > 4.5) confidence += 0.2;
      if (secret.entropy > 5.5) confidence += 0.2;
      
      // Context scoring
      const contextLower = secret.context.toLowerCase();
      const highRiskKeywords = ['prod', 'production', 'live', 'api', 'secret', 'key'];
      const testKeywords = ['test', 'dev', 'development', 'staging', 'demo'];
      
      if (highRiskKeywords.some(keyword => contextLower.includes(keyword))) {
        confidence += 0.3;
      }
      
      if (testKeywords.some(keyword => contextLower.includes(keyword))) {
        confidence -= 0.2;
      }
      
      // Length scoring
      if (secret.value.length > 30) confidence += 0.1;
      if (secret.value.length > 50) confidence += 0.1;
      
      // Severity adjustment
      const severityMultiplier = {
        'CRITICAL': 1.2,
        'HIGH': 1.1,
        'MEDIUM': 1.0,
        'LOW': 0.9
      };
      
      confidence *= severityMultiplier[secret.severity] || 1.0;
      confidence = Math.min(1.0, Math.max(0.0, confidence));
      
      return {
        ...secret,
        confidence: Math.round(confidence * 100) / 100,
        riskLevel: this.calculateRiskLevel(confidence, secret.severity)
      };
    });
  }

  calculateRiskLevel(confidence, severity) {
    if (confidence > 0.8 && ['CRITICAL', 'HIGH'].includes(severity)) {
      return 'CRITICAL';
    }
    if (confidence > 0.6 && severity === 'HIGH') {
      return 'HIGH';
    }
    if (confidence > 0.4) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  async validateSecret(secret) {
    if (!this.options.validate) {
      return { valid: null, message: 'Validation disabled' };
    }

    // Implement validation logic based on secret type
    switch (secret.type) {
      case 'aws_access_key':
        return await this.validateAWSKey(secret.value);
      case 'github_token':
        return await this.validateGitHubToken(secret.value);
      default:
        return { valid: null, message: 'Validation not implemented for this type' };
    }
  }

  async validateAWSKey(key) {
    // Mock AWS validation - would use AWS SDK in real implementation
    return {
      valid: Math.random() > 0.7,
      message: 'Mock validation result'
    };
  }

  async validateGitHubToken(token) {
    // Mock GitHub validation - would use GitHub API in real implementation
    return {
      valid: Math.random() > 0.5,
      message: 'Mock validation result'
    };
  }
}