import { describe, it, expect } from 'vitest';
import { UsernameGenerator } from '../core/generators/UsernameGenerator.js';

describe('UsernameGenerator', () => {
  const generator = new UsernameGenerator();

  it('should generate usernames from full name', () => {
    const target = {
      name: 'John Doe',
      company: 'TechCorp'
    };
    
    const aliases = generator.generate(target);
    const usernames = aliases.filter(a => a.type === 'username').map(a => a.value);
    
    expect(usernames).toContain('john.doe');
    expect(usernames).toContain('john_doe');
    expect(usernames).toContain('johndoe');
    expect(usernames).toContain('jdoe');
  });

  it('should generate email addresses', () => {
    const target = {
      name: 'Jane Smith',
      company: 'Example Corp'
    };
    
    const aliases = generator.generate(target);
    const emails = aliases.filter(a => a.type === 'email').map(a => a.value);
    
    expect(emails.some(email => email.includes('jane.smith@gmail.com'))).toBe(true);
    expect(emails.some(email => email.includes('@examplecorp.com'))).toBe(true);
  });

  it('should generate social media handles', () => {
    const target = {
      name: 'Bob Johnson'
    };
    
    const aliases = generator.generate(target);
    const socialHandles = aliases.filter(a => a.type === 'social');
    
    expect(socialHandles.length).toBeGreaterThan(0);
    expect(socialHandles.some(h => h.platform === 'github')).toBe(true);
    expect(socialHandles.some(h => h.platform === 'twitter')).toBe(true);
  });

  it('should deduplicate aliases', () => {
    const target = {
      name: 'Test User'
    };
    
    const aliases = generator.generate(target);
    const values = aliases.map(a => `${a.type}:${a.value}`);
    const uniqueValues = [...new Set(values)];
    
    expect(values.length).toBe(uniqueValues.length);
  });

  it('should handle single names', () => {
    const target = {
      name: 'Madonna'
    };
    
    const aliases = generator.generate(target);
    const usernames = aliases.filter(a => a.type === 'username').map(a => a.value);
    
    expect(usernames).toContain('madonna');
    expect(usernames.length).toBeGreaterThan(1);
  });
});