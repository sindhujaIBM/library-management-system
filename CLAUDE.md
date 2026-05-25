## Claude Instructions

### How to collaborate
- **Check blind spots proactively.** Before implementing, ask: what's the failure mode if this is wrong? What assumption is being made here? Surface tradeoffs the user hasn't asked about — architectural decisions, edge cases, missing pieces in the design.
- **Ask before implementing** when the task is underspecified. List what you think is implied and confirm before touching code.
- **Challenge assumptions** — if you see a decision that has an unstated cost (e.g. a full table scan, a missing pagination loop, a race condition), name it explicitly even if the user didn't ask.
- **Don't just execute** — be a thought partner. The user wants to be prepared for interview-level questions on every decision.

### Deploy commands

**Backend services** — run from each service directory, targeting `--stage dev` or `--stage prod`:
```bash
cd services/auth  && npx serverless deploy --stage prod
cd services/books && npx serverless deploy --stage prod
cd services/admin && npx serverless deploy --stage prod
```
Deploy all three in parallel when deploying backend.

**Frontend** — build, sync to S3, invalidate CloudFront:
```bash
cd frontend && npm run build
aws s3 sync frontend/dist s3://library-infra-prod-frontendbucket-zuos8tibcr03 --delete --region ca-west-1
aws cloudfront create-invalidation --distribution-id E5IPUVITQ25WX --paths "/*" --region us-east-1
```
Frontend live at: https://d360m6tattqe2h.cloudfront.net

**Seed commands** — default to `library-dev`, use `DYNAMO_TABLE=library-prod` for prod:
```bash
node scripts/seed.mjs                              # books
node scripts/seed-scenarios.mjs                    # scenario data
node scripts/seed-sindhuja.mjs                     # Sindhuja's loan history
DYNAMO_TABLE=library-prod node scripts/seed.mjs    # prod
```

---

## Project Overview

A Mini Library Management System with AI-powered operational intelligence. Built for the Anju Software take-home assignment.

Core: Book catalog, check-in/check-out, search.
AI layer: Book recommendations, demand detection, stale inventory management, loan pattern analytics, series release tracking.

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + TypeScript | Known cold, fast to build |
| Backend | Node.js + TypeScript on AWS Lambda | Known cold, serverless, consistent with MaidLink |
| API | API Gateway + Lambda | Standard serverless pattern |
| Database | DynamoDB (single-table) | AWS-native, schema designed below |
| AI | Amazon Nova Micro + Claude Haiku (via AWS Bedrock) | Nova Micro for fast text tasks, Claude Haiku for reasoning |
| Auth | Google OAuth + JWT | SSO requirement, proven pattern from MaidLink |
| Notifications | AWS SES | Email notifications for overdue, waitlist, admin alerts |
| Scheduling | EventBridge Scheduled Rules | Trigger background AI agents |
| Deployment | AWS Lambda + API Gateway (serverless) | No server to manage |

---

## Auth

Google OAuth with two roles:

| Role | Permissions |
|---|---|
| `member` | Search books, borrow, place holds, return, view own loan history, receive notifications |
| `librarian` | Everything above + add/edit/delete books, view admin dashboard, approve AI recommendations, view all loan history, promote users to librarian |

**Role assignment:**
- All users self-register via Google OAuth — default role is `member`
- Librarian role is **granted by an existing librarian** via the admin UI — never self-assigned
- Role is encoded in JWT payload. Lambda middleware validates JWT and checks role on protected routes.
- `PUT /users/:userId/role` — promote a user to librarian [librarian only]

JWT stored in httpOnly cookie.

---

## DynamoDB — Single Table Design

**Table name:** `library`

### Entity Key Structure

| Entity | PK | SK | Description |
|---|---|---|---|
| Book | `BOOK#ISBN` | `METADATA` | One record per book |
| Loan | `LOAN#ISBN` | `LOAN#userId#checkoutDate` | All loans for a book, sortable |
| User | `USER#userId` | `METADATA` | User profile and role |
| Waitlist | `WAITLIST#ISBN` | `USER#userId` | Queue per book |

### Core Attributes

**Book:** `ISBN`, `title`, `author`, `genre`, `series`, `seriesPosition`, `releaseDate`, `totalCopies`, `availableCopies`, `copiesOnLoan`, `lastBorrowedDate`, `coverImageUrl`

