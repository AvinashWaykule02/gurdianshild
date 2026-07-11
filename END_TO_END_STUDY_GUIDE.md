# GuardianShield — End-to-End Study Guide

A complete walkthrough of the GuardianShield backend: folder structure, data flows, workers, real-time events, and how to test everything locally.

Use this document to study the codebase in order. Each section builds on the previous one.

---

## Table of Contents

1. [What This System Does](#1-what-this-system-does)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Folder Structure (Complete)](#3-folder-structure-complete)
4. [Study Order — Read Files in This Sequence](#4-study-order--read-files-in-this-sequence)
5. [Startup & Request Lifecycle](#5-startup--request-lifecycle)
6. [Authentication Flow](#6-authentication-flow)
7. [Transaction & Audit Pipeline](#7-transaction--audit-pipeline)
8. [Verification & Tamper Detection](#8-verification--tamper-detection)
9. [Incident & Repair Flow](#9-incident--repair-flow)
10. [Real-Time Events (Socket.IO)](#10-real-time-events-socketio)
11. [Database Schema Reference](#11-database-schema-reference)
12. [API Reference](#12-api-reference)
13. [Workers & Queues](#13-workers--queues)
14. [Environment Variables](#14-environment-variables)
15. [Local Setup](#15-local-setup)
16. [End-to-End Test Walkthrough](#16-end-to-end-test-walkthrough)
17. [Role & Permission Matrix](#17-role--permission-matrix)
18. [Event Catalog](#18-event-catalog)

---

## 1. What This System Does

GuardianShield is a **tamper-evident financial ledger**. Every transaction is:

1. Stored in PostgreSQL
2. Hashed into a per-user cryptographic chain (`SecurityLog`)
3. Backed up to AWS S3 (immutable source of truth)
4. Verified periodically for tampering
5. Repaired from S3 when corruption is detected and approved

Real-time updates are pushed to connected clients via **Socket.IO** when key events happen (transaction created, tamper detected, repair progress, etc.).

---

## 2. High-Level Architecture

```mermaid
flowchart TB
    subgraph Client
        FE[Frontend / API Client]
        SOCK[Socket.IO Client]
    end

    subgraph Express["Express API (app.js)"]
        AUTH[Auth Middleware]
        RBAC[RBAC Middleware]
        LEDGER[Ledger Middleware]
        CTRL[Controllers]
    end

    subgraph Data
        PG[(PostgreSQL / Prisma)]
        S3[(AWS S3)]
        REDIS[(Redis / BullMQ)]
    end

    subgraph Workers
        AW[auditWorker]
        VW[verificationWorker]
        RW[repairWorker]
    end

    subgraph Realtime
        BUS[ledgerEventBus]
        SOCK_SRV[socketServer]
    end

    FE -->|REST + JWT cookie| Express
    SOCK -->|JWT in handshake| SOCK_SRV

    CTRL --> PG
    CTRL --> BUS
    AW --> PG
    AW --> S3
    AW --> BUS
    VW --> PG
    VW --> BUS
    RW --> PG
    RW --> S3
    RW --> BUS

    REDIS --> AW
    REDIS --> VW
    REDIS --> RW

    BUS --> SOCK_SRV
    SOCK_SRV --> SOCK
    BUS -->|persist| PG
```

### Core design patterns

| Pattern | Where | Why |
|---------|-------|-----|
| **Transactional Outbox** | `transactionService.js` | Transaction + audit event created atomically; async worker processes later |
| **Hash Chain** | `auditWorker.js`, `generateHash.js` | Each log links to previous hash — tampering breaks the chain |
| **S3 as Source of Truth** | `s3BackupService.js`, `repairService.js` | Immutable backups used for verification and recovery |
| **Event Bus** | `ledgerEventBus.js` | Decouples business logic from Socket.IO; persists to `EventLog` |
| **BullMQ Workers** | `workers/*.js` | Reliable background processing with retries |

---

## 3. Folder Structure (Complete)

```
gurdianshild/
├── README.md                          ← Project entry + quick start
├── END_TO_END_STUDY_GUIDE.md          ← Full architecture & study guide
│
├── frontend/
│   └── socketService.js               ← Simple Socket.IO client wrapper
│
└── backend/
    ├── server.js                      ← Entry point: Prisma → HTTP → Socket.IO → cron
    ├── app.js                         ← Express app, routes, worker auto-start
    ├── package.json
    │
    ├── prisma/
    │   └── schema.prisma              ← All DB models (User, Transaction, Incident, etc.)
    │
    ├── config/
    │   ├── prisma.js                  ← Prisma client singleton
    │   ├── redis.js                   ← Redis connection for BullMQ
    │   └── s3.js                      ← AWS S3 client
    │
    ├── controllers/                   ← HTTP handlers (thin — delegate to services)
    │   ├── authController.js          ← signup, login, logout, profile
    │   ├── transactionController.js   ← create / list transactions
    │   ├── securityController.js      ← verify hash chain, audit log view
    │   ├── incidentController.js      ← list / update incidents
    │   └── repairController.js        ← trigger repair job
    │
    ├── services/                      ← Business logic
    │   ├── transactionService.js      ← Atomic transaction + outbox create
    │   ├── outboxPublisher.js         ← Poll PENDING outbox → BullMQ
    │   ├── s3BackupService.js         ← Build + upload S3 backup payload
    │   ├── repairService.js           ← S3-driven ledger repair
    │   ├── incidentService.js         ← Incident CRUD
    │   └── socketEventService.js      ← Real-time event emit helpers
    │
    ├── repositories/                  ← Data access layer
    │   ├── s3BackupRepository.js      ← S3 list/get/upload
    │   └── incidentRepository.js      ← Incident DB queries
    │
    ├── algorithams/                   ← Crypto / integrity logic
    │   ├── generateHash.js            ← SHA-256 chained hash
    │   └── verifyHashchain.js         ← Full chain verification + incident creation
    │
    ├── middleware/
    │   ├── authMiddleware.js          ← JWT from cookie → req.user
    │   ├── rbacMiddleware.js          ← Role-based route guard
    │   └── ledgerMiddleware.js        ← Block transactions if ledger LOCKED
    │
    ├── routes/
    │   ├── authRoute.js               ← /api/auth/*
    │   ├── transactionRoute.js        ← /api/transaction/*
    │   ├── securityRoute.js           ← /api/security/*
    │   ├── incidentRoute.js           ← /api/incidents/*
    │   └── repairRoute.js             ← /api/repair/*
    │
    ├── queues/                        ← BullMQ queue definitions
    │   ├── auditQueue.js              ← "audit-queue"
    │   ├── verificationQueue.js       ← "verification-queue"
    │   └── repairQueue.js             ← "repair-queue"
    │
    ├── workers/                       ← BullMQ job processors (auto-started in app.js)
    │   ├── auditWorker.js             ← Hash chain + S3 backup
    │   ├── verificationWorker.js      ← Background verification jobs
    │   └── repairWorker.js            ← Repair job processor
    │
    ├── crone-jobs/
    │   ├── outboxSchedule.js          ← Polls outbox every 4s (started in server.js)
    │   └── scheduleVerification.js    ← Nightly batch verification scheduler
    │
    ├── events/
    │   └── ledgerEventBus.js          ← EventEmitter + EventLog persistence
    │
    └── realtime/
        └── socketServer.js            ← Socket.IO init + event bus bridge
```

---

## 4. Study Order — Read Files in This Sequence

### Phase 1 — Bootstrap (how the server starts)

| # | File | What you learn |
|---|------|----------------|
| 1 | `backend/server.js` | Prisma connect → HTTP listen → Socket.IO → outbox cron |
| 2 | `backend/app.js` | Middleware, route mounting, worker auto-require |
| 3 | `backend/prisma/schema.prisma` | All tables and relationships |

### Phase 2 — Auth & security middleware

| # | File | What you learn |
|---|------|----------------|
| 4 | `backend/controllers/authController.js` | JWT creation, cookie + token in response |
| 5 | `backend/middleware/authMiddleware.js` | Cookie JWT → `req.user = { userId, role }` |
| 6 | `backend/middleware/rbacMiddleware.js` | Role checks for repair/incident approval |
| 7 | `backend/middleware/ledgerMiddleware.js` | Blocks transactions when ledger is LOCKED |

### Phase 3 — Transaction pipeline

| # | File | What you learn |
|---|------|----------------|
| 8 | `backend/routes/transactionRoute.js` | Route → middleware chain |
| 9 | `backend/controllers/transactionController.js` | Validation + service call + socket emit |
| 10 | `backend/services/transactionService.js` | Atomic `Transaction` + `AuditOutbox` create |
| 11 | `backend/crone-jobs/outboxSchedule.js` | 4-second polling loop |
| 12 | `backend/services/outboxPublisher.js` | PENDING → PROCESSING → BullMQ enqueue |
| 13 | `backend/queues/auditQueue.js` | Queue config |
| 14 | `backend/workers/auditWorker.js` | Hash chain + S3 + outbox PROCESSED |
| 15 | `backend/algorithams/generateHash.js` | Hash algorithm |
| 16 | `backend/services/s3BackupService.js` | S3 backup payload |
| 17 | `backend/repositories/s3BackupRepository.js` | S3 key format + upload |

### Phase 4 — Verification & incidents

| # | File | What you learn |
|---|------|----------------|
| 18 | `backend/algorithams/verifyHashchain.js` | Chain scan, tamper detect, incident + lock |
| 19 | `backend/controllers/securityController.js` | HTTP trigger for verification |
| 20 | `backend/workers/verificationWorker.js` | Background verification via BullMQ |
| 21 | `backend/crone-jobs/scheduleVerification.js` | Batch schedule all users |
| 22 | `backend/controllers/incidentController.js` | List/update incidents |
| 23 | `backend/services/incidentService.js` | Incident business logic |
| 24 | `backend/repositories/incidentRepository.js` | DB queries |

### Phase 5 — Repair engine

| # | File | What you learn |
|---|------|----------------|
| 25 | `backend/controllers/repairController.js` | Queue repair after APPROVED incident |
| 26 | `backend/workers/repairWorker.js` | BullMQ repair job runner |
| 27 | `backend/services/repairService.js` | S3 fetch → restore chain → unlock ledger |

### Phase 6 — Real-time layer

| # | File | What you learn |
|---|------|----------------|
| 28 | `backend/events/ledgerEventBus.js` | Central event bus + EventLog persistence |
| 29 | `backend/services/socketEventService.js` | Helper functions to emit events |
| 30 | `backend/realtime/socketServer.js` | Socket.IO + room routing |
| 31 | `frontend/socketService.js` | Client connection |

---

## 5. Startup & Request Lifecycle

### Server boot sequence (`server.js`)

```
1. dotenv loads environment variables
2. prisma.$connect()           → PostgreSQL ready
3. app.listen(PORT)            → HTTP server starts
4. initSocketServer(server)    → Socket.IO attached to same HTTP server
5. outboxSchedule.start()      → Polls AuditOutbox every 4 seconds
```

Workers start when `app.js` is required (before listen):

```
require("./workers/auditWorker")
require("./workers/repairWorker")
require("./workers/verificationWorker")
```

### Typical authenticated REST request

```
HTTP Request
  → cors + json + cookieParser
  → authMiddleware (reads req.cookies.token → req.user)
  → [optional] ledgerMiddleware / rbacMiddleware
  → controller
  → service / prisma
  → [optional] socketEventService → ledgerEventBus
  → JSON response
```

---

## 6. Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as /api/auth
    participant DB as PostgreSQL

    C->>API: POST /login { email, password }
    API->>DB: find user by email
    API->>API: bcrypt.compare(password)
    API->>API: jwt.sign({ userId, role })
    API->>C: Set-Cookie: token=... (httpOnly)
    API->>C: { token, user } in JSON body

    Note over C: REST uses cookie automatically
    Note over C: Socket.IO uses token from JSON body

    C->>API: POST /transaction/create (cookie sent)
    API->>API: authMiddleware verifies JWT
    API->>API: req.user = { userId, role }
```

| Concern | Implementation |
|---------|----------------|
| JWT payload | `{ userId, role }` |
| Secret | `process.env.JWT_SECRET` |
| REST auth | Cookie `token` (httpOnly) |
| Socket auth | `handshake.auth.token` or `Authorization: Bearer` |
| Expiry | 7 days |

**Key files:** `authController.js`, `authMiddleware.js`, `authRoute.js`

---

## 7. Transaction & Audit Pipeline

This is the most important flow to understand.

```mermaid
sequenceDiagram
    participant U as User
    participant API as transactionController
    participant SVC as transactionService
    participant DB as PostgreSQL
    participant PUB as outboxPublisher
    participant Q as audit-queue
    participant W as auditWorker
    participant S3 as AWS S3
    participant BUS as ledgerEventBus

    U->>API: POST /api/transaction/create
    API->>SVC: createTransaction(userId, data)
    SVC->>DB: $transaction: Transaction + AuditOutbox (PENDING)
    API->>BUS: TRANSACTION_CREATED
    API->>U: 201 { transaction, outbox }

    loop Every 4 seconds
        PUB->>DB: find PENDING outbox events
        PUB->>Q: add job
    end

    Q->>W: process job
    W->>DB: create SecurityLog + update chain state (idempotent)
    W->>S3: writeTransactionBackup()
    W->>DB: mark outbox PROCESSED
    W->>BUS: AUDIT_COMPLETE
```

### Step-by-step

| Step | Component | Action |
|------|-----------|--------|
| 1 | `ledgerMiddleware` | Reject if user's ledger is LOCKED |
| 2 | `transactionService` | Atomic create: `Transaction` + `AuditOutbox(PENDING)` |
| 3 | `transactionController` | Emit `TRANSACTION_CREATED` via socket |
| 4 | `outboxPublisher` | Poll every 4s, enqueue to `audit-queue` |
| 5 | `auditWorker` | Build hash chain entry (idempotent on retry) |
| 6 | `auditWorker` | Upload backup to S3 (mandatory — job fails if S3 fails) |
| 7 | `auditWorker` | Mark outbox `PROCESSED` only after DB + S3 both succeed |

### Hash chain (per user)

```
Log #1: previousHash=null  → currentHash=hash(txn1, null)
Log #2: previousHash=hash1   → currentHash=hash(txn2, hash1)
Log #3: previousHash=hash2   → currentHash=hash(txn3, hash2)
...
```

Each log also has an **HMAC signature** signed with `JWT_SECRET`.

### S3 backup key format

```
s3://{bucket}/users/{userId}/transactions/{seq padded}-{transactionId}.json
```

---

## 8. Verification & Tamper Detection

```mermaid
flowchart TD
    A[verifyUserHashChain userId] --> B[Load SecurityLogs ordered by sequence]
    B --> C[For each log: recalculate hash]
    C --> D{Hash matches?}
    D -->|No| E[Create Incident]
    D -->|No| F[Lock Ledger LOCKED]
    D -->|No| G[Emit TAMPER_DETECTED]
    D -->|Yes| H[Compare live transaction vs auditData snapshot]
    H --> I[Compare against S3 backup anchor]
    I --> J{All OK?}
    J -->|Yes| K[Continue to next log]
    J -->|No| E
    K --> L{More logs?}
    L -->|Yes| C
    L -->|No| M[Emit VERIFICATION_OK]
```

### Triggers

| Trigger | File |
|---------|------|
| Manual HTTP | `GET /api/security/verify?userId=` |
| Background worker | `verificationWorker.js` consumes `verification-queue` |
| Scheduled batch | `scheduleVerification.js` (cron — enqueue all users) |

### On tamper detection

1. `VerificationRun` record created (status: COMPROMISED)
2. `Incident` created (status: OPEN, severity: HIGH)
3. `LedgerState` set to LOCKED
4. Events: `TAMPER_DETECTED`, `LEDGER_LOCKED`, `INCIDENT_CREATED`
5. User cannot create new transactions (`ledgerMiddleware` blocks)

---

## 9. Incident & Repair Flow

```mermaid
sequenceDiagram
    participant M as Manager (admin)
    participant API as incident/repair API
    participant DB as PostgreSQL
    participant Q as repair-queue
    participant W as repairWorker
    participant S3 as AWS S3
    participant BUS as ledgerEventBus

    M->>API: PATCH /api/incidents/:id/status { status: APPROVED }
    API->>DB: update incident
    API->>BUS: INCIDENT_UPDATED

    M->>API: POST /api/repair/incident { incidentId }
    API->>Q: add repair job
    API->>BUS: REPAIR_STARTED

    Q->>W: process repair
    W->>S3: fetchTransactionHistoryFromS3
    W->>DB: ledger → UNDER_REPAIR
    W->>BUS: LEDGER_LOCKED
    W->>DB: restore transactions + security logs from S3
    W->>DB: ledger → ACTIVE, incident → RESOLVED
    W->>BUS: LEDGER_UNLOCKED
    W->>BUS: REPAIR_COMPLETED
```

### Incident status lifecycle

```
OPEN → UNDER_REVIEW → APPROVED → (repair triggered) → REPAIRING → RESOLVED
                   ↘ REJECTED
```

### Repair rules

- Only `APPROVED` incidents can trigger repair (`repairController.js`)
- Only `admin` and `superadmin` can approve incidents and trigger repair
- Repair restores from S3 — does **not** generate new hashes; restores exact S3 state

---

## 10. Real-Time Events (Socket.IO)

### Architecture (simple)

```
Business code
    → socketEventService.emit*(...)
        → ledgerEventBus.emitEvent(name, payload)
            → 1. EventEmitter.emit (in-process)
            → 2. prisma.eventLog.create (persist)
            → 3. socketServer listener → Socket.IO push
```

### Connection

```javascript
// frontend/socketService.js
const { connectSocket } = require('./socketService');
const socket = connectSocket('http://localhost:5000', loginResponse.token);

socket.on('TRANSACTION_CREATED', (data) => console.log(data));
socket.on('TAMPER_DETECTED', (data) => console.log(data));
socket.on('REPAIR_COMPLETED', (data) => console.log(data));
```

### Room routing (`socketServer.js`)

| Client | Joins room | Receives |
|--------|------------|----------|
| Authenticated user | `user:{userId}` | Events for their userId |
| Admin roles | `admin` | All user-specific events |
| Unauthenticated | (none) | Only system-wide events (no userId) |

### Event payload shape

Every event from `ledgerEventBus` has this structure:

```json
{
  "event": "TRANSACTION_CREATED",
  "timestamp": "2026-06-16T10:00:00.000Z",
  "userId": "42",
  "ledgerId": null,
  "severity": "INFO",
  "message": "Transaction created",
  "meta": { "transactionId": 101, "amount": 500 }
}
```

---

## 11. Database Schema Reference

| Model | Purpose | Key fields |
|-------|---------|------------|
| `User` | Accounts | `id`, `email`, `role` |
| `Transaction` | Financial records | `userId`, `amount`, `description` |
| `AuditOutbox` | Outbox pattern | `transactionId`, `payload`, `status` (PENDING/PROCESSING/PROCESSED/FAILED) |
| `SecurityChainState` | Per-user chain head | `latestSequence`, `latestHash` |
| `SecurityLog` | Hash chain entries | `sequenceNumber`, `previousHash`, `currentHash`, `auditData` |
| `VerificationRun` | Verification audit trail | `status`, `checkedLogs`, `failedLogs` |
| `Incident` | Tamper incidents | `corruptionStartSeq`, `status`, `severity` |
| `LedgerState` | User ledger lock status | `status` (ACTIVE/LOCKED/UNDER_REPAIR) |
| `EventLog` | Real-time event history | `eventName`, `userId`, `message`, `meta` |

### Relationships

```
User 1──* Transaction
User 1──* SecurityLog
User 1──? LedgerState
User 1──* Incident
Transaction 1──* SecurityLog
Incident 1──* LedgerState (via incidentId)
```

---

## 12. API Reference

Base URL: `http://localhost:5000`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Server health check |
| POST | `/api/auth/signup` | No | Register user and return JWT cookie + token |
| POST | `/api/auth/login` | No | Authenticate user and return JWT cookie + token |
| POST | `/api/auth/logout` | Yes | Clear auth cookie and logout user |
| GET | `/api/auth/profile` | Yes | Return authenticated user profile |
| POST | `/api/transaction/create` | Yes | Create a transaction and queue it for audit processing |
| GET | `/api/transaction/:id` | Yes | Get a single transaction by ID for the authenticated user |
| GET | `/api/security/verify` | Yes | Verify user ledger hash chain integrity |
| GET | `/api/security/incidents` | Yes | List security log incidents and audit events |
| GET | `/api/incidents` | Yes | List incident records visible to the user or admin |
| GET | `/api/incidents/:id` | Yes | Get details for a specific incident |
| PATCH | `/api/incidents/:id/status` | Yes | Update incident status |
| POST | `/api/repair/incident` | Yes | Trigger ledger repair for an approved incident |

## 13. Workers & Queues

| Queue name | Worker file | Concurrency | Job data | Purpose |
|------------|-------------|-------------|----------|---------|
| `audit-queue` | `auditWorker.js` | 1 (FIFO) | `{ outboxEventId, transactionId, payload }` | Hash chain + S3 backup |
| `verification-queue` | `verificationWorker.js` | 2 | `{ userId }` | Background verification |
| `repair-queue` | `repairWorker.js` | 1 | `{ incidentId }` | S3-driven ledger repair |

All queues use Redis via `config/redis.js` (default `127.0.0.1:6379`).

### Retry behavior

- **auditWorker**: 3 attempts, exponential backoff. Idempotent — skips DB insert if SecurityLog exists.
- **verificationWorker**: 3 attempts per job.
- **repairWorker**: 3 attempts per job.

### Cron jobs

| Job | File | Started from | Interval |
|-----|------|--------------|----------|
| Outbox publisher | `crone-jobs/outboxSchedule.js` | `server.js` on boot | Every 4 seconds |
| Nightly verification | `crone-jobs/scheduleVerification.js` | Manual / external cron | On demand |

---

## 14. Environment Variables

```env
# Server
PORT=5000
CLIENT_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000

# Auth
JWT_SECRET=your-secret-key

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/guardian_shield"

# Redis (BullMQ)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# AWS S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET_NAME=guardianshield-audit-checkpoints
# S3_ENDPOINT=http://localhost:9000   # optional: MinIO / LocalStack
```

---

## 15. Local Setup

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis
- AWS S3 bucket (or local S3-compatible endpoint)

### Steps

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Configure environment
cp .env.example .env   # or create .env manually (see section 14)

# 3. Run database migrations
npx prisma migrate dev

# 4. Start Redis
redis-server

# 5. Start backend
npm run dev
# Expected logs:
#   ✅ Prisma connected
#   🚀 Server running on port 5000
#   Socket.IO server ready (single namespace)
#   📦 Outbox publisher started
#   🚀 Verification Worker is running...
```

### Verify services

```bash
curl http://localhost:5000/health
# → { "success": true, "message": "Server is running fine 🚀" }
```

---

## 16. End-to-End Test Walkthrough

### Test 1 — Auth

```bash
# Signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}' \
  -c cookies.txt

# Login (save token from response for socket)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt
```

### Test 2 — Create transaction (full audit pipeline)

```bash
curl -X POST http://localhost:5000/api/transaction/create \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"amount":100,"description":"Test payment","type":"DEBIT"}'
```

**Watch server logs for:**
1. `TRANSACTION_CREATED` socket event
2. Outbox publisher enqueues job (~4s)
3. Audit worker: SecurityLog created + S3 backup
4. Outbox marked PROCESSED
5. `AUDIT_COMPLETE` socket event

### Test 3 — Verify hash chain

```bash
curl http://localhost:5000/api/security/verify -b cookies.txt
# → { "integrity": "VERIFIED", "totalChecked": N }
```

### Test 4 — Socket.IO real-time events

```html
<!-- Save as test-socket.html, open in browser -->
<script src="https://cdn.socket.io/4.8.3/socket.io.min.js"></script>
<script>
  const token = "PASTE_TOKEN_FROM_LOGIN_RESPONSE";
  const socket = io("http://localhost:5000", { auth: { token } });

  socket.on("connect", () => console.log("Connected:", socket.id));
  socket.on("TRANSACTION_CREATED", (d) => console.log("TX:", d));
  socket.on("AUDIT_COMPLETE", (d) => console.log("AUDIT COMPLETE:", d));
  socket.on("VERIFICATION_STARTED", (d) => console.log("VERIFY STARTED:", d));
  socket.on("VERIFICATION_OK", (d) => console.log("VERIFY OK:", d));
  socket.on("TAMPER_DETECTED", (d) => console.log("TAMPER:", d));
  socket.on("INCIDENT_CREATED", (d) => console.log("INCIDENT CREATED:", d));
  socket.on("INCIDENT_UPDATED", (d) => console.log("INCIDENT UPDATED:", d));
  socket.on("LEDGER_LOCKED", (d) => console.log("LEDGER LOCKED:", d));
  socket.on("LEDGER_UNLOCKED", (d) => console.log("LEDGER UNLOCKED:", d));
  socket.on("REPAIR_STARTED", (d) => console.log("REPAIR STARTED:", d));
  socket.on("REPAIR_COMPLETED", (d) => console.log("REPAIR:", d));
</script>
```

Then create a transaction in another tab — events should appear in the console.

### Test 5 — Tamper + repair (manual DB tamper)

```sql
-- 1. Create a few transactions via API first
-- 2. Tamper a SecurityLog hash directly in DB:
UPDATE security_log SET current_hash = 'tampered' WHERE sequence_number = 1;

-- 3. Run verification
curl http://localhost:5000/api/security/verify -b cookies.txt
-- → integrity: COMPROMISED, incidents created

-- 4. List incidents
curl http://localhost:5000/api/incidents -b cookies.txt

-- 5. Approve incident (use admin account or update role in DB)
curl -X PATCH http://localhost:5000/api/incidents/1/status \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"status":"APPROVED"}'

-- 6. Trigger repair (requires admin role)
curl -X POST http://localhost:5000/api/repair/incident \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"incidentId":1}'
```

**Watch socket events:** `REPAIR_STARTED` → progress → `REPAIR_COMPLETED` → `LEDGER_UNLOCKED`

---

## 17. Role & Permission Matrix

| Action | user | admin | superadmin |
|--------|------|-------|------------|
| Create transaction | ✅ | ✅ | ✅ |
| View own incidents | ✅ | ✅ | ✅ |
| View all incidents | ❌ | ✅ | ✅ |
| Receive socket events for your user | ✅ | ✅ | ✅ |
| Approve incident | ❌ | ❌ | ✅ |
| Trigger repair | ❌ | ❌ | ✅ |

> Note: This guide simplifies roles to `user`, `admin`, and `superadmin` for clarity.

---

## 18. Event Catalog

| Event | Emitted from | When |
|-------|--------------|------|
| `TRANSACTION_CREATED` | `transactionController` | Transaction saved to DB and outbox created |
| `AUDIT_COMPLETE` | `auditWorker` | Audit pipeline finished successfully |
| `VERIFICATION_STARTED` | `verifyHashchain` | Verification begins |
| `VERIFICATION_OK` | `verifyHashchain` | Chain verified with no tampering |
| `TAMPER_DETECTED` | `verifyHashchain` | Hash or snapshot mismatch detected |
| `INCIDENT_CREATED` | `verifyHashchain` | Incident record created after tampering |
| `INCIDENT_UPDATED` | `incidentController` | Incident status or details updated |
| `LEDGER_LOCKED` | `verifyHashchain` / `repairService` | Ledger moved to locked state |
| `LEDGER_UNLOCKED` | `repairService` | Ledger unlocked after repair |
| `REPAIR_STARTED` | `repairController` | Repair job queued and started |
| `REPAIR_COMPLETED` | `repairService` | Repair finished successfully |

All events are persisted to the `EventLog` table automatically.

---

## Quick Reference — One-Page Flow

```
SIGNUP/LOGIN
  → JWT cookie (REST) + token (Socket)

CREATE TRANSACTION
  → Transaction + AuditOutbox (atomic)
  → SOCKET: TRANSACTION_CREATED
  → Outbox poller (4s) → audit-queue
  → auditWorker: SecurityLog + S3
  → SOCKET: AUDIT_COMPLETE

VERIFY (manual or scheduled)
  → verifyHashchain scans all logs
  → SOCKET: VERIFICATION_STARTED → VERIFICATION_OK
  → If tampered: Incident + LOCKED + SOCKET: TAMPER_DETECTED, INCIDENT_CREATED

APPROVE + REPAIR
  → Manager approves → SOCKET: INCIDENT_UPDATED
  → repair-queue → repairService restores from S3
  → SOCKET: REPAIR_STARTED → ... → REPAIR_COMPLETED → LEDGER_UNLOCKED
```

---
