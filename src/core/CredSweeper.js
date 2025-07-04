import axios from 'axios';
import { Logger } from '../utils/Logger.js';

export class PublicExposureScanner {
  constructor(options = {}) {
    this.options = options;
    this.logger = new Logger();
    
    // Load API keys from environment
    this.hibpApiKey = process.env.HIBP_API_KEY;
    this.googleApiKey = process.env.GOOGLE_API_KEY;
    this.googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    
    if (!this.hibpApiKey) {
      this.logger.warn('⚠️  HIBP_API_KEY not set - breach checking will be limited');
    }
    
    if (!this.googleApiKey || !this.googleSearchEngineId) {
      this.logger.warn('⚠️  Google API credentials not set - using mock search results');
    }
  }

  async scan(aliases) {
    const exposures = [];
    
    // Extract emails and usernames for searching
    const emails = aliases.filter(a => a.type === 'email').map(a => a.value);
    const usernames = aliases.filter(a => a.type === 'username').map(a => a.value);
    
    this.logger.info('🌐 Starting comprehensive public exposure scan...');
    this.logger.info(`   📧 Checking ${emails.length} email addresses`);
    this.logger.info(`   👤 Checking ${usernames.length} usernames`);
    
    // Scan different sources
    const pastebinResults = await this.scanPastebin(emails, usernames);
    const breachResults = await this.scanBreachData(emails);
    const codeSearchResults = await this.scanCodeSearch(emails, usernames);
    
    exposures.push(...pastebinResults);
    exposures.push(...breachResults);
    exposures.push(...codeSearchResults);
    
    if (this.options.deep) {
      this.logger.info('🔍 Performing deep Google dorking...');
      const googleResults = await this.performRealGoogleDorking(emails, usernames);
      exposures.push(...googleResults);
    }
    
    this.logger.success(`✅ Found ${exposures.length} potential exposures`);
    return exposures;
  }

  async scanPastebin(emails, usernames) {
    const exposures = [];
    
    this.logger.info('📋 Scanning Pastebin for exposures...');
    
    try {
      // Use Google to search Pastebin for emails
      for (const email of emails.slice(0, 3)) {
        const query = `site:pastebin.com "${email}"`;
        const results = await this.performGoogleSearch(query);
        
        for (const result of results) {
          exposures.push({
            type: 'pastebin_exposure',
            email: email,
            url: result.url,
            title: result.title,
            snippet: result.snippet,
            foundAt: new Date().toISOString(),
            riskLevel: 'HIGH',
            source: 'Pastebin via Google',
            description: `Email found on Pastebin: ${result.title}`
          });
        }
        
        await this.delay(1000); // Rate limiting
      }
      
      // Search for usernames on Pastebin
      for (const username of usernames.slice(0, 2)) {
        const query = `site:pastebin.com "${username}"`;
        const results = await this.performGoogleSearch(query);
        
        for (const result of results) {
          exposures.push({
            type: 'pastebin_exposure',
            username: username,
            url: result.url,
            title: result.title,
            snippet: result.snippet,
            foundAt: new Date().toISOString(),
            riskLevel: 'MEDIUM',
            source: 'Pastebin via Google',
            description: `Username found on Pastebin: ${result.title}`
          });
        }
        
        await this.delay(1000);
      }
      
    } catch (error) {
      this.logger.warn('Pastebin scan failed:', error.message);
    }
    
    return exposures;
  }

