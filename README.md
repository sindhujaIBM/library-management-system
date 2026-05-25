# Library Management System

An AI-powered library management system built on AWS serverless infrastructure. Members search, borrow, and return books; librarians get an operational dashboard with AI-generated insights and alerts — all requiring explicit human approval before any consequential action.

---

## Features

**Members**
- Search and browse the book catalog (full-text via OpenSearch)
- Borrow and return books, place or cancel holds
- View active loans and full loan history
- AI book recommendation chatbot (Amazon Nova Micro)
- Email notifications for due dates, renewals, and hold availability

**Librarians** *(everything above, plus)*
- Add, edit, and delete books
- View all active loans and overdue dashboard
- Manage hold queues per book
- AI loan pattern analytics (Claude Haiku)
- Admin alerts queue — approve or reject AI recommendations
- Promote members to librarian

**Background AI Agents** *(EventBridge scheduled)*
- `loanLifecycleAgent` — daily: auto-renews eligible loans, sends 3-day reminders and overdue notices
- `demandDetectionAgent` — daily: flags books with 5+ holds for copy-order recommendations
- `staleInventoryAgent` — weekly: flags books untouched 6+ months for auction review
- `seriesReleaseAgent` — weekly: detects new series entries via Google Books API, drafts SES emails to fans

All AI recommendations require librarian approval before any external action is taken.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript, Vite, Tailwind CSS |
| Backend | Node.js + TypeScript on AWS Lambda |
| API | AWS API Gateway (REST) |
| Database | DynamoDB (single-table design) |
| Search | Amazon OpenSearch (synced via DynamoDB Streams) |
| AI | Amazon Nova Micro + Claude Haiku via AWS Bedrock |
| Auth | Google OAuth 2.0 + JWT (httpOnly cookie) |
| Email | AWS SES |
| Scheduling | EventBridge Scheduled Rules |
| Hosting | S3 + CloudFront (frontend), Serverless Framework (backend) |
| Region | `ca-west-1` |

---

## Project Structure

```
.
├── frontend/                  # React + TypeScript SPA
│   └── src/
│       ├── pages/             # HomePage, BookDetailPage, MyLoansPage, CartPage, ChatPage
│       │   └── admin/         # AdminDashboardPage, AdminAlertsPage, AdminInsightsPage, ManageBooksPage
│       ├── components/        # BookCard, BookForm, shared UI
│       ├── api/               # Typed API clients per service
│       └── contexts/          # AuthContext
├── services/
│   ├── auth/                  # googleAuthCallback, logout, getMe, promoteUser
│   ├── books/                 # searchBooks, getBook, addBook, editBook, deleteBook,
│   │                          #   borrowBook, returnBook, getUserLoans,
│   │                          #   placeHold, cancelHold, getMyHold, bulkCheckout
│   └── admin/                 # getLoanInsights, getAdminAlerts, resolveAlert,
│                              #   getAllActiveLoans, getOverdueLoans, getBookLoans, getHolds,
│                              #   recommendBooks, demandDetectionAgent, staleInventoryAgent,
│                              #   seriesReleaseAgent, loanLifecycleAgent
├── packages/
│   └── shared/                # Shared TypeScript types (Book, Loan, User, Alert)
├── infrastructure/
│   └── serverless.yml         # DynamoDB table, GSIs, S3, CloudFront
├── scripts/
│   ├── seed.mjs               # Seed book catalog
│   ├── seed-scenarios.mjs     # Seed loan / hold scenarios
│   ├── seed-alerts.mjs        # Seed sample admin alerts
│   └── make-librarian.mjs     # Promote a user to librarian by email
├── deploy-services.sh         # Deploy all Lambda services to AWS
└── deploy-FE.sh               # Build + sync frontend to S3 + invalidate CloudFront
```

---

## Local Development

### Prerequisites

