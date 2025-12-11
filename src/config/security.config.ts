import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRATION || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
  },
  session: {
    secret: process.env.SESSION_SECRET,
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },
  vault: {
    address: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN,
  },
  audit: {
    enabled: process.env.AUDIT_LOG_ENABLED === 'true',
    level: process.env.AUDIT_LOG_LEVEL || 'info',
  },
  waf: {
    enabled: process.env.WAF_ENABLED === 'true',
    provider: process.env.WAF_PROVIDER || 'cloudflare',
    apiKey: process.env.WAF_API_KEY,
  },
}));