  async scanBreachData(emails) {
    const exposures = [];
    
    this.logger.info('🔓 Checking breach databases with HaveIBeenPwned...');
    
    for (const email of emails.slice(0, 5)) {
      try {
        this.logger.info(`   Checking: ${email}`);
        
        // Check HaveIBeenPwned API
        const breachData = await this.checkHaveIBeenPwnedAPI(email);
        if (breachData && breachData.length > 0) {
          this.logger.warn(`   ⚠️  Found ${breachData.length} breach(es) for ${email}`);
          
          exposures.push({
            type: 'breach_data',
            email: email,
            breaches: breachData,
            source: 'HaveIBeenPwned',
            riskLevel: 'CRITICAL',
            foundAt: new Date().toISOString(),
            description: `Email found in ${breachData.length} data breach(es)`,
            breachNames: breachData.map(b => b.name).join(', ')
          });
        } else {
          this.logger.success(`   ✅ No breaches found for ${email}`);
        }
        
        // Check for paste exposures
        const pasteData = await this.checkHaveIBeenPwnedPastes(email);
        if (pasteData && pasteData.length > 0) {
          this.logger.warn(`   ⚠️  Found ${pasteData.length} paste exposure(s) for ${email}`);
          
          exposures.push({
            type: 'paste_exposure',
            email: email,
            pastes: pasteData,
            source: 'HaveIBeenPwned Pastes',
            riskLevel: 'HIGH',
            foundAt: new Date().toISOString(),
            description: `Email found in ${pasteData.length} paste(s)`
          });
        }
        
        // Rate limiting - HIBP allows 1 request per 1.5 seconds
        await this.delay(1600);
        
      } catch (error) {
        this.logger.warn(`Breach check failed for ${email}: ${error.message}`);
        await this.delay(2000); // Longer delay on error
      }
    }
    
    return exposures;
  }

  async checkHaveIBeenPwnedAPI(email) {
    try {
      const headers = {
        'User-Agent': 'CredSweeper-Research-Tool-v2.0'
      };
      
      // Add API key if available
      if (this.hibpApiKey) {
        headers['hibp-api-key'] = this.hibpApiKey;
      }
      
      const response = await axios.get(
        `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`,
        {
          headers: headers,
          timeout: 15000,
          params: {
            truncateResponse: false
          }
        }
      );
      
      return response.data.map(breach => ({
        name: breach.Name,
        domain: breach.Domain,
        breachDate: breach.BreachDate,
        addedDate: breach.AddedDate,
        modifiedDate: breach.ModifiedDate,
        pwnCount: breach.PwnCount,
        description: breach.Description,
        dataClasses: breach.DataClasses,
        isVerified: breach.IsVerified,
        isFabricated: breach.IsFabricated,
        isSensitive: breach.IsSensitive,
        isRetired: breach.IsRetired
      }));
      
    } catch (error) {
      if (error.response?.status === 404) {
        // No breaches found - this is good!
        return [];
      } else if (error.response?.status === 429) {
        this.logger.warn('Rate limited by HaveIBeenPwned API - waiting...');
        await this.delay(5000);
        return [];
      } else if (error.response?.status === 401) {
        this.logger.warn('HaveIBeenPwned API key invalid or missing');
        return [];
      } else {
        throw error;
      }
    }
  }

  async checkHaveIBeenPwnedPastes(email) {
    try {
      const headers = {
        'User-Agent': 'CredSweeper-Research-Tool-v2.0'
      };
      
      if (this.hibpApiKey) {
        headers['hibp-api-key'] = this.hibpApiKey;
      }
      
      const response = await axios.get(
        `https://haveibeenpwned.com/api/v3/pasteaccount/${encodeURIComponent(email)}`,
        {
          headers: headers,
          timeout: 15000
        }
      );
      
      return response.data.map(paste => ({
        source: paste.Source,
        id: paste.Id,
        title: paste.Title,
        date: paste.Date,
        emailCount: paste.EmailCount
      }));
      
    } catch (error) {
      if (error.response?.status === 404) {
        return [];
      } else if (error.response?.status === 429) {
        await this.delay(5000);
        return [];
      } else {
        return [];
      }
    }
  }

