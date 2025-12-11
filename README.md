# Fintech Trading Platform

Enterprise-grade NestJS backend for a fintech trading platform with comprehensive security, wallet management, transactions, and Fireblocks integration.

## Features

- 🔐 **Authentication & Authorization**
  - JWT access + refresh tokens
  - Argon2 password hashing
  - Role-Based Access Control (RBAC)
  - Multi-factor authentication ready
  
- 🛡️ **Security Layer**
  - Helmet for HTTP security headers
  - Rate limiting & throttling
  - CORS & CSRF protection
  - Audit trail logging
  - Web Application Firewall integration placeholder
  - Input validation with class-validator
  
- 👥 **User Management**
  - User CRUD operations
  - Role management (admin, customer, ops)
  - Secure password handling
  
- 💰 **Wallet Management**
  - Multi-currency support
  - Balance tracking
  - Transaction history
  
- 📊 **Transaction Processing**
  - Deposit, withdrawal, transfer, trade
  - Status tracking
  - Audit logging
  
- 🔗 **Broker Integration**
  - Multi-broker support
  - Order execution
  - Market data
  
- 🔥 **Fireblocks Integration**
  - Vault management
  - Asset tracking
  - Secure transactions

## Installation

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env`
```bash
cp .env.example .env
```

2. Update the environment variables with your configuration:

### Critical Security Variables:
- `JWT_SECRET` - Strong secret for access tokens
- `JWT_REFRESH_SECRET` - Strong secret for refresh tokens
- `SESSION_SECRET` - Session encryption key
- `ENCRYPTION_KEY` - 32-character encryption key

### Database Configuration:
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`

### API Keys:
- `FIREBLOCKS_API_KEY` - Fireblocks integration
- `FIREBLOCKS_SECRET_KEY` - Fireblocks secret

### Security Settings:
- `CORS_ORIGIN` - Allowed origins for CORS
- `THROTTLE_TTL` - Rate limit window
- `THROTTLE_LIMIT` - Max requests per window

## Running the app

```bash
# development
npm run start:dev

# production mode
npm run start:prod
```

## Test

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

## Project Structure

```
src/
├── modules/
│   ├── auth/               # JWT authentication, refresh tokens
│   │   ├── strategies/     # Passport JWT strategies
│   │   └── dto/            # Login, register, refresh DTOs
│   ├── users/              # User management with RBAC
│   ├── transactions/       # Transaction processing
│   ├── wallets/            # Wallet management
│   ├── brokers/            # Multi-broker integration
│   ├── fireblocks/         # Fireblocks integration
│   └── security/           # Security service & metrics
├── common/
│   ├── guards/             # JWT, Roles, Refresh token guards
│   ├── interceptors/       # Logging, Transform
│   ├── filters/            # Exception handling
│   ├── decorators/         # Custom decorators (Roles, Public, CurrentUser)
│   ├── middleware/         # Audit log middleware
│   ├── services/           # Audit service
│   └── interfaces/         # Shared interfaces
├── config/                 # Configuration files
└── main.ts                 # Application bootstrap with security setup
```

## Security Features

### Authentication
- **JWT Tokens**: Access (15min) + Refresh (7d) tokens
- **Password Hashing**: Argon2 (industry standard)
- **Token Refresh**: Secure refresh token rotation
- **Public Routes**: `@Public()` decorator for public endpoints

### Authorization
- **RBAC**: Three roles (admin, customer, ops)
- **Guards**: `@Roles()` decorator for role-based access
- **User Context**: `@CurrentUser()` decorator for current user

### API Protection
- **Helmet**: Security headers (CSP, HSTS, etc.)
- **Rate Limiting**: 10/sec, 100/min, 1000/15min
- **CORS**: Configurable origins and methods
- **CSRF**: Token-based protection (placeholder)
- **Input Validation**: class-validator on all DTOs

### Audit Logging
- All critical actions logged
- Financial transaction tracking
- Security event monitoring
- Failed authentication attempts
- Structured logs for compliance

### WAF Integration
- Placeholder for WAF service integration
- SQL injection detection ready
- XSS prevention ready
- Bot detection ready

See [SECURITY.md](./SECURITY.md) for detailed security documentation.

## API Endpoints

### Public Endpoints
```
POST /api/v1/auth/register  - Register new user
POST /api/v1/auth/login     - Login user
POST /api/v1/auth/refresh   - Refresh access token
```

### Protected Endpoints (Requires JWT)
```
POST /api/v1/auth/logout           - Logout user
GET  /api/v1/users                 - List users (admin/ops only)
GET  /api/v1/users/:id             - Get user details
PATCH /api/v1/users/:id            - Update user
DELETE /api/v1/users/:id           - Delete user (admin only)

GET  /api/v1/wallets               - List wallets
POST /api/v1/wallets               - Create wallet
GET  /api/v1/wallets/:id           - Get wallet
PATCH /api/v1/wallets/:id/balance  - Update balance
PATCH /api/v1/wallets/:id/status   - Update status

GET  /api/v1/transactions          - List transactions
POST /api/v1/transactions          - Create transaction
GET  /api/v1/transactions/:id      - Get transaction
PATCH /api/v1/transactions/:id/status - Update status

GET  /api/v1/security/metrics      - Security metrics (admin/ops only)
```

## Default User Roles

- **admin**: Full system access, user management
- **ops**: Operations access, monitoring, support
- **customer**: Standard user access, own resources only
