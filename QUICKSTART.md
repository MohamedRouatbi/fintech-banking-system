# Quick Start Guide

## Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL (optional, using in-memory storage by default)

## Installation

1. **Clone the repository**
```bash
git clone https://github.com/MohamedRouatbi/fintech-banking-system.git
cd fintech-banking-system
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
```

Edit `.env` and set your secrets:
```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
```

4. **Run the application**
```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3000/api/v1`

## First Steps

### 1. Register a User
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

Response:
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["customer"]
  },
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc..."
}
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }'
```

### 3. Access Protected Endpoints
Use the `access_token` from login response:

```bash
curl -X GET http://localhost:3000/api/v1/users/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Refresh Token
When access token expires (15 minutes):

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "YOUR_REFRESH_TOKEN"
  }'
```

## Testing Security Features

### Rate Limiting
Try making more than 10 requests per second:
```bash
for i in {1..15}; do
  curl http://localhost:3000/api/v1/auth/login &
done
```

You should receive a `429 Too Many Requests` error.

### Role-Based Access
Try accessing admin endpoints without admin role:
```bash
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer CUSTOMER_TOKEN"
```

You should receive a `403 Forbidden` error.

### Audit Logs
Check console for audit logs:
```
[AuditTrail] {"timestamp":"2025-12-11T...","action":"USER_LOGIN","userId":1,"status":"SUCCESS"}
```

## Development

### Run tests
```bash
npm run test
```

### Format code
```bash
npm run format
```

### Lint code
```bash
npm run lint
```

## Production Deployment

1. **Set strong secrets in environment**
2. **Enable HTTPS**
3. **Configure CORS for your domain**
4. **Set up database (PostgreSQL)**
5. **Enable WAF protection**
6. **Set up log aggregation**
7. **Configure Vault for secrets management**
8. **Enable monitoring and alerts**

## Troubleshooting

### "Cannot find module" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### JWT errors
Check that `JWT_SECRET` and `JWT_REFRESH_SECRET` are set in `.env`

### Rate limiting issues
Adjust throttle settings in `.env`:
```env
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

## Next Steps

1. Read [SECURITY.md](./SECURITY.md) for security details
2. Review [API documentation](#) (add Swagger in production)
3. Set up monitoring and alerting
4. Configure database persistence
5. Add more security features as needed

## Support

For issues, please open a GitHub issue or contact the development team.
