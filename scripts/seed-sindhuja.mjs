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
  userId:   'google_109703877221424714743',
  name:     'Sindhuja K S',
  email:    'onvsindhu@gmail.com',
  googleId: '109703877221424714743',
};

// Auxiliary member — holds a book Sindhuja is waiting for (triggers "available soon" email)
const AUX_HOLDER = {
  userId:   'google_aux_holder_01',
  name:     'Priya Mehta',
  email:    'priya.mehta.aux@example.com',
  googleId: 'aux_holder_01',
};

// ─── book assignments ────────────────────────────────────────────────────────

// Auto-renewal loans — Sindhuja's loans due TODAY, renewalCount=0, no holds.
// One physical, one ebook — shows mixed format in the active loans view.
const AUTO_RENEW_LOANS = [
  {
    isbn:   '978-0-06-093546-9',
    title:  'Murder on the Orient Express',
    author: 'Agatha Christie',
    genre:  'Mystery',
    format: 'physical',
  },
  {
    isbn:   '978-0-8129-9429-2',
    title:  'A Brief History of Time',
    author: 'Stephen Hawking',
    genre:  'Science',
    format: 'ebook',   // reading on tablet — no copy decrement for digital
  },
];

// Hold-trigger book — AUX_HOLDER has it checked out, due TODAY, hold queue exists.
// Sindhuja is first in queue → loanLifecycleAgent emails her "available soon".
const HOLD_TRIGGER_BOOK = {
  isbn:   '978-0-525-55360-5',
  title:  'The Midnight Library',
  author: 'Matt Haig',
  genre:  'Fiction',
};

// Historical reads — returned loans across the last 6 months.
// Format progression: started physical → discovered audiobook (commuting) → now mixes ebook too.
// Most recent entries first (offset 15d) → oldest last (offset 177d).
const HISTORY_BOOKS = [
  { isbn: '978-0-14-028329-7', title: '1984',                                    author: 'George Orwell',       genre: 'Science Fiction', format: 'audiobook' }, // offset 15 — audiobook commute
  { isbn: '978-0-7432-7358-9', title: 'Dune',                                    author: 'Frank Herbert',       genre: 'Science Fiction', format: 'audiobook' }, // offset 29 — loved it on audio
  { isbn: '978-0-439-02348-1', title: "Harry Potter and the Sorcerer's Stone",   author: 'J.K. Rowling',        genre: 'Fantasy',         format: 'audiobook' }, // offset 43 — nostalgia audiobook
  { isbn: '978-0-7432-7359-6', title: 'Gone Girl',                               author: 'Gillian Flynn',       genre: 'Mystery',         format: 'ebook'     }, // offset 57 — ebook on tablet
  { isbn: '978-0-7432-7360-2', title: 'Sapiens',                                 author: 'Yuval Noah Harari',   genre: 'History',         format: 'ebook'     }, // offset 71 — non-fiction ebook
  { isbn: '978-0-14-028428-7', title: "The Hitchhiker's Guide to the Galaxy",    author: 'Douglas Adams',       genre: 'Science Fiction', format: 'audiobook' }, // offset 85 — audiobook road trip
  { isbn: '978-0-593-31012-3', title: 'Atomic Habits',                           author: 'James Clear',         genre: 'Self-Help',       format: 'ebook'     }, // offset 99 — annotated ebook
  { isbn: '978-0-618-57494-1', title: 'The Fellowship of the Ring',              author: 'J.R.R. Tolkien',      genre: 'Fantasy',         format: 'physical'  }, // offset 113 — physical (gift copy)
  { isbn: '978-0-385-54734-9', title: 'Educated',                                author: 'Tara Westover',       genre: 'Biography',       format: 'audiobook' }, // offset 127 — memoir on audio
  { isbn: '978-0-7432-7357-2', title: 'The Hobbit',                              author: 'J.R.R. Tolkien',      genre: 'Fantasy',         format: 'physical'  }, // offset 141 — physical, early days
  { isbn: '978-1-250-30177-4', title: 'And Then There Were None',                author: 'Agatha Christie',     genre: 'Mystery',         format: 'physical'  }, // offset 155 — physical
  { isbn: '978-0-439-06486-6', title: "Harry Potter and the Chamber of Secrets", author: 'J.K. Rowling',        genre: 'Fantasy',         format: 'physical'  }, // offset 169 — physical, very start
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

async function putLoan({ isbn, userId, userName, userEmail, bookTitle, bookAuthor, bookGenre, checkoutDate, returnDueDate, status, returnedDate, renewalCount = 0, format = 'physical' }) {
  const sk = `LOAN#${userId}#${checkoutDate}`;
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `LOAN#${isbn}`, SK: sk,
      entityType: 'LOAN',
      loanId: uuid(),
      ISBN: isbn, userId, userEmail, userName, bookTitle, bookAuthor, bookGenre,
      checkoutDate, returnDueDate,
      ...(returnedDate ? { returnedDate } : {}),
      status, renewalCount, format,
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
    bookTitle: book.title, bookAuthor: book.author, bookGenre: book.genre,
    checkoutDate: checkout, returnDueDate: dueDate, returnedDate: dueDate,
    status: 'returned',
    renewalCount: i % 3 === 0 ? 1 : 0,  // every third loan was renewed — realistic pattern
    format: book.format,
  });
  console.log(`  returned  [${book.format.padEnd(9)}] "${book.title}" (checked out ${offset + 21}d ago)`);
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
    bookTitle: book.title, bookAuthor: book.author, bookGenre: book.genre,
    checkoutDate, returnDueDate,
    status: 'active', renewalCount: 0, format: book.format,
  });
  if (book.format === 'physical') {
    await decrementAvailability(book.isbn, checkoutDate);
  }
  console.log(`  active  [${book.format.padEnd(9)}] "${book.title}" — due TODAY, renewalCount=0, no holds → WILL AUTO-RENEW`);
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
  bookTitle: HOLD_TRIGGER_BOOK.title, bookAuthor: HOLD_TRIGGER_BOOK.author, bookGenre: HOLD_TRIGGER_BOOK.genre,
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

