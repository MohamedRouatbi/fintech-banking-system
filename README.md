# Fintech Trading Platform

NestJS backend for a fintech trading platform with wallet management, transactions, and Fireblocks integration.

## Features

- 🔐 Authentication & Authorization
- 👥 User Management
- 💰 Wallet Management
- 📊 Transaction Processing
- 🔗 Broker Integration
- 🔥 Fireblocks Integration

## Installation

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env`
2. Update the environment variables with your configuration

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

- `src/modules/auth` - Authentication and authorization
- `src/modules/users` - User management
- `src/modules/transactions` - Transaction processing
- `src/modules/wallets` - Wallet management
- `src/modules/brokers` - Broker integrations
- `src/modules/fireblocks` - Fireblocks integration
- `src/common` - Shared utilities (guards, interceptors, filters, decorators)
