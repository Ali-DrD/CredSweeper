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
      this.logger.info('🔍 Launching browser for LinkedIn extraction...');
      
      const browser = await chromium.launch({ 
        headless: false, // Set to false to see what's happening
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US'
      });
      
      const page = await context.newPage();
      
      // Add stealth measures
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      
      this.logger.info(`📱 Navigating to: ${linkedinUrl}`);
      
      try {
        await page.goto(linkedinUrl, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
        
        // Wait for page to load
        await page.waitForTimeout(3000);
        
        // Check if we're blocked or redirected
        const currentUrl = page.url();
        if (currentUrl.includes('authwall') || currentUrl.includes('login')) {
          this.logger.warn('⚠️  LinkedIn requires login - extracting what we can from public view');
        }
        
        // Extract profile information with multiple selectors
        const profile = await page.evaluate(() => {
          const getText = (selectors) => {
            for (const selector of selectors) {
              const element = document.querySelector(selector);
              if (element && element.textContent.trim()) {
                return element.textContent.trim();
              }
            }
            return null;
          };

          const getName = () => {
            const selectors = [
              'h1.text-heading-xlarge',
              '.pv-text-details__left-panel h1',
              '.top-card-layout__title',
              'h1[data-anonymize="person-name"]',
              '.pv-top-card--list li:first-child',
              '.profile-photo-edit__preview',
              'h1.break-words',
              '.artdeco-entity-lockup__title',
              '.pv-entity__summary-info h1'
            ];
            return getText(selectors);
          };

          const getHeadline = () => {
            const selectors = [
              '.text-body-medium.break-words',
              '.pv-text-details__left-panel .text-body-medium',
              '.top-card-layout__headline',
              '.pv-top-card--list-bullet .pv-entity__summary-info-v2',
              '.pv-entity__summary-info .pv-entity__summary-info-v2',
              '.artdeco-entity-lockup__subtitle'
            ];
            return getText(selectors);
          };

          const getLocation = () => {
            const selectors = [
              '.text-body-small.inline.t-black--light.break-words',
              '.pv-text-details__left-panel .text-body-small',
              '.pv-top-card--list-bullet .pv-top-card--list-bullet',
              '.artdeco-entity-lockup__caption'
            ];
            return getText(selectors);
          };

          const getCompany = () => {
            const headline = getHeadline();
            if (headline) {
              // Try to extract company from headline
              const patterns = [
                / at (.+?)(?:\s*\||$)/i,
                / @ (.+?)(?:\s*\||$)/i,
                /\bat\s+(.+?)(?:\s*\||$)/i,
                /\b@\s+(.+?)(?:\s*\||$)/i
              ];
              
              for (const pattern of patterns) {
                const match = headline.match(pattern);
                if (match && match[1]) {
                  return match[1].trim();
                }
              }
            }
            
            // Try to find company in experience section
            const companySelectors = [
              '.pv-entity__secondary-title',
              '.pv-experience-section .pv-entity__company-summary-info h3',
              '.experience-item__company'
            ];
            
            return getText(companySelectors);
          };

          const getContactInfo = () => {
            const contactSelectors = [
              'a[href^="mailto:"]',
              '.pv-contact-info__contact-type.ci-email .pv-contact-info__contact-link',
              '.contact-see-more-less .pv-contact-info__contact-type'
            ];
            
            const emails = [];
            contactSelectors.forEach(selector => {
              const elements = document.querySelectorAll(selector);
              elements.forEach(el => {
                const href = el.getAttribute('href');
                const text = el.textContent;
                if (href && href.includes('mailto:')) {
                  emails.push(href.replace('mailto:', ''));
                } else if (text && text.includes('@')) {
                  emails.push(text.trim());
                }
              });
            });
            
            return emails.length > 0 ? emails[0] : null;
          };

          const getProfileImage = () => {
            const imgSelectors = [
              '.pv-top-card__photo img',
              '.profile-photo-edit__preview img',
              '.pv-top-card-profile-picture__image'
            ];
            
            for (const selector of imgSelectors) {
              const img = document.querySelector(selector);
              if (img && img.src) {
                return img.src;
              }
            }
            return null;
          };

          return {
            name: getName(),
            headline: getHeadline(),
            company: getCompany(),
            location: getLocation(),
            email: getContactInfo(),
            profileImage: getProfileImage(),
            profileUrl: window.location.href,
            pageTitle: document.title,
            extractedAt: new Date().toISOString()
          };
        });

        await browser.close();
        
        this.logger.success(`✅ Successfully extracted profile data for: ${profile.name || 'Unknown'}`);
        
        // Clean and validate extracted data
        return this.cleanProfile(profile, linkedinUrl);
        
      } catch (pageError) {
        this.logger.warn('⚠️  Page navigation failed, trying alternative extraction...');
        await browser.close();
        return this.extractFallback(linkedinUrl);
      }
      
    } catch (error) {
      this.logger.error('❌ LinkedIn extraction failed:', error.message);
      this.logger.info('🔄 Falling back to URL-based extraction...');
      return this.extractFallback(linkedinUrl);
    }
  }

  extractOffline() {
    this.logger.info('📴 Using offline mode with demo data');
    return {
      name: 'Ali Aljuffali',
      headline: 'Software Engineer at TechCorp',
      company: 'TechCorp',
      location: 'San Francisco, CA',
      email: null,
      profileUrl: 'offline-mode',
      extractedAt: new Date().toISOString(),
      isOffline: true
    };
  }

  extractFallback(linkedinUrl) {
    this.logger.info('🔄 Using fallback extraction method');
    
    // Extract username from URL
    const urlParts = linkedinUrl.split('/');
    const username = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
    
    // Try to guess name from username
    const guessedName = this.guessNameFromUsername(username);
    
    return {
      name: guessedName,
      headline: 'Professional (extracted from URL)',
      company: 'Unknown',
      location: 'Unknown',
      email: null,
      profileUrl: linkedinUrl,
      username: username,
      extractedAt: new Date().toISOString(),
      isFallback: true
    };
  }

  guessNameFromUsername(username) {
    if (!username) return 'Unknown User';
    
    // Clean username and try to extract name
    const cleaned = username
      .replace(/[-_]/g, ' ')
      .replace(/\d+/g, '')
      .trim();
    
    if (cleaned.length < 2) return 'Unknown User';
    
    return cleaned.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  cleanProfile(profile, originalUrl) {
    const cleaned = {
      name: profile.name || this.guessNameFromUsername(originalUrl.split('/').pop()),
      headline: profile.headline || 'Unknown',
      company: profile.company || 'Unknown',
      location: profile.location || 'Unknown',
      email: profile.email || null,
      profileUrl: profile.profileUrl || originalUrl,
      profileImage: profile.profileImage || null,
      extractedAt: profile.extractedAt || new Date().toISOString(),
      pageTitle: profile.pageTitle || '',
      isComplete: !!(profile.name && profile.headline && profile.company)
    };

    // Log what we extracted
    this.logger.info('📊 Extracted profile data:');
    this.logger.info(`   Name: ${cleaned.name}`);
    this.logger.info(`   Company: ${cleaned.company}`);
    this.logger.info(`   Location: ${cleaned.location}`);
    this.logger.info(`   Email: ${cleaned.email || 'Not found'}`);
    
    return cleaned;
  }
}