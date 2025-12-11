# Transaction Engine Documentation

## Overview
The transaction engine implements a robust, double-entry bookkeeping system with idempotency, async processing, and comprehensive fraud prevention.

## Architecture

### Components

1. **Transaction Service** - Core business logic and validation
2. **Ledger Service** - Double-entry bookkeeping system
3. **Transaction Processor** - Async queue worker using BullMQ
4. **Transaction Controller** - REST API endpoints

### Flow Diagram

```
Client Request → Controller → Service (Validation) → Queue → Processor → Ledger → Wallet Update
                                    ↓
                              Idempotency Check
                                    ↓
                              Lock Management
```

## Features

### 1. Double-Entry Bookkeeping

Every transaction creates balanced ledger entries following accounting principles:

**Example: Deposit $100**
```
Debit:  Bank Clearing Account  +$100 (Asset increases)
Credit: User Wallet             +$100 (Liability increases)
```

**Example: Transfer $50**
```
Debit:  Sender Wallet          -$50
Credit: Receiver Wallet        +$50
```

Account Types:
- **ASSET**: Debits increase, Credits decrease (wallets, bank accounts)
- **LIABILITY**: Credits increase, Debits decrease (user balances we owe)
- **EQUITY**: Credits increase, Debits decrease (capital)
- **REVENUE**: Credits increase, Debits decrease (fees collected)
- **EXPENSE**: Debits increase, Credits decrease (operational costs)

### 2. Idempotency

Every transaction requires a unique `idempotencyKey`:

```typescript
{
  "idempotencyKey": "uuid-or-unique-string",
  "type": "DEPOSIT",
  "amount": 100,
  "currency": "USD"
}
```

Benefits:
- Prevents duplicate transactions
- Safe retries on network failures
- Guarantees exactly-once processing

### 3. Prevent Double-Spending

Multiple mechanisms prevent double-spending:

#### a. Wallet Locks
- Exclusive locks acquired before processing
- Lock duration: 60 seconds
- Automatic cleanup on completion/failure

```typescript
private async acquireLocks(transaction: Transaction): Promise<void> {
  if (this.locks.has(`wallet-${walletId}`)) {
    throw new ConflictException('Wallet is locked');
  }
  this.locks.set(`wallet-${walletId}`, lockData);
}
```

#### b. Balance Validation
- Check balance before transaction
- Re-verify during processing
- Atomic updates

#### c. Ledger Validation
```typescript
// Prevents negative balance in asset accounts
if (account.type === LedgerAccountType.ASSET && newBalance < 0) {
  throw new ConflictException('Insufficient balance');
}
```

### 4. Async Queue Processing (BullMQ + Redis)

Transactions are processed asynchronously for:
- Better performance
- Resilience to failures
- Webhook handling
- External confirmations

```typescript
// Add to queue
await this.transactionQueue.add('process-transaction', {
  transactionId,
});

// Process in worker
@Process('process-transaction')
async handleProcessTransaction(job: Job) {
  await this.transactionsService.processTransaction(job.data.transactionId);
}
```

#### Queue Jobs:
1. **process-transaction** - Main transaction processing
2. **webhook-confirmation** - Handle external webhooks
3. **verify-deposit** - Verify deposit confirmations
4. **verify-withdrawal** - Verify withdrawal execution

### 5. Transaction States

```
PENDING → PROCESSING → COMPLETED
           ↓
         FAILED
         
PENDING → CANCELLED (user action)
COMPLETED → REVERSED (admin action)
```

## API Endpoints

### Create Transaction
```http
POST /api/v1/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "idempotencyKey": "unique-key-123",
  "type": "TRANSFER",
  "assetType": "FIAT",
  "amount": 100.50,
  "currency": "USD",
  "fee": 1.50,
  "fromWalletId": 1,
  "toWalletId": 2,
  "description": "Payment for services"
}
```