**Loan:** `loanId`, `ISBN`, `userId`, `checkoutDate`, `returnDueDate` (checkout + 21 days), `returnedDate`, `status` (`active` / `returned`), `renewalCount` (0 or 1), `autoRenewedAt` (timestamp, null if not renewed)

**User:** `userId`, `email`, `name`, `role` (`member` / `librarian`), `googleId`

**Waitlist:** `ISBN`, `userId`, `joinedAt`, `position`

### Overdue
Computed on read: `returnDueDate < today && status === 'active'`. Never stored as a field — would require a scheduled update job to stay accurate.

### Loan Lifecycle — 42 Days Total

```
Day 1:   Checkout — returnDueDate = Day 21
Day 18:  SES reminder — "your book is due in 3 days"
Day 21:  loanLifecycleAgent auto-renews — renewalCount = 1, returnDueDate = Day 42
         SES notification — "your book has been renewed, new due date is [Day 42]"
Day 39:  SES reminder — "your book is due in 3 days — no further renewals available"
Day 42+: Overdue — SES overdue notice sent daily until returned
```

**Auto-renewal rules:**
- Only renews if `renewalCount === 0`
- Does not renew if the book has an active hold queue (someone is waiting)
- If hold queue exists on Day 21: no renewal, SES notifies current borrower the book must be returned, SES notifies next person on hold queue that the book will be available soon

**`loanLifecycleAgent` logic (runs daily via EventBridge):**
1. Query GSI4 (`status = active`, sorted by `returnDueDate`)
2. For each active loan:
   - `returnDueDate === today && renewalCount === 0 && no hold queue` → auto-renew, update `returnDueDate` to +21 days, `renewalCount = 1`, send renewal SES to borrower
   - `returnDueDate === today && renewalCount === 0 && hold queue exists` → no renewal, send SES to borrower ("book due today, holds exist — please return"), send SES to next person on hold queue ("your hold will be ready soon")
   - `returnDueDate === today && renewalCount === 1` → send final due SES to borrower (no renewal available)
   - `returnDueDate - 3 days === today` → send reminder SES to borrower
   - `returnDueDate < today` → send overdue SES to borrower (daily until returned)

### GSIs

| GSI | PK | SK | Access Pattern |
|---|---|---|---|
| GSI1 | `author` | `releaseDate` | Browse by author, sorted by publication date |
| GSI2 | `genre` | `author` | Browse by genre (note: low cardinality — acceptable at this scale) |
| GSI3 | `userId` | `checkoutDate` | All loans for a user, sorted by date |
| GSI4 | `status` | `returnDueDate` | All active loans sorted by due date (overdue detection) |

---

## Lambda Functions

Each Lambda is a single-responsibility function behind an API Gateway route.

### Auth Lambdas
| Lambda | Route | Description |
|---|---|---|
| `googleAuthCallback` | `POST /auth/google` | Handles OAuth callback, issues JWT |
| `logout` | `POST /auth/logout` | Clears JWT cookie |
| `getMe` | `GET /auth/me` | Returns current user profile from JWT |
| `promoteUser` | `PUT /users/:userId/role` | Grants librarian role [librarian only] |

### Book Lambdas
| Lambda | Route | Description |
|---|---|---|
| `searchBooks` | `GET /books?q=&author=&genre=&series=` | Full-text search via OpenSearch |
| `getBook` | `GET /books/:isbn` | Get single book + availability |
| `addBook` | `POST /books` | Add book to catalog [librarian only] |
| `editBook` | `PUT /books/:isbn` | Edit book metadata [librarian only] |
| `deleteBook` | `DELETE /books/:isbn` | Remove book from catalog [librarian only] |

### Loan Lambdas
| Lambda | Route | Description |
|---|---|---|
| `borrowBook` | `POST /loans/checkout` | Check out a book — decrements availableCopies |
| `returnBook` | `POST /loans/checkin` | Return a book — increments availableCopies, checks hold queue, sends SES to next person on hold if queue exists |
| `getUserLoans` | `GET /loans/user/:userId` | Loan history for a user (own) |
| `getAllActiveLoans` | `GET /loans/active` | All active loans [librarian only] |
| `getOverdueLoans` | `GET /loans/overdue` | Active loans where returnDueDate < today [librarian only] |
| `getBookLoans` | `GET /loans/book/:isbn` | Full loan history for a specific book [librarian only] |

