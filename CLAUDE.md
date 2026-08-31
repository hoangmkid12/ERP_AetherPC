# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

AetherPC ERP — a Vietnamese-language ERP + e-commerce storefront for a PC-components retailer/assembler (IUH graduation thesis project, "KLTN"). Monorepo with a Node/Express/Prisma backend and a React/Vite frontend, covering Procure-to-Pay (RFQ → PO → QA/QC → GRN), Order-to-Cash (POS + storefront → assembly → shipper assignment → delivery), realtime CSKH (customer service) chat over WebSocket, and HR/payroll/accounting modules. See `README.md` for the full domain write-up (RBAC matrix, workflow diagrams, payroll formulas, API/WebSocket catalogs) — it's detailed and mostly still accurate.

## Commands

Backend (`backend/`):
```
npm run dev              # nodemon dev server (src/server.js), port 5000
npm start                # production start
npm run prisma:generate  # regenerate Prisma client after schema.prisma changes
npm run prisma:migrate   # create/apply a dev migration
npm run db:seed          # node prisma/seed.js
npm run queue:worker     # start the Redis/BullMQ-style order worker (src/services/orderWorker.js)
npm run queue:producer-demo  # enqueue a demo job (src/enqueue_demo.js)
```
There is no lint/test script configured in `backend/package.json` — don't assume `npm test` or `npm run lint` exist.

Frontend (`frontend/`):
```
npm run dev       # Vite dev server
npm run build     # production build
npm run preview   # preview a production build
```
No test suite is configured for the frontend either.

Docker (from repo root): `docker-compose up --build -d` runs Postgres + backend + frontend together (see `docker-compose.yml`). Note: `orderQueue.js`/`orderWorker.js` depend on Redis via `ioredis`, but there is no `redis` service in `docker-compose.yml` — the queue worker path isn't wired into the compose stack.

Env setup: copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env` before running either app. Backend requires `DATABASE_URL` and `JWT_SECRET` at minimum (`JWT_SECRET` has no fallback — the server returns 500 on any auth check if it's unset).

## Architecture

### Backend — layered Express + Prisma
`src/server.js` boots `app.js` (Express app + routes), then starts `orderScheduler` (an in-process `setInterval` cron for auto-approving orders — not safe for multi-instance deployment) and `websocketService.initWebSocket` (attaches a `ws` server at `/ws/cskh` to the same HTTP server). Routes live in `src/routes/*.routes.js`, business logic in `src/controllers/*.controller.js`, cross-cutting concerns in `src/middlewares/`. All DB access goes through the single Prisma client in `src/config/database.js`. Auth is JWT-based (`authMiddleware(roles=[])` in `src/middlewares/auth.middleware.js`), reading the token from either an `Authorization: Bearer` header or an `authToken` HTTP-only cookie; **role strings are UPPER_SNAKE** (`'CEO'`, `'WAREHOUSE_MANAGER'`, `'QC'`, `'SUPPLIER'`, `'CUSTOMER'`, etc.) — `ADMIN` and `CEO` implicitly pass every route's role check.

The realtime CSKH chat (`websocketService.js` + `chatService.js`) now persists sessions/messages to PostgreSQL (not in-memory) and gates the staff session list (`INIT_SESSIONS`, ability to see all sessions) behind the same JWT cookie, checking `role` is one of `CSKH/SALES_MANAGER/CEO/ADMIN`; anonymous/customer connections are treated as guests scoped to their own session.

### Frontend — dual-track data layer (important gotcha)
The React app (`frontend/src/App.jsx`) is a single SPA split into three route trees: public storefront (`/`, under `StorefrontLayout`), the protected admin ERP (`/admin/*`, under `AdminLayout`, gated by `AuthContext`'s `user.role` against per-route `allowedRoles` arrays — roles here are also UPPER_SNAKE), and the supplier portal (`/supplier/portal`, role `SUPPLIER`).

Two parallel state mechanisms coexist and you need to know which one a given page uses before editing it:
- **`ERPContext.jsx`** — the original monolithic context (~2000 lines) holding orders, delivery-region detection, etc. Still used by parts of the app.
- **`stores/` (Zustand)** — a newer, in-progress refactor splitting state into `inventoryStore`, `salesStore`, `hrStore`, `financeStore`, `utilityStore` (see `stores/README.md` and `stores/MIGRATION_GUIDE.md`). `initializeAllStores()` runs once from `App.jsx`. The migration from `ERPContext` to these stores is **not finished** — check which one a page actually imports before assuming a change to one is visible everywhere.

Both layers, and `AuthContext.jsx` itself, lean heavily on **localStorage as an offline/demo fallback**: `services/api.js`'s `request()` falls back to `public/products_clean.json` if `/products` isn't reachable; `AuthContext.login()` tries real backend auth first, then falls through several localStorage-backed mock paths (`mock_erp_employees`, `erp_employees`, `mock_registered_customers`, and a hardcoded `MOCK_USERS` map with password `123456`/`admin123`) before failing. When a demo account's data looks wrong or "doesn't match the backend," check whether it's actually coming from one of these localStorage fallbacks rather than the Postgres DB. In production builds (`import.meta.env.PROD`) several of these fallbacks are disabled and errors propagate instead.

### Database
`backend/prisma/schema.prisma` is the source of truth (PostgreSQL). Table/column names are snake_case via `@map`/`@@map`; Prisma client fields are camelCase. Run `prisma:generate` after any schema edit, and `prisma:migrate` to create a migration — don't hand-edit `prisma/migrations/`.

### Role/casing conventions to keep straight
- Backend JWT payload `role` and all `authMiddleware([...])` arrays: UPPER_SNAKE (`SALES_MANAGER`, `WAREHOUSE`, `QC`, `DELIVERY`, `SUPPLIER`, `CUSTOMER`, ...).
- Frontend `AuthContext`/`App.jsx` route guards: same UPPER_SNAKE convention.
- README's RBAC table and demo-login docs use lowercase role *slugs* (`sales_manager`, `warehouse`) purely as human-facing labels/usernames — these are not the values compared in code.
- QC/QA is represented as three interchangeable role values in places: `QC`, `QA`, `QUALITY_CONTROL` — route guards and `isQC` checks typically need to include all three.

### Domain vocabulary (useful when grepping)
RFQ → PO → QA/QC (`ACCEPT_ALL`/`REJECT_ALL`/`PARTIAL_ACCEPT`) → GRN is the purchasing flow; POS/storefront order → assembly job (5-step checklist) → warehouse "Xác Nhận Xuất Kho" (opens shipper-assignment modal) → delivery with base64 proof-of-delivery is the sales/fulfillment flow. Ledger entries are `INCOME`/`EXPENSE` (VAS-style journal) in the accounting module.
