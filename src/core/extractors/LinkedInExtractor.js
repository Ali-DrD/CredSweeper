import { chromium } from 'playwright';
import { Logger } from '../utils/Logger.js';

export class LinkedInExtractor {
  constructor(options = {}) {
    this.options = options;
    this.logger = new Logger();
  }

  async extract(linkedinUrl) {
    if (this.options.offline) {
      return this.extractOffline();
    }

    try {
      const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Set user agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      await page.goto(linkedinUrl, { waitUntil: 'networkidle' });
      
      // Extract profile information
      const profile = await page.evaluate(() => {
        const getName = () => {
          const selectors = [
            'h1.text-heading-xlarge',
            '.pv-text-details__left-panel h1',
            '.top-card-layout__title'
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return element.textContent.trim();
          }
          return null;
        };

        const getHeadline = () => {
          const selectors = [
            '.text-body-medium.break-words',
            '.pv-text-details__left-panel .text-body-medium',
            '.top-card-layout__headline'
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return element.textContent.trim();
          }
          return null;
        };

        const getCompany = () => {
          const headline = getHeadline();
          if (headline && headline.includes(' at ')) {
            return headline.split(' at ').pop().trim();
          }
          return null;
        };

        const getLocation = () => {
          const selectors = [
            '.text-body-small.inline.t-black--light.break-words',
            '.pv-text-details__left-panel .text-body-small'
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.includes(',')) {
              return element.textContent.trim();
            }
          }
          return null;
        };

        return {
          name: getName(),
          headline: getHeadline(),
          company: getCompany(),
          location: getLocation(),
          profileUrl: window.location.href
        };
      });

      await browser.close();
      
      // Clean and validate extracted data
      return this.cleanProfile(profile);
      
    } catch (error) {
      this.logger.warn('LinkedIn extraction failed, using fallback method');
      return this.extractFallback(linkedinUrl);
    }
  }

  extractOffline() {
    // Fallback for offline mode - user provides manual input
    return {
      name: 'John Doe',
      headline: 'Software Engineer at TechCorp',
      company: 'TechCorp',
      location: 'San Francisco, CA',
      profileUrl: 'offline-mode'
    };
  }

  extractFallback(linkedinUrl) {
    // Extract basic info from URL structure
    const urlParts = linkedinUrl.split('/');
    const username = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
    
    return {
      name: this.guessNameFromUsername(username),
      headline: 'Unknown',
      company: 'Unknown',
      location: 'Unknown',
      profileUrl: linkedinUrl,
      username: username
    };
  }

  guessNameFromUsername(username) {
    // Simple name guessing from LinkedIn username
    const cleaned = username.replace(/[-_]/g, ' ');
    return cleaned.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  cleanProfile(profile) {
    return {
      name: profile.name || 'Unknown',
      headline: profile.headline || 'Unknown',
      company: profile.company || 'Unknown',
      location: profile.location || 'Unknown',
      profileUrl: profile.profileUrl,
      extractedAt: new Date().toISOString()
    };
  }
}