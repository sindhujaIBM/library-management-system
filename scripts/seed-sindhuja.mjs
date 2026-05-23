/**
 * Seed script — 6 months of realistic data for onvsindhu@gmail.com.
 *
 * Sets up three live email scenarios for the loanLifecycleAgent:
 *   1. TWO auto-renewal emails  — Sindhu has loans due TODAY, renewalCount=0, no holds
 *   2. "Hold available soon"    — Sindhu is first in queue on a book also due TODAY
 *
 * Run AFTER seed.mjs (requires base catalog to exist).
 *
 * Usage:
 *   node scripts/seed-sindhuja.mjs
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';

const TABLE  = process.env.DYNAMO_TABLE || 'library-dev';
const REGION = process.env.AWS_REGION   || 'ca-west-1';

const db = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const today = now.toISOString();

function daysAgo(n)     { return new Date(now - n * DAY).toISOString(); }
function daysFromNow(n) { return new Date(now.getTime() + n * DAY).toISOString(); }

// ─── users ──────────────────────────────────────────────────────────────────

const SINDHUJA = {
  userId:   'google_sindhuja_01',
  name:     'Sindhuja K',
  email:    'onvsindhu@gmail.com',
  googleId: 'sindhuja_01',
};

// Auxiliary member — holds a book Sindhuja is waiting for (triggers "available soon" email)
const AUX_HOLDER = {
  userId:   'google_aux_holder_01',
  name:     'Priya Mehta',
  email:    'priya.mehta.aux@example.com',
  googleId: 'aux_holder_01',
};

// ─── book assignments ────────────────────────────────────────────────────────

// Auto-renewal books — Sindhuja's loans due TODAY, renewalCount=0, no holds.
// Both books have enough copies in the base catalog to absorb one more active loan.
const AUTO_RENEW_LOANS = [
  {
    isbn:   '978-0-06-093546-9',
    title:  'Murder on the Orient Express',
    author: 'Agatha Christie',
  },
  {
    isbn:   '978-0-8129-9429-2',
    title:  'A Brief History of Time',
    author: 'Stephen Hawking',
  },
];

// Hold-trigger book — AUX_HOLDER has it checked out, due TODAY, hold queue exists.
// Sindhuja is first in queue → loanLifecycleAgent emails her "available soon".
const HOLD_TRIGGER_BOOK = {
  isbn:   '978-0-525-55360-5',
  title:  'The Midnight Library',
  author: 'Matt Haig',
};

// Historical reads — returned loans across the last 6 months
const HISTORY_BOOKS = [
  { isbn: '978-0-14-028329-7', title: '1984',                                  author: 'George Orwell' },
  { isbn: '978-0-7432-7358-9', title: 'Dune',                                  author: 'Frank Herbert' },
  { isbn: '978-0-439-02348-1', title: "Harry Potter and the Sorcerer's Stone", author: 'J.K. Rowling' },
  { isbn: '978-0-7432-7359-6', title: 'Gone Girl',                             author: 'Gillian Flynn' },
  { isbn: '978-0-7432-7360-2', title: 'Sapiens',                               author: 'Yuval Noah Harari' },
  { isbn: '978-0-14-028428-7', title: "The Hitchhiker's Guide to the Galaxy",  author: 'Douglas Adams' },
  { isbn: '978-0-593-31012-3', title: 'Atomic Habits',                         author: 'James Clear' },
  { isbn: '978-0-618-57494-1', title: 'The Fellowship of the Ring',            author: 'J.R.R. Tolkien' },
  { isbn: '978-0-385-54734-9', title: 'Educated',                              author: 'Tara Westover' },
  { isbn: '978-0-7432-7357-2', title: 'The Hobbit',                            author: 'J.R.R. Tolkien' },
  { isbn: '978-1-250-30177-4', title: 'And Then There Were None',              author: 'Agatha Christie' },
  { isbn: '978-0-439-06486-6', title: "Harry Potter and the Chamber of Secrets", author: 'J.K. Rowling' },
];

// ─── helpers ────────────────────────────────────────────────────────────────

let written = 0;

async function upsertUser(u) {
  const key = { PK: `USER#${u.userId}`, SK: 'METADATA' };
  const existing = await db.send(new GetCommand({ TableName: TABLE, Key: key }));
  if (existing.Item) {
    console.log(`  skip  user ${u.name} (already exists)`);
    return;
  }
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: {
      ...key,
      entityType: 'USER',
      role: 'member',
      userId: u.userId,
      email: u.email,
      name: u.name,
      googleId: u.googleId,
      createdAt: daysAgo(365),
      updatedAt: today,
    },
  }));
  written++;
  console.log(`  added user ${u.name} <${u.email}>`);
}

async function putLoan({ isbn, userId, userName, userEmail, bookTitle, bookAuthor, checkoutDate, returnDueDate, status, returnedDate, renewalCount = 0 }) {
  const sk = `LOAN#${userId}#${checkoutDate}`;
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `LOAN#${isbn}`, SK: sk,
      entityType: 'LOAN',
      loanId: uuid(),
      ISBN: isbn, userId, userEmail, userName, bookTitle, bookAuthor,
      checkoutDate, returnDueDate,
      ...(returnedDate ? { returnedDate } : {}),
      status, renewalCount,
    },
  }));
  written++;
}

async function decrementAvailability(isbn, checkoutDate) {
  const bookItem = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `BOOK#${isbn}`, SK: 'METADATA' } }));
  if (!bookItem.Item) { console.warn(`  warn  book ${isbn} not found — skipping availability update`); return; }
  const avail  = Math.max(0, (bookItem.Item.availableCopies ?? bookItem.Item.totalCopies) - 1);
  const onLoan = (bookItem.Item.copiesOnLoan ?? 0) + 1;
  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `BOOK#${isbn}`, SK: 'METADATA' },
    UpdateExpression: 'SET availableCopies = :a, copiesOnLoan = :l, lastBorrowedDate = :lb, updatedAt = :now',
    ExpressionAttributeValues: { ':a': avail, ':l': onLoan, ':lb': checkoutDate, ':now': today },
  }));
}

async function putHold({ isbn, userId, userName, userEmail, joinedAt }) {
  const key = { PK: `WAITLIST#${isbn}`, SK: `USER#${userId}` };
  const existing = await db.send(new GetCommand({ TableName: TABLE, Key: key }));
  if (existing.Item) {
    console.log(`  skip  hold ${userName} → ${isbn}`);
    return;
  }
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: { ...key, entityType: 'WAITLIST', ISBN: isbn, userId, userEmail, userName, joinedAt },
  }));
  written++;
}

async function deleteExistingActiveLoans(isbn, userId) {
  const result = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk',
    FilterExpression: 'userId = :uid AND #s = :active',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':pk': `LOAN#${isbn}`, ':uid': userId, ':active': 'active' },
  }));
  for (const item of result.Items ?? []) {
    await db.send(new DeleteCommand({ TableName: TABLE, Key: { PK: item.PK, SK: item.SK } }));
    console.log(`  removed stale active loan SK=${item.SK}`);
  }
}

// ─── main ───────────────────────────────────────────────────────────────────

console.log(`\nSeeding onvsindhu@gmail.com data into ${TABLE} (${REGION})...\n`);

// 1. Users
console.log('── Users ─────────────────────────────────────');
await upsertUser(SINDHUJA);
await upsertUser(AUX_HOLDER);

// 2. Six months of returned loan history for Sindhuja
//    12 books, one loan every ~2 weeks spread over 180 days → rich history for AI insights
console.log('\n── 6-month loan history (Sindhuja) ───────────');
for (let i = 0; i < HISTORY_BOOKS.length; i++) {
  const book     = HISTORY_BOOKS[i];
  const offset   = 15 + i * 14;          // 15, 29, 43, … 177 days ago (checkout end date)
  const dueDate  = daysAgo(offset);
  const checkout = daysAgo(offset + 21);

  await putLoan({
    isbn: book.isbn, userId: SINDHUJA.userId, userName: SINDHUJA.name, userEmail: SINDHUJA.email,
    bookTitle: book.title, bookAuthor: book.author,
    checkoutDate: checkout, returnDueDate: dueDate, returnedDate: dueDate,
    status: 'returned',
    renewalCount: i % 3 === 0 ? 1 : 0,  // every third loan was renewed — realistic pattern
  });
  console.log(`  returned  "${book.title}" (checked out ${offset + 21}d ago)`);
}

// 3. Active loans due TODAY — will be auto-renewed by loanLifecycleAgent
//    (renewalCount=0, no holds on these books)
console.log('\n── Active loans due TODAY → auto-renewal ─────');
for (const book of AUTO_RENEW_LOANS) {
  await deleteExistingActiveLoans(book.isbn, SINDHUJA.userId);

  const checkoutDate = daysAgo(21);
  const returnDueDate = today; // due TODAY

  await putLoan({
    isbn: book.isbn, userId: SINDHUJA.userId, userName: SINDHUJA.name, userEmail: SINDHUJA.email,
    bookTitle: book.title, bookAuthor: book.author,
    checkoutDate, returnDueDate,
    status: 'active', renewalCount: 0,
  });
  await decrementAvailability(book.isbn, checkoutDate);
  console.log(`  active  "${book.title}" — due TODAY, renewalCount=0, no holds → WILL AUTO-RENEW`);
}

// 4. Hold-trigger scenario
//    AUX_HOLDER has "The Midnight Library" — due TODAY, renewalCount=0, Sindhuja is first in hold queue.
//    loanLifecycleAgent will:
//       a) Email AUX_HOLDER: "book due today, holds on file — please return"
//       b) Email Sindhuja (onvsindhu@gmail.com): "good news — The Midnight Library will be available soon"
console.log('\n── Hold-trigger loan (AUX_HOLDER) ───────────');
await deleteExistingActiveLoans(HOLD_TRIGGER_BOOK.isbn, AUX_HOLDER.userId);

const holdBookCheckout = daysAgo(21);
const holdBookDue = today; // due TODAY

await putLoan({
  isbn: HOLD_TRIGGER_BOOK.isbn, userId: AUX_HOLDER.userId, userName: AUX_HOLDER.name, userEmail: AUX_HOLDER.email,
  bookTitle: HOLD_TRIGGER_BOOK.title, bookAuthor: HOLD_TRIGGER_BOOK.author,
  checkoutDate: holdBookCheckout, returnDueDate: holdBookDue,
  status: 'active', renewalCount: 0,
});
await decrementAvailability(HOLD_TRIGGER_BOOK.isbn, holdBookCheckout);
console.log(`  active  "${HOLD_TRIGGER_BOOK.title}" held by ${AUX_HOLDER.name} — due TODAY`);

// Sindhuja's hold — joined 3 days ago, position 1 (first in queue)
console.log('\n── Hold queue (Sindhuja first) ───────────────');
await putHold({
  isbn: HOLD_TRIGGER_BOOK.isbn,
  userId: SINDHUJA.userId, userName: SINDHUJA.name, userEmail: SINDHUJA.email,
  joinedAt: daysAgo(3),
});
console.log(`  ${SINDHUJA.name} → hold #1 on "${HOLD_TRIGGER_BOOK.title}" (joined 3 days ago)`);

// ─── summary ────────────────────────────────────────────────────────────────

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Done — ${written} items written to ${TABLE}

Sindhuja K <onvsindhu@gmail.com>
  userId : ${SINDHUJA.userId}
  History: 12 returned loans spanning ~6 months
           (mix of renewals and straight returns)

Emails that will fire next time loanLifecycleAgent runs:
  ✉ Auto-renewal #1 — "Murder on the Orient Express"
      Subject: "Murder on the Orient Express" has been automatically renewed
  ✉ Auto-renewal #2 — "A Brief History of Time"
      Subject: "A Brief History of Time" has been automatically renewed
  ✉ Hold available — "The Midnight Library"
      Subject: Good news: "The Midnight Library" will be available soon
              (Priya Mehta is the current borrower, due today, hold queue exists)

To trigger the emails immediately, invoke the loanLifecycleAgent Lambda:
  aws lambda invoke --function-name library-dev-loanLifecycleAgent \\
    --region ${REGION} /dev/null
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