### Hold Lambdas
| Lambda | Route | Description |
|---|---|---|
| `placeHold` | `POST /holds` | Join waitlist for a book |
| `cancelHold` | `DELETE /holds/:isbn` | Leave waitlist |
| `getHolds` | `GET /holds/:isbn` | View hold queue [librarian only] |

### AI Lambdas
| Lambda | Route | Description |
|---|---|---|
| `recommendBooks` | `POST /ai/recommend` | Nova Micro — chat-based book recommendations |
| `getLoanInsights` | `GET /ai/insights` | Claude Haiku — loan pattern analysis [librarian only] |
| `getAdminAlerts` | `GET /ai/alerts` | Pending AI recommendations [librarian only] |
| `resolveAlert` | `POST /ai/alerts/:id/resolve` | Approve or reject AI recommendation [librarian only] |

### Background Agent Lambdas (EventBridge triggered — no API Gateway)
| Lambda | Trigger | Description |
|---|---|---|
| `demandDetectionAgent` | EventBridge — daily | Scans waitlist, flags high-demand books for ordering |
| `staleInventoryAgent` | EventBridge — weekly | Flags books not borrowed in 6+ months for auction |
| `seriesReleaseAgent` | EventBridge — weekly | Checks Google Books API for new releases in tracked series |
| `loanLifecycleAgent` | EventBridge — daily | Handles auto-renewal, due reminders, and overdue notifications (see below) |
| `indexToOpenSearch` | DynamoDB Stream | Syncs book changes to OpenSearch index |

---

## Search — DynamoDB Streams + OpenSearch

DynamoDB cannot do full-text search without expensive scans. OpenSearch handles search; DynamoDB stays the source of truth.

**How it works:**
1. Any write to the `library` table (add book, edit book, delete book) fires a DynamoDB Stream event
2. `indexToOpenSearch` Lambda processes the stream in real time
3. On INSERT/MODIFY: upserts the book document to the OpenSearch `books` index
4. On REMOVE: deletes the document from the index
5. `searchBooks` Lambda queries OpenSearch — supports full-text on title/author, filter by genre/series/availability

**OpenSearch index fields:** `ISBN`, `title`, `author`, `genre`, `series`, `availableCopies`, `releaseDate`

**Why this pattern:** Keeps DynamoDB as the authoritative store. Search index is eventually consistent but always derived from DynamoDB — no dual-write bugs. Same pattern used at Avenue One for the document intelligence platform.

---

## Two Views

### Member View
- Search and browse books (OpenSearch-powered)
- Book detail: availability, hold queue position
- Borrow / return
- Place or cancel a hold
- My loans (active + history)
- AI book recommendation chatbot
- Notifications: overdue reminders, hold available, new series releases

### Librarian View
Everything in Member View, plus:
- Add / edit / delete books
- All active loans
- Overdue loans dashboard
- Hold queues per book
- Full loan history per book
- Loan pattern analytics (AI insights dashboard)
- Admin alerts queue (AI recommendations pending approval)
- User management (promote member → librarian)

---

## API Design (summary)

```
POST /auth/google
POST /auth/logout
GET  /auth/me
PUT  /users/:userId/role           [librarian]

GET    /books                      search via OpenSearch
GET    /books/:isbn
POST   /books                      [librarian]
PUT    /books/:isbn                [librarian]
DELETE /books/:isbn                [librarian]

POST /loans/checkout
POST /loans/checkin
GET  /loans/user/:userId
GET  /loans/active                 [librarian]
GET  /loans/overdue                [librarian]
GET  /loans/book/:isbn             [librarian]

POST   /holds
DELETE /holds/:isbn
GET    /holds/:isbn                [librarian]

POST /ai/recommend
GET  /ai/insights                  [librarian]
GET  /ai/alerts                    [librarian]
POST /ai/alerts/:id/resolve        [librarian]
```

---

## AI Features

