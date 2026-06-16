

🛡️ GuardianShield

GuardianShield is a tamper-evident financial ledger system ensuring transaction integrity using cryptographic hash chains, immutable S3 backups, real-time verification, incident detection, and automated repair workflows.

🧠 What It Solves

* 🔐 Prevents ledger tampering
* 🧾 Maintains immutable audit history
* 🔗 SHA-256 hash chain integrity
* ☁️ S3-based backup and recovery
* 🚨 Detects fraud and locks ledger
* 🔧 Repairs corrupted ledger from backups

 🏗️ Architecture Overview

 Core Backend Modules

* `app.js` → Express setup & routes
* `server.js` → server bootstrap
* `prisma.js` → database client
* `s3.js` → AWS S3 config
* `redis.js` → BullMQ queue system

🔄 System Flow

💰 Transaction Flow

* POST `/api/transaction/create`
* Creates transaction + audit outbox in single DB transaction
* Event queued for processing

⚙️ Audit Pipeline

* Cron job picks pending outbox events
* BullMQ worker processes audit job
* Generates SHA-256 hash chain
* Stores SecurityLog (DB) + backup (S3)
* Marks event as PROCESSED
🔍 Verification Engine

* GET `/api/security/verify`
* Replays ledger history
* Recomputes hashes
* Result: VERIFIED / COMPROMISED

 🚨 Incident Management

* Auto-detects tampering
* Creates incident record
* Locks ledger automatically
* APIs:

  * GET `/api/incidents`
  * GET `/api/incidents/:id`
  * PATCH `/api/incidents/:id/status`

🔧 Repair System

* POST `/api/repair/incident` (admin only)
* Restores data from S3 backups
* Rebuilds ledger history
* Unlocks system after fix

🔐 Security Layer

* backend/middleware/authMiddleware.js protects routes using JWT stored in HTTP-only cookies
* backend/middleware/ledgerMiddleware.js blocks transaction creation if a user ledger is locked due to integrity issues
* backend/middleware/rbacMiddleware.js restricts repair operations to admin and superadmin

⚡ Real-Time Events (Socket.IO)
backend/realtime/socketServer.js initializes Socket.IO on server startup using initSocketServer() from backend/server.js
connected clients authenticate using JWT from socket.handshake.auth.token or Authorization: Bearer <token>
authenticated users join user:<id> rooms, and admin roles also join a shared admin room
backend/events/ledgerEventBus.js emits app-level events that are broadcast over Socket.IO to connected clients

emitted socket event names include:

* TRANSACTION_CREATED
* AUDIT_COMPLETE
* VERIFICATION_STARTED
* VERIFICATION_OK
* TAMPER_DETECTED
* INCIDENT_CREATED
* INCIDENT_UPDATED
* LEDGER_LOCKED
* LEDGER_UNLOCKED
* REPAIR_STARTED
* REPAIR_COMPLETED

 📁 Folder Structure

```bash
backend/
├── controllers
├── services
├── routes
├── workers
├── queues
├── config
├── middleware
├── repositories
├── validation
├── tests
├── crone-jobs
├── realtime
├── algorithams
└── app.js / server.js
```

 🌐 API Reference

Auth

* POST `/api/auth/signup`
* POST `/api/auth/login`
* POST `/api/auth/logout`
* GET `/api/auth/profile`

Transactions

* POST `/api/transaction/create`
* GET `/api/transaction/:id`

 Security

* GET `/api/security/verify`
* GET `/api/security/incidents`

Incidents

* GET `/api/incidents`
* GET `/api/incidents/:id`
* PATCH `/api/incidents/:id/status`

 Repair

* POST `/api/repair/incident`

Health

* GET `/health`

⚙️ Environment Configuration

Create a .env file in backend/ with the following variables:

DATABASE_URL → Prisma/PostgreSQL connection string
JWT_SECRET → JWT signing secret
CLIENT_URL → optional CORS origin
PORT → optional server port (default: 5000)
AWS_REGION → AWS region for S3
AWS_ACCESS_KEY_ID → AWS access key
AWS_SECRET_ACCESS_KEY → AWS secret key
S3_BUCKET_NAME → S3 bucket name for backups (default: guardianshield)
S3_PREFIX → backup object prefix (default: guardianshield/users)
S3_ENDPOINT → optional custom S3 endpoint (local dev)
S3_SERVER_SIDE_ENCRYPTION → optional encryption algorithm


▶️ Run Locally

```bash
cd backend
npm install
npx prisma migrate dev
redis-server
npm run dev
```

Server: [http://localhost:5000](http://localhost:5000)

## 🧪 Testing

* npm test → all tests
* npm run test:unit → unit tests
* npm run test:integration → integration tests

## 🧠 Key Features

* Hash-chain based integrity system
* Immutable S3 audit backups
* Async BullMQ processing
* Real-time tamper detection
* Auto repair system
* Secure RBAC + JWT

* 
🧠 Notes
  The app uses JWT auth stored in an HTTP-only cookie named token
  ledgerMiddleware blocks new transactions when ledger is locked due to detected incident
  Audit records are chained using generateHash, and verification recomputes them in verifyHashchain.js
  Repair uses S3 backup history to rollback affected transactions and audit records


⚡ Useful Quick Checks
    Health: GET http://localhost:5000/health
    Signup: POST http://localhost:5000/api/auth/signup (body: { name, email, password })
    Login: POST http://localhost:5000/api/auth/login (body: { email, password })
    Logout: POST http://localhost:5000/api/auth/logout
    Profile: GET http://localhost:5000/api/auth/profile
    Create transaction: POST http://localhost:5000/api/transaction/create (body: { amount, description, type })
    Get transaction: GET http://localhost:5000/api/transaction/:id
    Verify ledger: GET http://localhost:5000/api/security/verify
    List security incidents: GET http://localhost:5000/api/security/incidents
    List incidents: GET http://localhost:5000/api/incidents
    Get incident: GET http://localhost:5000/api/incidents/:id
    Update incident status: PATCH http://localhost:5000/api/incidents/:id/status (body: { status })
    Trigger repair: POST http://localhost:5000/api/repair/incident (body: { incidentId })


    