// 5. Additional digital-only history — audiobook and ebook loans not in the 12-book rotation.
//    These show Sindhuja's digital usage across children's books (for her niece/nephew)
//    and recent popular titles only available digitally in this catalog.
console.log('\n── Additional digital history (Sindhuja) ─────');
const DIGITAL_EXTRA = [
  // Children's books — Sindhuja borrowed digitally for her niece/nephew
  { isbn: '978-0-14-034488-5', title: 'Matilda',                    author: 'Roald Dahl',         genre: 'Children',        format: 'audiobook', daysAgoEnd: 12  },
  { isbn: '978-0-06-440055-8', title: "Charlotte's Web",            author: 'E.B. White',          genre: 'Children',        format: 'audiobook', daysAgoEnd: 35  },
  { isbn: '978-0-14-130800-5', title: 'The BFG',                    author: 'Roald Dahl',          genre: 'Children',        format: 'ebook',     daysAgoEnd: 55  },
  { isbn: '978-0-8109-9313-8', title: 'Diary of a Wimpy Kid',       author: 'Jeff Kinney',         genre: 'Children',        format: 'ebook',     daysAgoEnd: 78  },
  // Recent digital reads — ebooks for convenience
  { isbn: '978-0-7432-7356-5', title: 'The Great Gatsby',           author: 'F. Scott Fitzgerald', genre: 'Fiction',         format: 'ebook',     daysAgoEnd: 18  },
  { isbn: '978-0-441-17271-9', title: 'Dune Messiah',               author: 'Frank Herbert',       genre: 'Science Fiction', format: 'ebook',     daysAgoEnd: 120 },
  { isbn: '978-0-618-57495-8', title: 'The Two Towers',             author: 'J.R.R. Tolkien',      genre: 'Fantasy',         format: 'audiobook', daysAgoEnd: 145 },
  // Harry Potter audiobook re-read
  { isbn: '978-0-439-06486-6', title: "Harry Potter and the Chamber of Secrets", author: 'J.K. Rowling', genre: 'Fantasy', format: 'audiobook', daysAgoEnd: 25 },
];

for (const entry of DIGITAL_EXTRA) {
  const checkout   = daysAgo(entry.daysAgoEnd + 21);
  const dueDate    = daysAgo(entry.daysAgoEnd);
  await putLoan({
    isbn: entry.isbn, userId: SINDHUJA.userId, userName: SINDHUJA.name, userEmail: SINDHUJA.email,
    bookTitle: entry.title, bookAuthor: entry.author, bookGenre: entry.genre,
    checkoutDate: checkout, returnDueDate: dueDate, returnedDate: dueDate,
    status: 'returned', renewalCount: 0, format: entry.format,
  });
  console.log(`  returned  [${entry.format.padEnd(9)}] "${entry.title}"`);
}

// ─── summary ────────────────────────────────────────────────────────────────

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Done — ${written} items written to ${TABLE}

Sindhuja K <onvsindhu@gmail.com>
  userId : ${SINDHUJA.userId}
  History: 20 returned loans spanning ~6 months
    Format progression: physical (oldest) → audiobook (commuting) → ebook + audiobook (recent)
    Audiobook reads: 1984, Dune, HP Sorcerer's Stone, Hitchhiker's Guide, Educated,
                     Matilda, Charlotte's Web, HP Chamber of Secrets, The Two Towers
    Ebook reads:     Gone Girl, Sapiens, Atomic Habits, Great Gatsby, Dune Messiah,
                     The BFG, Diary of a Wimpy Kid
    Physical reads:  Fellowship of the Ring, The Hobbit, And Then There Were None, HP Chamber

Active loans (due TODAY):
  📚 Physical  — "Murder on the Orient Express" (will auto-renew)
  📱 eBook     — "A Brief History of Time"     (will auto-renew — digital, no copy change)

Emails that will fire next time loanLifecycleAgent runs:
  ✉ Auto-renewal #1 — "Murder on the Orient Express"
  ✉ Auto-renewal #2 — "A Brief History of Time"
  ✉ Hold available  — "The Midnight Library"
              (Priya Mehta is the current borrower, due today, hold queue exists)

To trigger the emails immediately, invoke the loanLifecycleAgent Lambda:
  aws lambda invoke --function-name library-dev-loanLifecycleAgent \\
    --region ${REGION} /dev/null
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