### 1. Book Recommendation Chatbot
**Model:** Amazon Nova Micro (fast, cheap, text-only)
**How it works:** User describes preferences in natural language. Lambda sends conversation + user's loan history to Nova Micro. Returns top 3 book suggestions from the existing catalog.
**RAI:** Only recommends books that exist in the catalog. Never fabricates ISBNs or titles. Prompt explicitly instructs: "Only recommend books from the following catalog list."

### 2. Demand Detection — Auto-Order Alert
**Model:** Claude Haiku on Bedrock (needs reasoning over waitlist data)
**How it works:** Triggered by EventBridge every 24 hours. Scans waitlist table. If any book has 5+ people waiting, Claude Haiku generates a recommendation: how many copies to order, estimated cost, Amazon.ca search link. Recommendation is written to an `admin_alerts` table with status `pending`.
**Human-in-the-loop:** Librarian sees the alert in the admin dashboard. One-click approve or reject. Nothing is ordered automatically. Approved alerts trigger an SES email to the librarian with the Amazon.ca link.
**RAI guardrail:** Agent cannot place orders. It can only surface recommendations. All external actions require explicit librarian approval.

### 3. Stale Inventory Agent
**Model:** Claude Haiku on Bedrock
**How it works:** Triggered by EventBridge once a week. Scans books where `lastBorrowedDate` is older than 6 months. Claude Haiku evaluates each book against loan history and generates an auction recommendation with suggested starting price. Written to `admin_alerts` as `pending`.
**Human-in-the-loop:** Same approval pattern as demand detection. Librarian approves before any external action.
**RAI guardrail:** Never removes a book from inventory without explicit librarian approval. Recommendation only — no destructive writes.

### 4. Loan Pattern Dashboard
**Model:** Claude Haiku on Bedrock
**How it works:** Lambda aggregates loan data by genre, author, and month. Claude Haiku generates a plain-English summary of trends: "Sci-Fi loans up 40% this quarter, driven by borrowing of the Dune series. Consider expanding that section." Displayed on the librarian admin dashboard.
**Also surfaces:** Underperforming genres, seasonal patterns, most-borrowed authors.

### 5. Series Release Tracker
**Model:** Claude Haiku on Bedrock + Google Books API
**How it works:** Triggered by EventBridge weekly. Scans books where `series` is populated. Calls Google Books API to check for new releases in that series. If a new book is found, Claude Haiku generates a notification draft. Lambda sends SES email to all users who have borrowed from that series.
**RAI guardrail:** Deduplication — don't notify the same user about the same book twice. Store notification history in DynamoDB.

---

## RAI Principles Applied

| Principle | Implementation |
|---|---|
| Human-in-the-loop for consequential actions | All AI recommendations that have external impact (ordering, auctioning) require librarian approval before execution |
| No hallucinated data | Book recommendation prompt is constrained to the actual catalog — model cannot invent books |
| No destructive autonomous writes | AI agents write to an `admin_alerts` table only. Destructive actions (removing inventory, placing orders) are gated behind explicit human approval |
| Notification frequency limits | Series tracker stores notification history — users are not spammed about the same release |
| Transparent AI actions | All AI-generated alerts are labeled as AI recommendations in the admin UI, not presented as system decisions |

---

## Admin Alerts Table

All AI recommendations flow through this table before any action is taken.

| Field | Value |
|---|---|
| `PK` | `ALERT#alertId` |
| `SK` | `METADATA` |
| `type` | `demand_order` / `stale_auction` / `series_release` |
| `status` | `pending` / `approved` / `rejected` |
| `payload` | JSON — the recommendation details |
| `generatedAt` | timestamp |
| `resolvedAt` | timestamp (when librarian acted) |

GSI: `status` + `generatedAt` — lets the admin dashboard query all pending alerts sorted by recency.

---

## Build Order

1. DynamoDB table + GSIs
2. Google OAuth + JWT middleware
3. Book CRUD (add, edit, delete, list, search) — librarian only for writes
4. Check-out / check-in + waitlist
5. Overdue detection (computed on read in the loans query)
6. Admin dashboard — active loans, overdue, waitlist
7. Nova Micro chatbot — book recommendations
8. Admin alerts table + approval UI
9. Claude Haiku agents — demand detection, stale inventory (EventBridge triggers)
10. Loan pattern dashboard
11. Series release tracker (Google Books API)
12. SES notifications (overdue reminders, waitlist availability, series alerts)
13. Senior architect hardening (transactions, pagination, observability)
14. Deploy + README + Loom demo

