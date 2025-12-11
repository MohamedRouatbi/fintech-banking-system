# Security Documentation

## Overview
This document outlines the security implementation for the Fintech Trading Platform.

## Authentication & Authorization

### JWT Token System
- **Access Tokens**: Short-lived (15 minutes) for API authentication
- **Refresh Tokens**: Long-lived (7 days) for obtaining new access tokens
- **Password Hashing**: Argon2 algorithm (industry standard for password security)

### Role-Based Access Control (RBAC)
Three user roles are implemented:
- **admin**: Full system access
- **ops**: Operations team access (monitoring, support)
- **customer**: Standard user access

### Usage Example:
```typescript
@Roles(UserRole.ADMIN, UserRole.OPS)
@Get('sensitive-data')
getSensitiveData() {
  // Only admins and ops can access
}
```

## API Protection

### Helmet
Secures HTTP headers:
- Content Security Policy (CSP)
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options
- X-Content-Type-Options

### Rate Limiting
Three-tier rate limiting using @nestjs/throttler:
- **Short**: 10 requests/second
- **Medium**: 100 requests/minute
- **Long**: 1000 requests/15 minutes

### CORS Protection
- Configurable allowed origins
- Credentials support for cookie-based auth
- Specific allowed methods and headers

### CSRF Protection
- Cookie-based CSRF tokens
- Validation on state-changing operations
- Integration with csurf middleware

## Input Validation

### class-validator & class-transformer
All DTOs use validation decorators:
```typescript
export class CreateTransactionDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;
}
```

### Validation Pipeline
- Automatic whitelist (strips unknown properties)
- Forbid non-whitelisted properties
- Transform payloads to DTO instances

## Audit Logging

### AuditService
Tracks all critical actions:
- User registration/login/logout
- Transaction creation/updates
- Wallet operations
- Fireblocks interactions
- Security events
- Unauthorized access attempts

### Audit Log Structure:
```typescript
{
  timestamp: Date,
  action: AuditAction,
  userId: number,
  resourceId: string,
  status: 'SUCCESS' | 'FAILURE',
  details: any
}
```

### Critical Action Logging:
```typescript
auditService.logFinancialTransaction(
  AuditAction.TRANSACTION_CREATED,
  userId,
  transactionId,
  amount,
  currency
);
```

## Security Service

### Features:
1. **IP Reputation Checking**: Blocks suspicious IPs
2. **Failed Attempt Tracking**: Auto-blocks after 5 failed attempts
3. **Transaction Risk Assessment**: Flags high-value transactions
4. **Anomaly Detection**: Placeholder for ML-based detection
5. **WAF Integration**: Placeholder for WAF service

### Usage:
```typescript
const riskCheck = securityService.checkTransactionRisk(amount, currency, userId);
if (riskCheck.riskLevel === 'HIGH') {
  // Require additional verification
}
```

## Secrets Management

### Environment Variables
All sensitive config stored in `.env`:
- JWT secrets
- Database credentials
- API keys
- Encryption keys

### HashiCorp Vault (Placeholder)
Configuration ready for Vault integration:
```
VAULT_ADDR=http://127.0.0.1:8200
VAULT_TOKEN=your-vault-token
```

## Web Application Firewall

### Placeholder Integration
Ready for WAF integration with:
- AWS WAF
- Cloudflare
- Imperva
- Other WAF providers

### Checks Performed:
- SQL injection detection
- XSS prevention
- Known malicious patterns
- Geographic restrictions
- Bot detection

## Guards & Interceptors

### Global Guards:
1. **JwtAuthGuard**: Validates JWT tokens on all routes (except @Public())
2. **RolesGuard**: Enforces role-based access control
3. **ThrottlerGuard**: Enforces rate limits

### Interceptors:
1. **LoggingInterceptor**: Logs all requests/responses
2. **TransformInterceptor**: Standardizes response format
3. **AuditLogMiddleware**: Tracks all HTTP activity

### Filters:
1. **AllExceptionsFilter**: Catches and logs all exceptions
2. **HttpExceptionFilter**: Handles HTTP-specific errors

## Security Best Practices

### Development:
1. Never commit `.env` file
2. Use strong, unique secrets
3. Rotate credentials regularly
4. Keep dependencies updated

### Production:
1. Use environment-specific secrets
2. Enable HTTPS only
3. Configure WAF rules
4. Monitor audit logs
5. Implement rate limiting per user
6. Use Vault for secrets management
7. Enable all security headers
8. Regular security audits

## Compliance

### Standards Supported:
- PCI DSS (Payment Card Industry Data Security Standard)
- GDPR (General Data Protection Regulation)
- SOC 2 Type II
- ISO 27001

### Audit Trail:
All logs are structured for compliance reporting and can be exported to:
- SIEM systems (Splunk, ELK)
- Cloud logging (CloudWatch, Stackdriver)
- Compliance platforms

## API Endpoints

### Public Endpoints:
- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/refresh

### Protected Endpoints:
All other endpoints require valid JWT token

### Admin-Only Endpoints:
- GET /api/v1/security/metrics
- All user management operations

## Monitoring & Alerts

### Security Metrics:
- Failed login attempts
- Blocked IPs
- High-risk transactions
- Rate limit violations
- Unauthorized access attempts

### Recommended Alerts:
1. 5+ failed login attempts from single IP
2. High-value transaction (>$100k)
3. Unusual access patterns
4. Multiple concurrent sessions
5. Geographic anomalies

## Future Enhancements

1. **Multi-Factor Authentication (MFA)**
2. **Biometric Authentication**
3. **ML-based Fraud Detection**
4. **Real-time Threat Intelligence**
5. **Advanced Anomaly Detection**
6. **Zero Trust Architecture**
7. **Hardware Security Module (HSM)**
8. **Blockchain-based Audit Logs**