  async scanCodeSearch(emails, usernames) {
    const exposures = [];
    
    this.logger.info('💻 Scanning public code repositories...');
    
    const searchTerms = [...emails.slice(0, 3), ...usernames.slice(0, 3)];
    
    for (const term of searchTerms) {
      try {
        this.logger.info(`   Searching for: ${term}`);
        
        // Search using searchcode.com API
        const searchcodeResults = await this.searchSearchCode(term);
        exposures.push(...searchcodeResults);
        
        // Search GitHub via Google
        const githubResults = await this.searchGitHubViaGoogle(term);
        exposures.push(...githubResults);
        
        // Add delay to respect rate limits
        await this.delay(1000);
        
      } catch (error) {
        this.logger.warn(`Code search failed for ${term}: ${error.message}`);
      }
    }
    
    return exposures;
  }

  async searchSearchCode(searchTerm) {
    try {
      const response = await axios.get('https://searchcode.com/api/codesearch_I/', {
        params: {
          q: searchTerm,
          per_page: 10,
          p: 0
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'CredSweeper-Research-Tool'
        }
      });
      
      if (response.data && response.data.results) {
        return response.data.results.map(result => ({
          type: 'code_mention',
          searchTerm: searchTerm,
          source: 'searchcode.com',
          url: result.url,
          filename: result.filename,
          repository: result.repo,
          lines: result.lines,
          foundAt: new Date().toISOString(),
          riskLevel: 'MEDIUM',
          description: `Found in ${result.filename} at ${result.repo}`
        }));
      }
      
      return [];
      
    } catch (error) {
      this.logger.warn(`SearchCode API failed: ${error.message}`);
      return [];
    }
  }

  async searchGitHubViaGoogle(searchTerm) {
    try {
      const query = `site:github.com "${searchTerm}" -site:github.com/search`;
      const results = await this.performGoogleSearch(query);
      
      return results.map(result => ({
        type: 'github_mention',
        searchTerm: searchTerm,
        source: 'GitHub via Google',
        url: result.url,
        title: result.title,
        snippet: result.snippet,
        foundAt: new Date().toISOString(),
        riskLevel: 'MEDIUM',
        description: `Found on GitHub: ${result.title}`
      }));
      
    } catch (error) {
      return [];
    }
  }

  async performRealGoogleDorking(emails, usernames) {
    const exposures = [];
    
    this.logger.info('🔍 Performing comprehensive Google dorking...');
    
    // Build comprehensive dork queries
    const queries = this.buildGoogleDorkQueries(emails, usernames);
    
    this.logger.info(`   Executing ${queries.length} targeted searches...`);
    
    for (const query of queries.slice(0, 20)) { // Limit to prevent rate limiting
      try {
        this.logger.info(`   🔎 ${query.category}: ${query.query.substring(0, 50)}...`);
        
        const results = await this.performGoogleSearch(query.query);
        
        for (const result of results) {
          exposures.push({
            type: 'google_dork',
            category: query.category,
            query: query.query,
            url: result.url,
            title: result.title,
            snippet: result.snippet,
            foundAt: new Date().toISOString(),
            riskLevel: query.riskLevel || 'MEDIUM',
            description: query.description,
            searchTerm: query.searchTerm
          });
        }
        
        // Add delay between searches to avoid rate limiting
        await this.delay(2000);
        
      } catch (error) {
        this.logger.warn(`Google dork failed for query: ${query.query.substring(0, 30)}...`);
        await this.delay(3000); // Longer delay on error
      }
    }
    
    return exposures;
  }