---

## Senior Architect Considerations

These are the questions a senior engineer is expected to have answers for — not just "what did you build" but "what could go wrong and how did you design against it."

### 1. Race Condition — Last Copy

Two users borrow the last copy simultaneously. Both Lambdas read `availableCopies = 1`, both proceed. Two loans issued for one book.

**Fix:** DynamoDB conditional write on checkout:
```
ConditionExpression: availableCopies > :zero
ExpressionAttributeValues: { ":zero": 0 }
```
If condition fails → `ConditionalCheckFailedException` → return 409 to user. First request wins.

---

### 2. Atomicity — Checkout is Two Writes

Checkout requires: decrement `availableCopies` on the book + create the loan record. If the Lambda dies between the two, `availableCopies` is decremented but no loan exists.

**Fix:** `TransactWriteItems` — both writes succeed or both fail. Atomic by design.

---

### 3. Idempotency on Checkout

User clicks "Borrow" twice on a slow network. Two requests hit the Lambda.

**Fix:** Client generates a UUID idempotency key per borrow attempt. Lambda checks if a loan with that key already exists before processing. Second request is a no-op.

---

### 4. Pagination

`GET /books` cannot return unlimited results — DynamoDB has a 1MB query limit, OpenSearch has a result window.

- **Search (OpenSearch):** `?from=0&size=20` — return results + `total` count + `nextFrom` cursor
- **Librarian views (DynamoDB):** Return `LastEvaluatedKey` as a pagination token, client passes it back as `?cursor=` on the next request

---

### 5. OpenSearch / DynamoDB Drift

The Streams → OpenSearch pipeline is eventually consistent. If the indexer Lambda fails, search goes stale.

**Fix:**
- DLQ on the stream processor Lambda — failed events land in DLQ
- CloudWatch alarm on DLQ depth
- Re-index Lambda (one-off, run manually): scans full DynamoDB table and re-indexes to OpenSearch

---

### 6. `availableCopies` Drift

`availableCopies` is a counter. Over time, failed transactions or bugs could cause it to diverge from the actual count of active loans.

**Fix:** Weekly reconciliation Lambda (EventBridge) — counts active loans per ISBN, compares against `availableCopies`. Mismatches are written to an admin alert for human review. Never auto-corrects — surfaces for librarian action.

---

### 7. Observability

- Structured logging on every Lambda with a correlation ID (trace a single checkout end to end across multiple Lambdas)
- CloudWatch alarms: Lambda error rate, Lambda duration p99, DLQ depth
- DLQ on all EventBridge-triggered Lambdas — if `loanLifecycleAgent` fails, the event is captured, not silently dropped

---

### 8. CI/CD — Serverless Framework

`serverless.yml` defines all Lambda functions, API Gateway routes, DynamoDB tables, GSIs, EventBridge rules, and IAM permissions.

`serverless deploy` ships the full stack.

Environment separation: `dev` and `prod` stacks via `--stage` flag. Separate DynamoDB tables, separate OpenSearch domains. Never share state between environments.

---

### Priority if asked to whiteboard

1. Race condition + conditional writes (most likely to be probed)
2. TransactWriteItems for atomic checkout
3. Pagination
4. Observability / DLQs
5. Serverless Framework deployment

---

## Key Design Decisions to Know Cold

- **Why single-table DynamoDB:** One entity type (Book) plus Loans and Users — single table avoids joins, scales cleanly, access patterns are well-defined
- **Why Nova Micro for chatbot:** Text-only task, latency-sensitive (user is waiting), cheapest appropriate model
- **Why Claude Haiku for agents:** Background tasks need reasoning over aggregated data — Nova Micro's reasoning ceiling is lower
- **Why human-in-the-loop on all consequential AI actions:** Matches real production AI practice — agents should not autonomously take external actions with financial or operational consequences
- **Why overdue is computed not stored:** Stored status requires a scheduled job to stay accurate — computed on read is always correct and simpler
- **Why pg-boss pattern wasn't used here:** No Postgres — DynamoDB + EventBridge replaces the job queue. EventBridge scheduled rules trigger agents directly.
