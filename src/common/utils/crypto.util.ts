import * as crypto from 'crypto';

export class CryptoUtil {
  /**
   * Generate HMAC SHA256 signature
   */
  static hmacSha256(message: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');
  }

  /**
   * Generate HMAC SHA256 signature in base64
   */
  static hmacSha256Base64(message: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('base64');
  }

  /**
   * Generate HMAC SHA512 signature
   */
  static hmacSha512(message: string, secret: string): string {
    return crypto
      .createHmac('sha512', secret)
      .update(message)
      .digest('hex');
  }

  /**
   * Generate query string from object
   */
  static buildQueryString(params: Record<string, any>): string {
    return Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
  }

  /**
   * Generate timestamp in milliseconds
   */
  static getTimestamp(): number {
    return Date.now();
  }

  /**
   * Generate nonce (unique identifier)
   */
  static generateNonce(): string {
    return Date.now().toString() + Math.random().toString(36).substring(7);
  }

  /**
   * Generate random string
   */
  static generateRandomString(length: number): string {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
  }
}
