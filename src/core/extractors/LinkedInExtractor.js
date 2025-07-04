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
        headless: process.env.BROWSER_HEADLESS !== 'false',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--disable-extensions'
        ]
      });
      
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });
      
      const page = await context.newPage();
      
      // Add stealth measures
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // Remove automation indicators
        delete window.chrome.runtime;
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
      });
      
      this.logger.info(`📱 Navigating to: ${linkedinUrl}`);
      
      try {
        await page.goto(linkedinUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: parseInt(process.env.BROWSER_TIMEOUT) || 30000
        });
        
        // Wait for page to load and check for content
        await page.waitForTimeout(3000);
        
        // Check if we're blocked or redirected
        const currentUrl = page.url();
        this.logger.info(`Current URL: ${currentUrl}`);
        
        if (currentUrl.includes('authwall') || currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
          this.logger.warn('⚠️  LinkedIn requires login - attempting public data extraction');
        }
        
        // Try to extract whatever we can see
        const profile = await this.extractProfileData(page);
        
        await browser.close();
        
        if (profile.name || profile.headline) {
          this.logger.success(`✅ Successfully extracted profile data for: ${profile.name || 'Profile'}`);
        } else {
          this.logger.warn('⚠️  Limited data extracted - profile may be private');
        }
        
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

  async extractProfileData(page) {
    return await page.evaluate(() => {
      const getText = (selectors) => {
        for (const selector of selectors) {
          try {
            const element = document.querySelector(selector);
            if (element && element.textContent && element.textContent.trim()) {
              return element.textContent.trim();
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        return null;
      };

      const getName = () => {
        const selectors = [
          // New LinkedIn selectors (2024)
          'h1[data-anonymize="person-name"]',
          '.text-heading-xlarge.inline.t-24.v-align-middle.break-words',
          '.pv-text-details__left-panel h1',
          '.top-card-layout__title',
          
          // Legacy selectors
          'h1.text-heading-xlarge',
          '.pv-top-card--list li:first-child',
          'h1.break-words',
          '.artdeco-entity-lockup__title',
          '.pv-entity__summary-info h1',
          '.pv-top-card__name',
          '.profile-topcard__name',
          '.top-card-layout__entity-info h1',
          '.pv-top-card-v2__entity-name',
          'h1.top-card-layout__title',
          
          // Additional fallback selectors
          '.pv-top-card-profile-picture__container + div h1',
          '.ph5.pb5 h1',
          '.pv-profile-section h1'
        ];
        return getText(selectors);
      };

      const getHeadline = () => {
        const selectors = [
          // New LinkedIn selectors (2024)
          '.text-body-medium.break-words[data-anonymize="headline"]',
          '.pv-text-details__left-panel .text-body-medium.break-words',
          '.top-card-layout__headline .break-words',
          
          // Legacy selectors
          '.text-body-medium.break-words',
          '.top-card-layout__headline',
          '.pv-top-card--list-bullet .pv-entity__summary-info-v2',
          '.pv-entity__summary-info .pv-entity__summary-info-v2',
          '.artdeco-entity-lockup__subtitle',
          '.pv-top-card__headline',
          '.profile-topcard__headline',
          '.pv-top-card-v2__headline',
          
          // Additional fallback selectors
          '.pv-top-card-profile-picture__container + div .text-body-medium',
          '.ph5.pb5 .text-body-medium'
        ];
        return getText(selectors);
      };

      const getLocation = () => {
        const selectors = [
          // New LinkedIn selectors (2024)
          '.text-body-small.inline.t-black--light.break-words[data-anonymize="location"]',
          '.pv-text-details__left-panel .text-body-small.inline',
          
          // Legacy selectors
          '.text-body-small.inline.t-black--light.break-words',
          '.pv-top-card--list-bullet .pv-top-card--list-bullet',
          '.artdeco-entity-lockup__caption',
          '.pv-top-card__location',
          '.profile-topcard__location',
          '.top-card-layout__first-subline',
          '.pv-top-card-v2__location',
          
          // Additional fallback selectors
          '.pv-top-card-profile-picture__container + div .text-body-small',
          '.ph5.pb5 .text-body-small'
        ];
        return getText(selectors);
      };

      const getCompany = () => {
        const headline = getHeadline();
        if (headline) {
          // Try to extract company from headline using various patterns
          const patterns = [
            / at (.+?)(?:\s*\||$)/i,
            / @ (.+?)(?:\s*\||$)/i,
            /\bat\s+(.+?)(?:\s*\||$)/i,
            /\b@\s+(.+?)(?:\s*\||$)/i,
            /,\s*(.+?)(?:\s*\||$)/i
          ];
          
          for (const pattern of patterns) {
            const match = headline.match(pattern);
            if (match && match[1] && match[1].trim().length > 1) {
              return match[1].trim();
            }
          }
        }
        
        // Try to find company in experience section or other areas
        const companySelectors = [
          '.pv-entity__secondary-title',
          '.pv-experience-section .pv-entity__company-summary-info h3',
          '.experience-item__company',
          '.pv-entity__company-summary-info-v2',
          '.artdeco-entity-lockup__subtitle span[aria-hidden="true"]'
        ];
        
        return getText(companySelectors);
      };

      const getContactInfo = () => {
        const contactSelectors = [
          'a[href^="mailto:"]',
          '.pv-contact-info__contact-type.ci-email .pv-contact-info__contact-link',
          '.contact-see-more-less .pv-contact-info__contact-type',
          '.pv-contact-info__ci-container a[href*="mailto"]'
        ];
        
        const emails = [];
        contactSelectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              const href = el.getAttribute('href');
              const text = el.textContent;
              if (href && href.includes('mailto:')) {
                emails.push(href.replace('mailto:', ''));
              } else if (text && text.includes('@') && text.includes('.')) {
                emails.push(text.trim());
              }
            });
          } catch (e) {
            // Continue
          }
        });
        
        return emails.length > 0 ? emails[0] : null;
      };

      const getProfileImage = () => {
        const imgSelectors = [
          '.pv-top-card__photo img',
          '.profile-photo-edit__preview img',
          '.pv-top-card-profile-picture__image',
          '.profile-topcard__photo img',
          '.pv-top-card-v2__photo img'
        ];
        
        for (const selector of imgSelectors) {
          try {
            const img = document.querySelector(selector);
            if (img && img.src && !img.src.includes('data:')) {
              return img.src;
            }
          } catch (e) {
            // Continue
          }
        }
        return null;
      };

      const getAbout = () => {
        const aboutSelectors = [
          '.pv-about__summary-text',
          '.pv-about-section .pv-about__summary-text',
          '.artdeco-card .pv-about__summary-text',
          '.about-section .pv-about__summary-text'
        ];
        return getText(aboutSelectors);
      };

      const getExperience = () => {
        const experiences = [];
        try {
          const experienceItems = document.querySelectorAll('.pv-experience-section .pv-entity__summary-info, .experience-item');
          experienceItems.forEach((item, index) => {
            if (index < 3) { // Limit to first 3 experiences
              const title = item.querySelector('h3, .pv-entity__summary-info-v2')?.textContent?.trim();
              const company = item.querySelector('.pv-entity__secondary-title, .pv-entity__company-summary-info')?.textContent?.trim();
              if (title) {
                experiences.push({ title, company: company || 'Unknown' });
              }
            }
          });
        } catch (e) {
          // Continue
        }
        return experiences;
      };

      const getEducation = () => {
        const education = [];
        try {
          const educationItems = document.querySelectorAll('.pv-education-section .pv-entity__summary-info, .education-item');
          educationItems.forEach((item, index) => {
            if (index < 2) { // Limit to first 2 education entries
              const school = item.querySelector('h3, .pv-entity__school-name')?.textContent?.trim();
              const degree = item.querySelector('.pv-entity__secondary-title, .pv-entity__degree-name')?.textContent?.trim();
              if (school) {
                education.push({ school, degree: degree || 'Unknown' });
              }
            }
          });
        } catch (e) {
          // Continue
        }
        return education;
      };

      const getSkills = () => {
        const skills = [];
        try {
          const skillItems = document.querySelectorAll('.pv-skill-category-entity__name, .skill-item');
          skillItems.forEach((item, index) => {
            if (index < 10) { // Limit to first 10 skills
              const skill = item.textContent?.trim();
              if (skill && skill.length > 1) {
                skills.push(skill);
              }
            }
          });
        } catch (e) {
          // Continue
        }
        return skills;
      };

      return {
        name: getName(),
        headline: getHeadline(),
        company: getCompany(),
        location: getLocation(),
        email: getContactInfo(),
        profileImage: getProfileImage(),
        about: getAbout(),
        experience: getExperience(),
        education: getEducation(),
        skills: getSkills(),
        profileUrl: window.location.href,
        pageTitle: document.title,
        extractedAt: new Date().toISOString()
      };
    });
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
      about: profile.about || null,
      experience: profile.experience || [],
      education: profile.education || [],
      skills: profile.skills || [],
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
    this.logger.info(`   Experience: ${cleaned.experience.length} entries`);
    this.logger.info(`   Education: ${cleaned.education.length} entries`);
    this.logger.info(`   Skills: ${cleaned.skills.length} skills`);
    
    return cleaned;
  }
}