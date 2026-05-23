/**
 * Scenario seed — rich demo data for testing all system behaviours.
 *
 * Run AFTER seed.mjs (requires the 19 base books to exist).
 *
 * Usage:
 *   node scripts/seed-scenarios.mjs
 *
 * Creates:
 *   - 10 member users
 *   - 10 stale books (not borrowed in 6+ months → stale inventory agent target)
 *   - 10 high-demand books (12+ loans each, 0 available, hold queues → demand agent target)
 *   - Loan history for all members spanning 6–12 months
 *   - 7 members with active loans approaching renewal (due in 2 days)
 *   - 3 members with loans due TODAY:
 *       member_08, member_09 → eligible for auto-renewal (no hold queue)
 *       member_10           → NOT eligible (hold queue exists)
 *   - 3 members with holds on high-demand books
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';

const TABLE  = process.env.DYNAMO_TABLE || 'library-dev';
const REGION = process.env.AWS_REGION   || 'ca-west-1';

const db = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

const DAY   = 24 * 60 * 60 * 1000;
const now   = new Date();
const today = now.toISOString();

function daysAgo(n)       { return new Date(now - n * DAY).toISOString(); }
function daysFromNow(n)   { return new Date(now.getTime() + n * DAY).toISOString(); }

// ─── helpers ────────────────────────────────────────────────────────────────

async function put(item) {
  await db.send(new PutCommand({ TableName: TABLE, Item: item }));
}

async function updateBook(isbn, available, onLoan, lastBorrowedDate) {
  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `BOOK#${isbn}`, SK: 'METADATA' },
    UpdateExpression: 'SET availableCopies = :a, copiesOnLoan = :l, lastBorrowedDate = :lb, updatedAt = :now',
    ExpressionAttributeValues: { ':a': available, ':l': onLoan, ':lb': lastBorrowedDate, ':now': today },
  }));
}

function loan({ isbn, userId, userName, userEmail, bookTitle, bookAuthor, checkoutDate, returnDueDate, status, returnedDate, renewalCount = 0 }) {
  const sk = `LOAN#${userId}#${checkoutDate}`;
  return {
    PK: `LOAN#${isbn}`, SK: sk,
    entityType: 'LOAN',
    loanId: uuid(),
    ISBN: isbn, userId, userEmail, userName, bookTitle, bookAuthor,
    checkoutDate, returnDueDate, returnedDate,
    status, renewalCount,
  };
}

function hold({ isbn, userId, userName, userEmail, joinedAt }) {
  return {
    PK: `WAITLIST#${isbn}`, SK: `USER#${userId}`,
    entityType: 'WAITLIST',
    ISBN: isbn, userId, userEmail, userName, joinedAt,
  };
}

// ─── 10 members ─────────────────────────────────────────────────────────────

const MEMBERS = [
  { userId: 'google_member_01', name: 'Alice Martin',   email: 'alice.martin@example.com' },
  { userId: 'google_member_02', name: 'Ben Thompson',   email: 'ben.thompson@example.com' },
  { userId: 'google_member_03', name: 'Carol Singh',    email: 'carol.singh@example.com' },
  { userId: 'google_member_04', name: 'David Kim',      email: 'david.kim@example.com' },
  { userId: 'google_member_05', name: 'Emma Wilson',    email: 'emma.wilson@example.com' },
  { userId: 'google_member_06', name: 'Frank Patel',    email: 'frank.patel@example.com' },
  { userId: 'google_member_07', name: 'Grace Lee',      email: 'grace.lee@example.com' },
  { userId: 'google_member_08', name: 'Henry Brown',    email: 'henry.brown@example.com' },
  { userId: 'google_member_09', name: 'Isabelle Chen',  email: 'isabelle.chen@example.com' },
  { userId: 'google_member_10', name: 'James Taylor',   email: 'james.taylor@example.com' },
];

// ─── 10 stale books ─────────────────────────────────────────────────────────
// Not borrowed in 7–13 months → triggers stale inventory agent

const STALE_BOOKS = [
  { ISBN: '978-0-684-80122-3', title: 'The Old Man and the Sea',   author: 'Ernest Hemingway',  genre: 'Fiction',         totalCopies: 2, lastBorrowedDate: daysAgo(210) },
  { ISBN: '978-0-06-085052-4', title: 'Brave New World',          author: 'Aldous Huxley',      genre: 'Science Fiction', totalCopies: 3, lastBorrowedDate: daysAgo(240) },
  { ISBN: '978-0-571-19152-0', title: 'Lord of the Flies',        author: 'William Golding',    genre: 'Fiction',         totalCopies: 2, lastBorrowedDate: daysAgo(270) },
  { ISBN: '978-0-14-018737-6', title: 'Of Mice and Men',          author: 'John Steinbeck',     genre: 'Fiction',         totalCopies: 2, lastBorrowedDate: daysAgo(300) },
  { ISBN: '978-0-7432-4722-1', title: 'Fahrenheit 451',          author: 'Ray Bradbury',        genre: 'Science Fiction', totalCopies: 3, lastBorrowedDate: daysAgo(225) },
  { ISBN: '978-0-14-303943-3', title: 'The Grapes of Wrath',     author: 'John Steinbeck',     genre: 'Fiction',         totalCopies: 2, lastBorrowedDate: daysAgo(260) },
  { ISBN: '978-0-14-028227-6', title: 'East of Eden',            author: 'John Steinbeck',     genre: 'Fiction',         totalCopies: 2, lastBorrowedDate: daysAgo(320) },
  { ISBN: '978-0-06-083450-7', title: 'The Bell Jar',            author: 'Sylvia Plath',       genre: 'Fiction',         totalCopies: 2, lastBorrowedDate: daysAgo(290) },
  { ISBN: '978-0-14-143955-6', title: 'Wuthering Heights',       author: 'Emily Brontë',       genre: 'Fiction',         totalCopies: 2, lastBorrowedDate: daysAgo(350) },
  { ISBN: '978-0-14-144114-6', title: 'Jane Eyre',               author: 'Charlotte Brontë',   genre: 'Fiction',         totalCopies: 2, lastBorrowedDate: daysAgo(280) },
];

// ─── 10 high-demand books ────────────────────────────────────────────────────
// 12 loans each (10 returned + 2 active), 0 available, hold queue of 4–5

const HIGH_DEMAND_BOOKS = [
  { ISBN: '978-0-593-13520-4', title: 'Project Hail Mary',                   author: 'Andy Weir',          genre: 'Science Fiction', totalCopies: 2 },
  { ISBN: '978-0-8041-3902-8', title: 'The Martian',                         author: 'Andy Weir',          genre: 'Science Fiction', totalCopies: 2 },
  { ISBN: '978-0-593-32121-1', title: 'Tomorrow, and Tomorrow, and Tomorrow', author: 'Gabrielle Zevin',    genre: 'Fiction',         totalCopies: 2 },
  { ISBN: '978-1-250-28769-2', title: 'Fourth Wing',                         author: 'Rebecca Yarros',     genre: 'Fantasy',         totalCopies: 2 },
  { ISBN: '978-0-385-54734-2', title: 'Lessons in Chemistry',                author: 'Bonnie Garmus',      genre: 'Fiction',         totalCopies: 2 },
  { ISBN: '978-1-984-82075-9', title: 'The Thursday Murder Club',            author: 'Richard Osman',      genre: 'Mystery',         totalCopies: 2 },
  { ISBN: '978-0-063-27409-8', title: 'Yellowface',                          author: 'R.F. Kuang',         genre: 'Fiction',         totalCopies: 2 },
  { ISBN: '978-0-593-44154-2', title: 'Happy Place',                         author: 'Emily Henry',        genre: 'Fiction',         totalCopies: 2 },
  { ISBN: '978-1-250-28773-9', title: 'Iron Flame',                          author: 'Rebecca Yarros',     genre: 'Fantasy',         totalCopies: 2 },
  { ISBN: '978-1-668-02123-8', title: 'Holly',                               author: 'Stephen King',       genre: 'Mystery',         totalCopies: 2 },
];

// High-demand books where members 1-3 have holds (first 3)
const [HD_ALICE, HD_BEN, HD_CAROL] = HIGH_DEMAND_BOOKS;

// Books assigned to each member for their CURRENT active scenario loan
// (all checked out 19 days ago → due in 2 days)
const APPROACHING_RENEWAL = [
  { member: MEMBERS[0], isbn: '978-0-14-028329-7', title: '1984',                     author: 'George Orwell' },
  { member: MEMBERS[1], isbn: '978-0-7432-7356-5', title: 'The Great Gatsby',         author: 'F. Scott Fitzgerald' },
  { member: MEMBERS[2], isbn: '978-0-7432-7359-6', title: 'Gone Girl',                author: 'Gillian Flynn' },
  { member: MEMBERS[3], isbn: '978-0-06-112008-4', title: 'To Kill a Mockingbird',    author: 'Harper Lee' },
  { member: MEMBERS[4], isbn: '978-0-316-76948-0', title: 'The Catcher in the Rye',  author: 'J.D. Salinger' },
  { member: MEMBERS[5], isbn: '978-0-7432-7357-2', title: 'The Hobbit',              author: 'J.R.R. Tolkien' },
  { member: MEMBERS[6], isbn: '978-0-385-54734-9', title: 'Educated',                author: 'Tara Westover' },
];

// Books for due-today scenarios
const DUE_TODAY = [
  { member: MEMBERS[7], isbn: '978-0-525-55360-5', title: 'The Midnight Library', author: 'Matt Haig',        autoRenew: true },
  { member: MEMBERS[8], isbn: '978-0-7432-7360-2', title: 'Sapiens',             author: 'Yuval Noah Harari', autoRenew: true },
  { member: MEMBERS[9], isbn: '978-0-593-31012-3', title: 'Atomic Habits',       author: 'James Clear',       autoRenew: false },
];

// Books used for historical loans (cycling through existing catalog)
const HISTORY_BOOKS = [
  { isbn: '978-0-7432-7358-9', title: 'Dune',                              author: 'Frank Herbert' },
  { isbn: '978-0-14-028428-7', title: "The Hitchhiker's Guide to the Galaxy", author: 'Douglas Adams' },
  { isbn: '978-0-439-02348-1', title: "Harry Potter and the Sorcerer's Stone", author: 'J.K. Rowling' },
  { isbn: '978-1-250-30177-4', title: 'And Then There Were None',          author: 'Agatha Christie' },
  { isbn: '978-0-618-57494-1', title: 'The Fellowship of the Ring',        author: 'J.R.R. Tolkien' },
  { isbn: '978-0-441-17271-9', title: 'Dune Messiah',                      author: 'Frank Herbert' },
  { isbn: '978-0-618-57495-8', title: 'The Two Towers',                   author: 'J.R.R. Tolkien' },
  { isbn: '978-0-8129-9429-2', title: 'A Brief History of Time',           author: 'Stephen Hawking' },
  { isbn: '978-0-439-06486-6', title: 'Harry Potter and the Chamber of Secrets', author: 'J.K. Rowling' },
];

// ─── main ───────────────────────────────────────────────────────────────────

let written = 0;
async function write(item) {
  await put(item);
  written++;
}

console.log(`\nSeeding scenarios into ${TABLE} (${REGION})...\n`);

// 1. Members
console.log('── Members ──────────────────────────────────');
for (const m of MEMBERS) {
  const existing = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${m.userId}`, SK: 'METADATA' } }));
  if (existing.Item) { console.log(`  skip  ${m.name}`); continue; }
  await write({
    PK: `USER#${m.userId}`, SK: 'METADATA',
    entityType: 'USER', role: 'member',
    userId: m.userId, email: m.email, name: m.name,
    googleId: m.userId.replace('google_', ''),
    createdAt: daysAgo(365), updatedAt: today,
  });
  console.log(`  added ${m.name}`);
}

// 2. Stale books
console.log('\n── Stale books (inactive 7–12 months) ──────');
for (const b of STALE_BOOKS) {
  const existing = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `BOOK#${b.ISBN}`, SK: 'METADATA' } }));
  if (existing.Item) { console.log(`  skip  ${b.title}`); continue; }
  await write({
    PK: `BOOK#${b.ISBN}`, SK: 'METADATA',
    entityType: 'BOOK', ISBN: b.ISBN, title: b.title, author: b.author, genre: b.genre,
    totalCopies: b.totalCopies, availableCopies: b.totalCopies, copiesOnLoan: 0,
    lastBorrowedDate: b.lastBorrowedDate,
    createdAt: daysAgo(400), updatedAt: today,
  });
  console.log(`  added ${b.title} (last borrowed ${Math.round((now - new Date(b.lastBorrowedDate)) / DAY)}d ago)`);
}

// 3. High-demand books
console.log('\n── High-demand books (0 available, hold queues) ──');
for (const b of HIGH_DEMAND_BOOKS) {
  const existing = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `BOOK#${b.ISBN}`, SK: 'METADATA' } }));
  if (existing.Item) { console.log(`  skip  ${b.title}`); continue; }
  await write({
    PK: `BOOK#${b.ISBN}`, SK: 'METADATA',
    entityType: 'BOOK', ISBN: b.ISBN, title: b.title, author: b.author, genre: b.genre,
    totalCopies: b.totalCopies,
    availableCopies: 0,   // all copies out
    copiesOnLoan: b.totalCopies,
    lastBorrowedDate: daysAgo(3),
    createdAt: daysAgo(400), updatedAt: today,
  });
  console.log(`  added ${b.title}`);
}

// 4. Historical returned loans — all 10 members, 5 loans each over 6–12 months
console.log('\n── Historical loans (6–12 months) ──────────');
for (let mi = 0; mi < MEMBERS.length; mi++) {
  const m = MEMBERS[mi];
  for (let i = 0; i < 5; i++) {
    const book      = HISTORY_BOOKS[(mi + i) % HISTORY_BOOKS.length];
    const offset    = 180 + (mi * 17) + (i * 30); // spread across 6–12 months ago
    const checkout  = daysAgo(offset + 21);
    const due       = daysAgo(offset);
    await write(loan({
      isbn: book.isbn, userId: m.userId, userName: m.name, userEmail: m.email,
      bookTitle: book.title, bookAuthor: book.author,
      checkoutDate: checkout, returnDueDate: due, returnedDate: due,
      status: 'returned', renewalCount: 0,
    }));
  }
  console.log(`  ${m.name}: 5 returned loans`);
}

// 5. High-demand book loans — 10 returned + 2 active per book = 12 total
console.log('\n── High-demand loan history (10 returned + 2 active per book) ──');
for (let bi = 0; bi < HIGH_DEMAND_BOOKS.length; bi++) {
  const book = HIGH_DEMAND_BOOKS[bi];

  // 10 returned loans — cycle through members at monthly intervals
  for (let i = 0; i < 10; i++) {
    const m        = MEMBERS[i % MEMBERS.length];
    const offset   = 30 * (10 - i) + bi * 3; // 3–10 months ago, staggered by book
    const checkout = daysAgo(offset + 21);
    const due      = daysAgo(offset);
    await write(loan({
      isbn: book.ISBN, userId: m.userId, userName: m.name, userEmail: m.email,
      bookTitle: book.title, bookAuthor: book.author,
      checkoutDate: checkout, returnDueDate: due, returnedDate: due,
      status: 'returned', renewalCount: i > 4 ? 1 : 0,
    }));
  }

  // 2 active loans — 2 members currently holding this book (checked out ~10 days ago)
  const borrowers = [MEMBERS[(bi * 2) % 10], MEMBERS[(bi * 2 + 1) % 10]];
  for (const m of borrowers) {
    const checkout = daysAgo(10 + bi);
    const due      = daysFromNow(11 - bi);
    await write(loan({
      isbn: book.ISBN, userId: m.userId, userName: m.name, userEmail: m.email,
      bookTitle: book.title, bookAuthor: book.author,
      checkoutDate: checkout, returnDueDate: due,
      status: 'active', renewalCount: 0,
    }));
  }

  console.log(`  ${book.title}: 12 loans, 2 active`);
}

// 6. Hold queues on high-demand books (4–5 people per book)
console.log('\n── Hold queues on high-demand books ────────');
for (let bi = 0; bi < HIGH_DEMAND_BOOKS.length; bi++) {
  const book = HIGH_DEMAND_BOOKS[bi];
  // 4 members on each hold queue, offset so different members queue different books
  for (let qi = 0; qi < 4; qi++) {
    const m = MEMBERS[(bi + qi + 2) % 10];
    await write(hold({
      isbn: book.ISBN, userId: m.userId, userName: m.name, userEmail: m.email,
      joinedAt: daysAgo(4 - qi),
    }));
  }
  console.log(`  ${book.title}: 4 holds`);
}

// 7. Specific holds for members 1–3 on first 3 high-demand books
//    (these are ON TOP of the queue above — placeHold prevents duplicates in the app
//    but seed writes directly so we check first)
console.log('\n── Named holds (members 1–3) ────────────────');
const NAMED_HOLDS = [
  { member: MEMBERS[0], book: HD_ALICE },
  { member: MEMBERS[1], book: HD_BEN },
  { member: MEMBERS[2], book: HD_CAROL },
];
for (const { member, book } of NAMED_HOLDS) {
  const existing = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `WAITLIST#${book.ISBN}`, SK: `USER#${member.userId}` },
  }));
  if (existing.Item) {
    console.log(`  skip  ${member.name} → ${book.title}`);
  } else {
    await write(hold({
      isbn: book.ISBN, userId: member.userId, userName: member.name, userEmail: member.email,
      joinedAt: daysAgo(1),
    }));
    console.log(`  ${member.name} → hold on "${book.title}"`);
  }
}

// 8. Approaching-renewal active loans (members 1–7, checked out 14 days ago, due in 7 days)
console.log('\n── Approaching renewal (due in 7 days) ─────');
for (const { member: m, isbn, title, author } of APPROACHING_RENEWAL) {
  // Delete any existing active loan for this member+book before recreating
  // (the checkoutDate is part of the SK so date changes require delete+recreate)
  const existing = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk',
    FilterExpression: 'userId = :uid AND #s = :active',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':pk': `LOAN#${isbn}`, ':uid': m.userId, ':active': 'active' },
  }));
  for (const item of existing.Items ?? []) {
    await db.send(new DeleteCommand({ TableName: TABLE, Key: { PK: item.PK, SK: item.SK } }));
  }

  const checkout = daysAgo(14);
  const due      = daysFromNow(7);
  await write(loan({
    isbn, userId: m.userId, userName: m.name, userEmail: m.email,
    bookTitle: title, bookAuthor: author,
    checkoutDate: checkout, returnDueDate: due,
    status: 'active', renewalCount: 0,
  }));
  // Update book availability
  const bookItem = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `BOOK#${isbn}`, SK: 'METADATA' } }));
  if (bookItem.Item) {
    const avail  = Math.max(0, (bookItem.Item.availableCopies ?? bookItem.Item.totalCopies) - 1);
    const onLoan = (bookItem.Item.copiesOnLoan ?? 0) + 1;
    await updateBook(isbn, avail, onLoan, checkout);
  }
  console.log(`  ${m.name} → "${title}" due ${due.slice(0, 10)}`);
}

// 9. Due-in-5-days loans (members 8–10, checked out 16 days ago)
console.log('\n── Due in 5 days / auto-renewal eligible ───');
for (const { member: m, isbn, title, author, autoRenew } of DUE_TODAY) {
  // Delete any existing active loan for this member+book before recreating
  const existing = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk',
    FilterExpression: 'userId = :uid AND #s = :active',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':pk': `LOAN#${isbn}`, ':uid': m.userId, ':active': 'active' },
  }));
  for (const item of existing.Items ?? []) {
    await db.send(new DeleteCommand({ TableName: TABLE, Key: { PK: item.PK, SK: item.SK } }));
  }

  const checkout = daysAgo(16);
  const due      = daysFromNow(5);
  await write(loan({
    isbn, userId: m.userId, userName: m.name, userEmail: m.email,
    bookTitle: title, bookAuthor: author,
    checkoutDate: checkout, returnDueDate: due,
    status: 'active', renewalCount: 0,
  }));
  // Update book availability
  const bookItem = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `BOOK#${isbn}`, SK: 'METADATA' } }));
  if (bookItem.Item) {
    const avail  = Math.max(0, (bookItem.Item.availableCopies ?? bookItem.Item.totalCopies) - 1);
    const onLoan = (bookItem.Item.copiesOnLoan ?? 0) + 1;
    await updateBook(isbn, avail, onLoan, checkout);
  }
  const dueLabel = `due ${due.slice(0, 10)}`;
  console.log(`  ${m.name} → "${title}" ${dueLabel} — ${autoRenew ? '✓ eligible for auto-renewal' : '✗ hold exists, no renewal'}`);
}

// 10. Hold on Atomic Habits from member_04 (blocks member_10 auto-renewal)
console.log('\n── Blocking hold on Atomic Habits ──────────');
const atomicHabitsISBN = '978-0-593-31012-3';
const blocker = MEMBERS[3]; // David Kim
const blockHoldKey = { PK: `WAITLIST#${atomicHabitsISBN}`, SK: `USER#${blocker.userId}` };
const existingBlock = await db.send(new GetCommand({ TableName: TABLE, Key: blockHoldKey }));
if (existingBlock.Item) {
  console.log(`  skip  ${blocker.name} already on hold for Atomic Habits`);
} else {
  await write(hold({
    isbn: atomicHabitsISBN, userId: blocker.userId, userName: blocker.name, userEmail: blocker.email,
    joinedAt: daysAgo(2),
  }));
  console.log(`  ${blocker.name} → hold on "Atomic Habits" (blocks James Taylor's auto-renewal)`);
}

// ─── summary ────────────────────────────────────────────────────────────────

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Done — ${written} items written to ${TABLE}

Scenarios ready to test:
  Admin Dashboard  → active loans (7 due in 7 days, 3 due in 5 days, 20 on high-demand)
  Overdue view     → 0 overdue (all within window)
  Stale inventory  → 10 books untouched for 7–12 months
  Demand detection → 10 books: 12 loans each, 0 available, 4-hold queues
  Hold queues      → Alice, Ben, Carol each waiting on a high-demand book
  Auto-renewal     → Henry + Isabelle due in 5 days, no holds → eligible for renewal
  No auto-renewal  → James due in 5 days, David is in hold queue → must return
  Loan insights    → 160+ loan records across 6 months of history
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
