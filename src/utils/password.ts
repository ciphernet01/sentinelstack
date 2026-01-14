import * as crypto from 'crypto';

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export class PasswordValidator {
  private static readonly MIN_LENGTH = 8;
  private static readonly MAX_LENGTH = 128;

  static validate(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (!password || password.length < this.MIN_LENGTH) {
      errors.push(`Password must be at least ${this.MIN_LENGTH} characters long.`);
    }

    if (password.length > this.MAX_LENGTH) {
      errors.push(`Password must not exceed ${this.MAX_LENGTH} characters.`);
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter.');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter.');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number.');
    }

    if (!/[@$!%*?&#^()_+=\-\[\]{}|\\:;"'<>,.~`]/.test(password)) {
      errors.push('Password must contain at least one special character.');
    }

    // Check for common weak patterns
    const weakPatterns = [
      /^(password|admin|user|test|qwerty|123456)/i,
      /(.)\1{2,}/, // Repeated characters (e.g., 'aaa')
    ];

    for (const pattern of weakPatterns) {
      if (pattern.test(password)) {
        errors.push('Password contains commonly used patterns. Please choose a stronger password.');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static hashPassword(password: string): string {
    // Hash the password for storage in passwordHistory
    // Firebase handles actual password hashing, this is just for comparison
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  static checkPasswordHistory(password: string, passwordHistory: string[]): boolean {
    const hashedPassword = this.hashPassword(password);
    return passwordHistory.includes(hashedPassword);
  }

  static getPasswordStrength(password: string): { score: number; label: string } {
    let score = 0;

    // Length score
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Complexity score
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[@$!%*?&#^()_+=\-\[\]{}|\\:;"'<>,.~`]/.test(password)) score += 1;

    // Entropy bonus
    const uniqueChars = new Set(password).size;
    if (uniqueChars > password.length * 0.6) score += 1;

    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const index = Math.min(Math.floor((score / 8) * labels.length), labels.length - 1);

    return { score, label: labels[index] };
  }
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function generateTokenWithExpiry(hoursValid: number = 1): { token: string; expiry: Date } {
  const token = generateSecureToken();
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hoursValid);
  return { token, expiry };
}
