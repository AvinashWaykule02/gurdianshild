# GuardianShield

GuardianShield is a tamper-evident ledger system built for financial transaction integrity. It combines user-authenticated transaction recording with a cryptographic hash chain, immutable S3-backed audit backups, automated verification, incident tracking, and repair workflows.

## What this project solves

GuardianShield prevents and detects ledger tampering by:

- recording every transaction in a secured audit chain
- anchoring each audit record to the previous one using SHA-256 hashes
- storing immutable backups in S3 for replay and recovery
- validating the chain with a verification engine
- raising incidents and locking the ledger when tampering is detected
- repairing affected transaction history from S3 backups

This makes it suitable for systems where financial ledger integrity, fraud detection, and audit traceability are required.

## Architecture overview

### Core components

- `backend/app.js` - Express application and API route registration
- `backend/server.js` - server startup, Prisma connect/disconnect, and scheduler start
- `backend/config/prisma.js` - Prisma database client
- `backend/config/s3.js` - AWS S3 client configuration
- `backend/config/redis.js` - Redis connection for BullMQ workers

### Main flows

1. **Transaction creation**
   - `POST /api/transaction/create`
   - creates a transaction and an audit outbox record in the same database transaction
   - the outbox entry is queued for downstream audit processing

2. **Audit pipeline**
   - `backend/crone-jobs/outboxSchedule.js` polls pending `auditOutbox` events
   - `backend/workers/auditWorker.js` consumes events from BullMQ
   - worker builds a deterministic audit snapshot, generates hash chain entries, writes `SecurityLog`, and stores a backup to S3
   - only after both DB and S3 succeed does the outbox event move to `PROCESSED`

3. **Verification**
   - `GET /api/security/verify`
   - replays `SecurityLog` entries for a user
   - recomputes hashes and compares transaction snapshots and S3 backup state
   - reports whether the ledger is `VERIFIED` or `COMPROMISED`

4. **Incident management and repair**
   - security incidents are created when tampering is detected
   - `GET /api/incidents` and `GET /api/incidents/:id` expose incident data
   - `PATCH /api/incidents/:id/status` updates incident lifecycle
   - `POST /api/repair/incident` triggers repair for admin/superadmin roles
   - repair service restores ledger state using S3 backup history

### Security and middleware

- `backend/middleware/authMiddleware.js` protects routes using JWT stored in HTTP-only cookies
- `backend/middleware/ledgerMiddleware.js` blocks transaction creation if a user ledger is locked due to integrity issues
- `backend/middleware/rbacMiddleware.js` restricts repair operations to `admin` and `superadmin`

### Real-time socket implementation

- `backend/realtime/socketServer.js` initializes Socket.IO on server startup using `initSocketServer()` from `backend/server.js`
- connected clients authenticate using JWT from `socket.handshake.auth.token` or `Authorization: Bearer <token>`
- authenticated users join `user:<id>` rooms, and admin roles also join a shared `admin` room
- `backend/events/ledgerEventBus.js` emits app-level events that are broadcast over Socket.IO to connected clients
- emitted socket event names include:
  - `TRANSACTION_CREATED`
  - `AUDIT_COMPLETE`
  - `VERIFICATION_STARTED`
  - `VERIFICATION_OK`
  - `TAMPER_DETECTED`
  - `INCIDENT_CREATED`
  - `INCIDENT_UPDATED`
  - `LEDGER_LOCKED`
  - `LEDGER_UNLOCKED`
  - `REPAIR_STARTED`
  - `REPAIR_COMPLETED`

## Folder structure

- `backend/` - main server code
  - `controllers/` - request handlers for auth, transactions, security, incidents, and repair
  - `services/` - business logic and persistence abstractions
  - `routes/` - API routing definitions
  - `workers/` - BullMQ workers for audit, repair, and verification
  - `queues/` - queue definitions
  - `algorithams/` - hash generation and verification logic
  - `config/` - Prisma, Redis, S3 configuration
  - `repositories/` - data access helpers for incidents and S3 backups
  - `validation/` - request validation helpers
  - `tests/` - unit and integration tests
  - `crone-jobs/` - scheduled outbox publisher
  - `realtime/` - optional real-time event helpers

## API endpoints

### Auth routes

- `POST /api/auth/signup`
  - request body: `{ name, email, password }`
  - creates a new user and returns JWT cookie + token

