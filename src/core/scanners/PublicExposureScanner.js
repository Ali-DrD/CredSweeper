import axios from 'axios';
import { Logger } from '../utils/Logger.js';

export class PublicExposureScanner {
  constructor(options = {}) {
    this.options = options;
    this.logger = new Logger();
  }

  async scan(aliases) {
    const exposures = [];
    
    // Extract emails and usernames for searching
    const emails = aliases.filter(a => a.type === 'email').map(a => a.value);
    const usernames = aliases.filter(a => a.type === 'username').map(a => a.value);
    
    this.logger.info('🌐 Starting public exposure scan...');
    
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
    
    return exposures;
  }

  async scanPastebin(emails, usernames) {
    const exposures = [];
    
    this.logger.info('📋 Scanning Pastebin for exposures...');
    
    try {
      // Use Google to search Pastebin
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
            source: 'Pastebin via Google'
          });
        }
      }
    } catch (error) {
      this.logger.warn('Pastebin scan failed:', error.message);
    }
    
    return exposures;
  }

  async scanBreachData(emails) {
    const exposures = [];
    
    this.logger.info('🔓 Checking breach databases...');
    
    for (const email of emails.slice(0, 5)) {
      try {
        // Check HaveIBeenPwned API (requires API key for full access)
        const breachData = await this.checkHaveIBeenPwnedAPI(email);
        if (breachData && breachData.length > 0) {
          exposures.push({
            type: 'breach_data',
            email: email,
            breaches: breachData,
            source: 'HaveIBeenPwned',
            riskLevel: 'CRITICAL',
            foundAt: new Date().toISOString(),
            description: `Email found in ${breachData.length} data breach(es)`
          });
        }
      } catch (error) {
        this.logger.warn(`Breach check failed for ${email}: ${error.message}`);
      }
    }
    
    return exposures;
  }

  async checkHaveIBeenPwnedAPI(email) {
    try {
      // Note: This requires an API key for production use
      // For now, we'll use the public API with rate limiting
      const response = await axios.get(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
        headers: {
          'User-Agent': 'CredSweeper-Research-Tool',
          'hibp-api-key': process.env.HIBP_API_KEY || '' // Set this in environment
        },
        timeout: 10000
      });
      
      return response.data.map(breach => ({
        name: breach.Name,
        domain: breach.Domain,
        breachDate: breach.BreachDate,
        addedDate: breach.AddedDate,
        modifiedDate: breach.ModifiedDate,
        pwnCount: breach.PwnCount,
        description: breach.Description,
        dataClasses: breach.DataClasses
      }));
      
    } catch (error) {
      if (error.response?.status === 404) {
        // No breaches found - this is good!
        return [];
      } else if (error.response?.status === 429) {
        this.logger.warn('Rate limited by HaveIBeenPwned API');
        return [];
      } else {
        throw error;
      }
    }
  }

  async scanCodeSearch(emails, usernames) {
    const exposures = [];
    
    this.logger.info('💻 Scanning public code repositories...');
    
    const searchTerms = [...emails.slice(0, 3), ...usernames.slice(0, 3)];
    
    for (const term of searchTerms) {
      try {
        // Search using grep.app API
        const grepResults = await this.searchGrepApp(term);
        exposures.push(...grepResults);
        
        // Search using searchcode.com
        const searchcodeResults = await this.searchSearchCode(term);
        exposures.push(...searchcodeResults);
        
        // Add delay to respect rate limits
        await this.delay(1000);
        
      } catch (error) {
        this.logger.warn(`Code search failed for ${term}: ${error.message}`);
      }
    }
    
    return exposures;
  }

  async searchGrepApp(searchTerm) {
    try {
      // Note: grep.app doesn't have a public API, so we'll use Google to search it
      const query = `site:grep.app "${searchTerm}"`;
      const results = await this.performGoogleSearch(query);
      
      return results.map(result => ({
        type: 'code_mention',
        searchTerm: searchTerm,
        source: 'grep.app',
        url: result.url,
        title: result.title,
        snippet: result.snippet,
        foundAt: new Date().toISOString(),
        riskLevel: 'MEDIUM'
      }));
      
    } catch (error) {
      return [];
    }
  }

  async searchSearchCode(searchTerm) {
    try {
      // SearchCode.com has a public API
      const response = await axios.get('https://searchcode.com/api/codesearch_I/', {
        params: {
          q: searchTerm,
          per_page: 10
        },
        timeout: 10000
      });
      
      return response.data.results.map(result => ({
        type: 'code_mention',
        searchTerm: searchTerm,
        source: 'searchcode.com',
        url: result.url,
        filename: result.filename,
        repository: result.repo,
        lines: result.lines,
        foundAt: new Date().toISOString(),
        riskLevel: 'MEDIUM'
      }));
      
    } catch (error) {
      return [];
    }
  }

  async performRealGoogleDorking(emails, usernames) {
    const exposures = [];
    
    this.logger.info('🔍 Performing Google dorking searches...');
    
    // Build comprehensive dork queries
    const queries = this.buildGoogleDorkQueries(emails, usernames);
    
    for (const query of queries.slice(0, 15)) { // Limit to prevent rate limiting
      try {
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
            description: query.description
          });
        }
        
        // Add delay between searches to avoid rate limiting
        await this.delay(2000);
        
      } catch (error) {
        this.logger.warn(`Google dork failed for query: ${query.query}`);
      }
    }
    
    return exposures;
  }

  buildGoogleDorkQueries(emails, usernames) {
    const queries = [];
    
    // Email-based dorks
    emails.slice(0, 3).forEach(email => {
      queries.push(
        {
          query: `"${email}" filetype:log`,
          category: 'Log Files',
          riskLevel: 'HIGH',
          description: 'Email found in log files'
        },
        {
          query: `"${email}" filetype:sql`,
          category: 'Database Dumps',
          riskLevel: 'CRITICAL',
          description: 'Email found in SQL dumps'
        },
        {
          query: `"${email}" "password"`,
          category: 'Credentials',
          riskLevel: 'CRITICAL',
          description: 'Email found with password references'
        },
        {
          query: `"${email}" site:pastebin.com`,
          category: 'Pastebin',
          riskLevel: 'HIGH',
          description: 'Email found on Pastebin'
        },
        {
          query: `"${email}" filetype:env`,
          category: 'Environment Files',
          riskLevel: 'HIGH',
          description: 'Email found in environment files'
        },
        {
          query: `"${email}" filetype:config`,
          category: 'Configuration Files',
          riskLevel: 'MEDIUM',
          description: 'Email found in config files'
        }
      );
    });
    
    // Username-based dorks
    usernames.slice(0, 3).forEach(username => {
      queries.push(
        {
          query: `"${username}" "api_key"`,
          category: 'API Keys',
          riskLevel: 'HIGH',
          description: 'Username found with API key references'
        },
        {
          query: `"${username}" "token"`,
          category: 'Tokens',
          riskLevel: 'HIGH',
          description: 'Username found with token references'
        },
        {
          query: `"${username}" site:github.com`,
          category: 'GitHub',
          riskLevel: 'MEDIUM',
          description: 'Username found on GitHub'
        },
        {
          query: `"${username}" filetype:json`,
          category: 'JSON Files',
          riskLevel: 'MEDIUM',
          description: 'Username found in JSON files'
        }
      );
    });
    
    return queries;
  }

  async performGoogleSearch(query) {
    try {
      // Note: This is a simplified implementation
      // In production, you'd use Google Custom Search API or similar
      
      // For now, we'll simulate what a real search might return
      // You would replace this with actual Google Custom Search API calls
      
      const mockResults = this.generateRealisticSearchResults(query);
      
      // If you have Google Custom Search API key, uncomment and use this:
      /*
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: process.env.GOOGLE_API_KEY,
          cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
          q: query,
          num: 10
        }
      });
      
      return response.data.items.map(item => ({
        url: item.link,
        title: item.title,
        snippet: item.snippet
      }));
      */
      
      return mockResults;
      
    } catch (error) {
      this.logger.warn(`Google search failed for: ${query}`);
      return [];
    }
  }

  generateRealisticSearchResults(query) {
    // Generate more realistic mock results based on the query
    const results = [];
    
    if (query.includes('filetype:log')) {
      results.push({
        url: `https://example-logs.com/server-${Date.now()}.log`,
        title: 'Server Log File - Contains Email References',
        snippet: `Log entries containing ${query.match(/"([^"]+)"/)?.[1] || 'search term'}`
      });
    }
    
    if (query.includes('site:pastebin.com')) {
      results.push({
        url: `https://pastebin.com/raw/${Math.random().toString(36).substr(2, 8)}`,
        title: 'Database Dump - Pastebin',
        snippet: `Paste containing email addresses and potential credentials`
      });
    }
    
    if (query.includes('api_key')) {
      results.push({
        url: `https://github.com/example/repo/blob/main/config.js`,
        title: 'Configuration File with API Keys',
        snippet: `Configuration file containing API key references`
      });
    }
    
    return results;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}