Response:
```json
{
  "id": "txn-uuid",
  "idempotencyKey": "unique-key-123",
  "userId": 1,
  "type": "TRANSFER",
  "assetType": "FIAT",
  "amount": 100.50,
  "currency": "USD",
  "fee": 1.50,
  "status": "PENDING",
  "fromWalletId": 1,
  "toWalletId": 2,
  "description": "Payment for services",
  "createdAt": "2025-12-11T10:00:00Z",
  "updatedAt": "2025-12-11T10:00:00Z"
}
```

### Check Transaction Status
```http
GET /api/v1/transactions/{id}/status
Authorization: Bearer <token>
```

Response:
```json
{
  "id": "txn-uuid",
  "status": "COMPLETED",
  "updatedAt": "2025-12-11T10:00:05Z"
}
```

### Cancel Transaction
```http
DELETE /api/v1/transactions/{id}
Authorization: Bearer <token>
```

Response:
```json
{
  "message": "Transaction cancelled successfully",
  "transaction": {
    "id": "txn-uuid",
    "status": "CANCELLED",
    "cancelledAt": "2025-12-11T10:00:10Z"
  }
}
```

### Get My Transactions
```http
GET /api/v1/transactions/my/transactions
Authorization: Bearer <token>
```

### Check Idempotency
```http
GET /api/v1/transactions/idempotency/{key}
Authorization: Bearer <token>
```

## Transaction Types

### 1. DEPOSIT (FIAT)
External funds entering the system.

```typescript
{
  "type": "DEPOSIT",
  "assetType": "FIAT",
  "amount": 1000,
  "currency": "USD",
  "toWalletId": 1,
  "externalReference": "bank-ref-123"
}
```

Ledger Entries:
```
Debit:  Bank Clearing    $1000
Credit: User Wallet      $1000
```

### 2. DEPOSIT (CRYPTO)
Cryptocurrency deposit from external address.

```typescript
{
  "type": "DEPOSIT",
  "assetType": "CRYPTO",
  "amount": 0.5,
  "currency": "BTC",
  "toWalletId": 1,
  "fromAddress": "bc1q..."
}
```

### 3. WITHDRAWAL (FIAT)
Send fiat to external bank account.

```typescript
{
  "type": "WITHDRAWAL",
  "assetType": "FIAT",
  "amount": 500,
  "currency": "USD",
  "fee": 2.50,
  "fromWalletId": 1,
  "toAddress": "IBAN:..."
}
```

Ledger Entries:
```
Debit:  User Wallet         $500
Credit: Bank Clearing       $500
Debit:  User Wallet         $2.50  (fee)
Credit: Fee Revenue         $2.50
```

### 4. WITHDRAWAL (CRYPTO)
Send cryptocurrency to external address.

```typescript
{
  "type": "WITHDRAWAL",
  "assetType": "CRYPTO",
  "amount": 0.1,
  "currency": "ETH",
  "fee": 0.002,
  "fromWalletId": 1,
  "toAddress": "0x..."
}
```

### 5. TRANSFER
Internal transfer between users.

```typescript
{
  "type": "TRANSFER",
  "assetType": "FIAT",
  "amount": 100,
  "currency": "USD",
  "fee": 0.50,
  "fromWalletId": 1,
  "toWalletId": 2
}
```

Ledger Entries:
```
Debit:  Sender Wallet      $100
Credit: Receiver Wallet    $100
Debit:  Sender Wallet      $0.50  (fee)
Credit: Fee Revenue        $0.50
```

### 6. TRADE
Exchange between currencies/assets.

```typescript
{
  "type": "TRADE",
  "assetType": "CRYPTO",
  "amount": 0.5,
  "currency": "BTC",
  "fromWalletId": 1,
  "toWalletId": 2,
  "metadata": {
    "pair": "BTC/USD",
    "rate": 45000
  }
}
```

## Validation Rules

### Transaction Validation
1. Amount must be positive
2. Wallets must exist
3. Source wallet must belong to user
4. Sufficient balance (amount + fee)
5. Different wallets for transfers
6. Required fields based on type