- `POST /api/auth/login`
  - request body: `{ email, password }`
  - authenticates a user and returns JWT cookie + token

- `POST /api/auth/logout`
  - clears auth cookie and logs out user

- `GET /api/auth/profile`
  - returns authenticated user profile

## API endpoint reference

| Method | Path | Description | Protected | Notes |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/signup` | Register a new user, hash password, return JWT cookie and token | No | Body: `{ name, email, password }` |
| POST | `/api/auth/login` | Authenticate user and return JWT cookie and token | No | Body: `{ email, password }` |
| POST | `/api/auth/logout` | Clear auth cookie and logout user | Yes |  |
| GET | `/api/auth/profile` | Return authenticated user profile | Yes |  |
| POST | `/api/transaction/create` | Create a transaction and queue it for audit processing | Yes | Body: `{ amount, description, type }` |
| GET | `/api/transaction/:id` | Get a single transaction by id for the authenticated user | Yes |  |
| GET | `/api/security/verify` | Verify user ledger hash chain integrity | Yes | Optional query: `userId` |
| GET | `/api/security/incidents` | List security log incidents and audit events | Yes | Optional query: `userId` |
| GET | `/api/incidents` | List incident records visible to the current user | Yes |  |
| GET | `/api/incidents/:id` | Get details for a specific incident | Yes |  |
| PATCH | `/api/incidents/:id/status` | Update incident status | Yes | Body: `{ status }` |
| POST | `/api/repair/incident` | Trigger ledger repair for a security incident | Yes | Requires `admin` or `superadmin`; body: `{ incidentId }` |
| GET | `/health` | Check server health | No | Returns `success: true` |

## Environment configuration

Create a `.env` file in `backend/` with the following variables:

- `DATABASE_URL` - Prisma/PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `CLIENT_URL` - optional CORS origin
- `PORT` - optional web server port (default: `5000`)
- `AWS_REGION` - AWS region for S3
- `AWS_ACCESS_KEY_ID` - AWS credentials access key
- `AWS_SECRET_ACCESS_KEY` - AWS credentials secret key
- `S3_BUCKET_NAME` - S3 bucket name for backups (default: `guardianshield`)
- `S3_PREFIX` - backup object prefix (default: `guardianshield/users`)
- `S3_ENDPOINT` - optional custom S3 endpoint for local dev
- `S3_SERVER_SIDE_ENCRYPTION` - optional server-side encryption algorithm

## Prerequisites

- Node.js
- PostgreSQL
- Redis
- AWS S3 or compatible S3 endpoint (MinIO/LocalStack supported)

## Run locally

```bash
cd backend
npm install
# Create or update your Prisma schema in the database
npx prisma migrate dev
# Start Redis in another terminal
redis-server
# Start the server
npm run dev
```

Default app URL: `http://localhost:5000`

## Testing

Run all tests:

```bash
cd backend
npm test
```

Run unit tests only:

```bash
npm run test:unit
```

Run integration tests only:

```bash
npm run test:integration
```

## Notes

- The app uses JWT auth stored in an HTTP-only cookie named `token`
- `ledgerMiddleware` prevents new transactions when a user ledger is locked due to a detected incident
- Audit records are written in a chain using `generateHash`, and verification recomputes those hashes in `verifyHashchain.js`
- Repair uses S3 backup history and rolls back affected transaction/audit records

## Useful quick checks

- Health: `GET http://localhost:5000/health`
- Signup: `POST http://localhost:5000/api/auth/signup` (body: `{ name, email, password }`)
- Login: `POST http://localhost:5000/api/auth/login` (body: `{ email, password }`)
- Logout: `POST http://localhost:5000/api/auth/logout`
- Profile: `GET http://localhost:5000/api/auth/profile`
- Create transaction: `POST http://localhost:5000/api/transaction/create` (body: `{ amount, description, type }`)
- Get transaction: `GET http://localhost:5000/api/transaction/:id`
- Verify ledger: `GET http://localhost:5000/api/security/verify`
- List security incidents: `GET http://localhost:5000/api/security/incidents`
- List incidents: `GET http://localhost:5000/api/incidents`
- Get incident: `GET http://localhost:5000/api/incidents/:id`
- Update incident status: `PATCH http://localhost:5000/api/incidents/:id/status` (body: `{ status }`)
- Trigger repair: `POST http://localhost:5000/api/repair/incident` (body: `{ incidentId }`)
