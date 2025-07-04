import validator from 'validator';

export class UsernameGenerator {
  constructor() {
    this.commonDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'protonmail.com', 'icloud.com', 'aol.com'
    ];
  }

  generate(target) {
    const aliases = [];
    const name = target.name || '';
    const company = target.company || '';
    
    // Parse name components
    const nameParts = this.parseNameParts(name);
    
    // Generate username variations
    const usernames = this.generateUsernames(nameParts);
    
    // Generate email variations
    const emails = this.generateEmails(nameParts, company);
    
    // Combine all aliases
    aliases.push(...usernames.map(u => ({ type: 'username', value: u })));
    aliases.push(...emails.map(e => ({ type: 'email', value: e })));
    
    // Add social media handles
    const socialHandles = this.generateSocialHandles(nameParts);
    aliases.push(...socialHandles);
    
    return this.deduplicateAliases(aliases);
  }

  parseNameParts(name) {
    const parts = name.toLowerCase().split(' ').filter(p => p.length > 0);
    
    return {
      first: parts[0] || '',
      last: parts[parts.length - 1] || '',
      middle: parts.length > 2 ? parts.slice(1, -1) : [],
      full: parts.join(''),
      initials: parts.map(p => p.charAt(0)).join('')
    };
  }

  generateUsernames(nameParts) {
    const { first, last, initials } = nameParts;
    const usernames = [];

    if (first && last) {
      // Standard combinations
      usernames.push(
        `${first}.${last}`,
        `${first}_${last}`,
        `${first}${last}`,
        `${last}.${first}`,
        `${last}_${first}`,
        `${first}${last.charAt(0)}`,
        `${first.charAt(0)}${last}`,
        `${first.charAt(0)}.${last}`,
        `${initials}`,
        `${first}`,
        `${last}`
      );

      // With numbers (common patterns)
      const numbers = ['1', '123', '2023', '2024', '01', '99'];
      numbers.forEach(num => {
        usernames.push(
          `${first}${last}${num}`,
          `${first}.${last}${num}`,
          `${first}_${last}_${num}`,
          `${first}${num}`,
          `${last}${num}`
        );
      });
    }

    return usernames.filter(u => u.length >= 3);
  }

  generateEmails(nameParts, company) {
    const emails = [];
    const usernames = this.generateUsernames(nameParts);
    
    // Personal email domains
    this.commonDomains.forEach(domain => {
      usernames.slice(0, 10).forEach(username => {
        emails.push(`${username}@${domain}`);
      });
    });

    // Company emails
    if (company && company !== 'Unknown') {
      const companyDomains = this.generateCompanyDomains(company);
      companyDomains.forEach(domain => {
        usernames.slice(0, 5).forEach(username => {
          emails.push(`${username}@${domain}`);
        });
      });
    }

    return emails.filter(email => validator.isEmail(email));
  }

  generateCompanyDomains(company) {
    const domains = [];
    const cleanCompany = company.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/inc|corp|llc|ltd|company|co/g, '');

    if (cleanCompany) {
      domains.push(
        `${cleanCompany}.com`,
        `${cleanCompany}.io`,
        `${cleanCompany}.net`,
        `${cleanCompany}.org`,
        `${cleanCompany}corp.com`,
        `${cleanCompany}inc.com`
      );
    }

    return domains;
  }

  generateSocialHandles(nameParts) {
    const handles = [];
    const usernames = this.generateUsernames(nameParts).slice(0, 10);
    
    const platforms = ['github', 'twitter', 'instagram', 'facebook'];
    
    platforms.forEach(platform => {
      usernames.forEach(username => {
        handles.push({
          type: 'social',
          platform: platform,
          value: username
        });
      });
    });

    return handles;
  }

  deduplicateAliases(aliases) {
    const seen = new Set();
    return aliases.filter(alias => {
      const key = `${alias.type}:${alias.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}