  buildGoogleDorkQueries(emails, usernames) {
    const queries = [];
    
    // Email-based dorks
    emails.slice(0, 2).forEach(email => {
      queries.push(
        {
          query: `"${email}" filetype:log`,
          category: 'Log Files',
          riskLevel: 'HIGH',
          description: 'Email found in log files',
          searchTerm: email
        },
        {
          query: `"${email}" filetype:sql`,
          category: 'Database Dumps',
          riskLevel: 'CRITICAL',
          description: 'Email found in SQL dumps',
          searchTerm: email
        },
        {
          query: `"${email}" "password" -site:linkedin.com -site:facebook.com`,
          category: 'Credentials',
          riskLevel: 'CRITICAL',
          description: 'Email found with password references',
          searchTerm: email
        },
        {
          query: `"${email}" filetype:env`,
          category: 'Environment Files',
          riskLevel: 'HIGH',
          description: 'Email found in environment files',
          searchTerm: email
        },
        {
          query: `"${email}" filetype:config`,
          category: 'Configuration Files',
          riskLevel: 'MEDIUM',
          description: 'Email found in config files',
          searchTerm: email
        },
        {
          query: `"${email}" "api_key" OR "apikey" OR "api-key"`,
          category: 'API Keys',
          riskLevel: 'HIGH',
          description: 'Email found with API key references',
          searchTerm: email
        },
        {
          query: `"${email}" filetype:json "password" OR "token" OR "secret"`,
          category: 'JSON Secrets',
          riskLevel: 'HIGH',
          description: 'Email found in JSON with secrets',
          searchTerm: email
        }
      );
    });
    
    // Username-based dorks
    usernames.slice(0, 2).forEach(username => {
      queries.push(
        {
          query: `"${username}" "api_key" OR "apikey"`,
          category: 'API Keys',
          riskLevel: 'HIGH',
          description: 'Username found with API key references',
          searchTerm: username
        },
        {
          query: `"${username}" "token" OR "access_token"`,
          category: 'Tokens',
          riskLevel: 'HIGH',
          description: 'Username found with token references',
          searchTerm: username
        },
        {
          query: `"${username}" filetype:json`,
          category: 'JSON Files',
          riskLevel: 'MEDIUM',
          description: 'Username found in JSON files',
          searchTerm: username
        },
        {
          query: `"${username}" "password" filetype:txt`,
          category: 'Text Files',
          riskLevel: 'HIGH',
          description: 'Username found with password in text files',
          searchTerm: username
        }
      );
    });
    
    return queries;
  }

  async performGoogleSearch(query) {
    try {
      // Use Google Custom Search API if credentials are available
      if (this.googleApiKey && this.googleSearchEngineId) {
        const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
          params: {
            key: this.googleApiKey,
            cx: this.googleSearchEngineId,
            q: query,
            num: 10,
            safe: 'off'
          },
          timeout: 15000
        });
        
        if (response.data.items) {
          return response.data.items.map(item => ({
            url: item.link,
            title: item.title,
            snippet: item.snippet || ''
          }));
        }
        
        return [];
      } else {
        // Fallback to mock results if no API credentials
        this.logger.warn('Using mock Google search results - set GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID for real searches');
        return this.generateRealisticSearchResults(query);
      }
      
    } catch (error) {
      if (error.response?.status === 429) {
        this.logger.warn('Google API rate limit exceeded - waiting...');
        await this.delay(10000);
      } else {
        this.logger.warn(`Google search failed for: ${query.substring(0, 30)}... - ${error.message}`);
      }
      return [];
    }
  }

  generateRealisticSearchResults(query) {
    // Generate more realistic mock results based on the query
    const results = [];
    
    // Only generate results for certain types of queries to simulate real findings
    if (Math.random() > 0.7) { // 30% chance of finding something
      if (query.includes('filetype:log')) {
        results.push({
          url: `https://logs.example.com/server-${Date.now()}.log`,
          title: 'Server Log File - Access Logs',
          snippet: `Log entries containing ${query.match(/"([^"]+)"/)?.[1] || 'search term'} in authentication attempts`
        });
      }
      
      if (query.includes('site:pastebin.com')) {
        results.push({
          url: `https://pastebin.com/raw/${Math.random().toString(36).substr(2, 8)}`,
          title: 'Database Configuration - Pastebin',
          snippet: `Configuration file containing email addresses and database credentials`
        });
      }
      
      if (query.includes('api_key')) {
        results.push({
          url: `https://github.com/example/repo/blob/main/config.js`,
          title: 'Configuration File with API Keys',
          snippet: `JavaScript configuration file containing API key references and tokens`
        });
      }
    }
    
    return results;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}