- Node.js ≥ 20
- AWS CLI configured (`ca-west-1`)
- [Serverless Framework](https://www.serverless.com/) (`npm i -g serverless`)
- A Google OAuth 2.0 client ID and secret

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
```

Copy the frontend block into `frontend/.env.local`:

```bash
cp .env.example frontend/.env.local
# Fill in VITE_GOOGLE_CLIENT_ID (URLs default to localhost — no change needed for local dev)
```

### 3. Run all services locally

```bash
npm run dev
```

This starts four processes in parallel:

| Process | Port |
|---|---|
| Auth service (`serverless-offline`) | 3001 |
| Books service (`serverless-offline`) | 3002 |
| Admin service (`serverless-offline`) | 3003 |
| Frontend (Vite) | 5173 |

Open [http://localhost:5173](http://localhost:5173).

### 4. Seed data

```bash
npm run seed                 # Book catalog
npm run seed:scenarios       # Loan + hold scenarios
npm run seed:alerts          # Sample AI admin alerts
```

### 5. Promote yourself to librarian

```bash
node scripts/make-librarian.mjs your@email.com
```

---

## Deployment

### First-time setup

Deploy the shared infrastructure (DynamoDB, S3, CloudFront):

```bash
cd infrastructure && npx serverless deploy --stage prod
```

Store secrets in AWS SSM Parameter Store:

```bash
aws ssm put-parameter --name /library/prod/jwt-secret \
  --value "<secret>" --type SecureString --region ca-west-1

aws ssm put-parameter --name /library/prod/google-client-id \
  --value "<client-id>" --type SecureString --region ca-west-1

aws ssm put-parameter --name /library/prod/google-client-secret \
  --value "<client-secret>" --type SecureString --region ca-west-1

aws ssm put-parameter --name /library/prod/cors-origin \
  --value "https://<cloudfront-id>.cloudfront.net" --region ca-west-1
```

### Deploy everything

```bash
./deploy-services.sh              # Deploys auth + books + admin, then builds and syncs frontend
```

### Deploy one service

```bash
./deploy-services.sh auth
./deploy-services.sh books
./deploy-services.sh admin
```

### Deploy frontend only

```bash
./deploy-FE.sh
```

---

## API Reference

### Auth
| Method | Route | Auth |
|---|---|---|
| POST | `/auth/google` | — |
| POST | `/auth/logout` | — |
| GET | `/auth/me` | member |
| PUT | `/users/:userId/role` | librarian |

### Books
| Method | Route | Auth |
|---|---|---|
| GET | `/books` | member |
| GET | `/books/:isbn` | member |
| POST | `/books` | librarian |
| PUT | `/books/:isbn` | librarian |
| DELETE | `/books/:isbn` | librarian |

### Loans & Holds
| Method | Route | Auth |
|---|---|---|
| POST | `/loans/checkout` | member |
| POST | `/loans/checkin` | member |
| POST | `/loans/bulk-checkout` | member |
| GET | `/loans/user/:userId` | member |
| GET | `/loans/active` | librarian |
| GET | `/loans/overdue` | librarian |
| GET | `/loans/book/:isbn` | librarian |
| POST | `/holds` | member |
| DELETE | `/holds/:isbn` | member |
| GET | `/holds/:isbn` | librarian |

### AI
| Method | Route | Auth |
|---|---|---|
| POST | `/ai/recommend` | member |
| GET | `/ai/insights` | librarian |
| GET | `/ai/alerts` | librarian |
| POST | `/ai/alerts/:id/resolve` | librarian |

---

## DynamoDB Design

Single table (`library-{stage}`), four entity types:

| Entity | PK | SK |
|---|---|---|
| Book | `BOOK#ISBN` | `METADATA` |
| Loan | `LOAN#ISBN` | `LOAN#userId#checkoutDate` |
| User | `USER#userId` | `METADATA` |
| Waitlist | `WAITLIST#ISBN` | `USER#userId` |

**GSIs:**

| GSI | PK | SK | Use |
|---|---|---|---|
| GSI1 | `author` | `releaseDate` | Browse by author |
| GSI2 | `genre` | `author` | Browse by genre |
| GSI3 | `userId` | `checkoutDate` | Loan history per user |
| GSI4 | `status` | `returnDueDate` | Active loans by due date (overdue detection) |

Overdue status is computed on read (`returnDueDate < today && status === 'active'`) — never stored, always accurate.

---

## Loan Lifecycle

```
Day 1   Checkout       TransactWriteItems: decrement availableCopies + create Loan (atomic)
Day 18  Reminder       SES: "Your book is due in 3 days"
Day 21  Auto-Renew     If renewalCount=0 and no hold queue → extend +21 days, renewalCount=1
Day 39  Final Reminder SES: "Due in 3 days — no further renewals"
Day 42+ Overdue        Daily SES notice until returned
```

Auto-renewal is blocked if the book has an active hold queue. In that case, the current borrower is notified the book must be returned, and the next person on the hold queue is notified it will be available soon.

---

## Responsible AI

| Principle | Implementation |
|---|---|
| Human-in-the-loop | All AI recommendations with external impact (ordering, auctioning) require explicit librarian approval |
| No hallucinated data | Recommendation chatbot prompt is constrained to the live catalog — model cannot invent books |
| No autonomous destructive writes | Agents write to `admin_alerts` only; destructive actions are human-gated |
| Notification limits | Series tracker stores notification history — users are never notified twice about the same release |
| Transparent AI actions | All AI-generated alerts are labeled as AI recommendations in the dashboard |

---

## Architecture Notes

**Race condition on last copy** — checkout uses a DynamoDB conditional write (`availableCopies > 0`). First request wins; second receives a 409.

**Atomic checkout** — `TransactWriteItems` ensures the copy count decrement and loan creation succeed or fail together.

**Search consistency** — DynamoDB Streams trigger `indexToOpenSearch` Lambda in real time. A DLQ captures failed events; a manual re-index Lambda can restore consistency if needed.

**Counter drift** — a weekly reconciliation Lambda compares active loan counts against `availableCopies`. Mismatches surface as admin alerts and are never auto-corrected.
