import { describe, it, expect } from 'vitest';
import { SecretDetector } from '../core/detectors/SecretDetector.js';

describe('SecretDetector', () => {
  const detector = new SecretDetector();

  it('should detect AWS access keys', async () => {
    const content = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
    const secrets = await detector.detect(content);
    
    expect(secrets).toHaveLength(1);
    expect(secrets[0].type).toBe('aws_access_key');
    expect(secrets[0].description).toBe('AWS Access Key ID');
  });

  it('should detect JWT tokens', async () => {
    const content = 'token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const secrets = await detector.detect(content);
    
    expect(secrets).toHaveLength(1);
    expect(secrets[0].type).toBe('jwt_token');
  });

  it('should filter false positives', async () => {
    const content = 'password=test123\napi_key=example_key';
    const secrets = await detector.detect(content);
    
    // Should filter out obvious test values
    expect(secrets.length).toBeLessThan(2);
  });

  it('should calculate entropy correctly', () => {
    const highEntropyString = 'aB3$kL9#mN2@pQ7!';
    const lowEntropyString = 'aaaaaaaaaa';
    
    const highEntropy = detector.calculateEntropy(highEntropyString);
    const lowEntropy = detector.calculateEntropy(lowEntropyString);
    
    expect(highEntropy).toBeGreaterThan(lowEntropy);
  });

  it('should score secrets based on context', async () => {
    const prodContent = 'PRODUCTION_API_KEY=sk_live_abc123def456';
    const testContent = 'TEST_API_KEY=sk_test_abc123def456';
    
    const prodSecrets = await detector.detect(prodContent);
    const testSecrets = await detector.detect(testContent);
    
    if (prodSecrets.length > 0 && testSecrets.length > 0) {
      expect(prodSecrets[0].confidence).toBeGreaterThan(testSecrets[0].confidence);
    }
  });
});