### Balance Checks
- Before transaction creation
- During lock acquisition
- During ledger entry creation
- Atomic update to prevent race conditions

## Error Handling

### Common Errors

1. **Insufficient Balance**
```json
{
  "statusCode": 409,
  "message": "Insufficient balance. Required: 102.50, Available: 100.00"
}
```

2. **Duplicate Transaction**
Returns existing transaction without creating new one.

3. **Wallet Locked**
```json
{
  "statusCode": 409,
  "message": "Wallet 123 is locked"
}
```

4. **Invalid Transaction State**
```json
{
  "statusCode": 409,
  "message": "Cannot cancel transaction in COMPLETED status"
}
```

## Security Features

### 1. Authentication
All endpoints require valid JWT token.

### 2. Authorization
- Users can only access their own transactions
- Admin/Ops can view all transactions

### 3. Audit Logging
Every transaction logged with:
- User ID
- Transaction type and amount
- Timestamp
- IP address
- Success/failure status

### 4. Rate Limiting
- 10 requests/second
- 100 requests/minute
- 1000 requests/15 minutes

### 5. Input Validation
All DTOs validated using class-validator:
```typescript
@IsNumber()
@Min(0.01)
amount: number;

@IsEnum(TransactionType)
type: TransactionType;
```

## Performance Optimization

### 1. Async Processing
- Immediate response to client
- Background processing in queue
- Non-blocking operations

### 2. Lock Management
- Minimal lock duration
- Automatic cleanup
- Fine-grained locking (per wallet)

### 3. Redis Caching
- Queue management
- Lock storage
- Session management

## Monitoring & Alerts

### Key Metrics
- Transaction volume
- Success rate
- Average processing time
- Queue length
- Failed transactions
- Lock timeouts

### Recommended Alerts
1. Transaction failure rate > 5%
2. Queue backlog > 1000
3. Average processing time > 5 seconds
4. Wallet lock timeout
5. Suspicious activity patterns

## Testing

### Unit Tests
```typescript
describe('TransactionsService', () => {
  it('should prevent double-spending', async () => {
    // Test implementation
  });

  it('should handle idempotency correctly', async () => {
    // Test implementation
  });

  it('should create balanced ledger entries', async () => {
    // Test implementation
  });
});
```

### Integration Tests
- End-to-end transaction flow
- Queue processing
- Concurrent transactions
- Lock contention

### Load Tests
- Concurrent transaction creation
- Queue throughput
- Lock performance under load

## Deployment

### Prerequisites
1. Node.js v18+
2. Redis server
3. PostgreSQL (for production)

### Environment Variables
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Start Services
```bash
# Start Redis
docker run -d -p 6379:6379 redis:alpine

# Start application
npm run start:dev
```

## Future Enhancements

1. **Multi-Currency Support**
   - Real-time exchange rates
   - Automatic currency conversion

2. **Scheduled Transactions**
   - Recurring payments
   - Future-dated transactions

3. **Batch Processing**
   - Bulk transaction creation
   - CSV imports

4. **Advanced Fraud Detection**
   - ML-based anomaly detection
   - Velocity checks
   - Geographic anomalies

5. **Webhooks**
   - Transaction status notifications
   - Custom webhook endpoints

6. **Reconciliation**
   - Automated balance reconciliation
   - Ledger verification
   - Audit reports

## Troubleshooting

### Transaction Stuck in PENDING
- Check queue status
- Verify Redis connection
- Check processor logs

### Lock Timeout
- Increase lock duration
- Optimize transaction processing
- Check for deadlocks

### Balance Mismatch
- Run ledger reconciliation
- Check for failed transactions
- Verify double-entry balance

## Support

For issues or questions:
- Check logs: `npm run logs`
- Redis status: `redis-cli ping`
- Queue dashboard: `http://localhost:3000/admin/queues`
