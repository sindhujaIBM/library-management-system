/**
 * Seed script — populates the DynamoDB dev table with sample books.
 *
 * Usage:
 *   node scripts/seed.mjs
 *
 * Requires:
 *   - AWS credentials configured (aws configure, or env vars AWS_ACCESS_KEY_ID etc.)
 *   - DYNAMO_TABLE env var set, or defaults to library-dev
 *   - The table must already exist (deploy services/books first)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { readFileSync } from 'fs';

const TABLE = process.env.DYNAMO_TABLE || 'library-dev';
const REGION = process.env.AWS_REGION || 'ca-west-1';

const base = new DynamoDBClient({ region: REGION });
const db = DynamoDBDocumentClient.from(base, { marshallOptions: { removeUndefinedValues: true } });

const now = new Date().toISOString();

const BOOKS = [
  // ── Fiction / Classics ─────────────────────────────────────────────────────
  {
    ISBN: '978-0-06-112008-4',
    title: 'To Kill a Mockingbird',
    author: 'Harper Lee',
    genre: 'Fiction',
    totalCopies: 3,
    releaseDate: '1960-07-11',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780061120084-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-0-14-028329-7',
    title: '1984',
    author: 'George Orwell',
    genre: 'Science Fiction',
    totalCopies: 4,
    releaseDate: '1949-06-08',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780140283297-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-0-7432-7356-5',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    genre: 'Fiction',
    totalCopies: 2,
    releaseDate: '1925-04-10',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780743273565-M.jpg',
    formats: ['physical', 'ebook'],
  },
  {
    ISBN: '978-0-316-76948-0',
    title: 'The Catcher in the Rye',
    author: 'J.D. Salinger',
    genre: 'Fiction',
    totalCopies: 2,
    releaseDate: '1951-07-16',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780316769488-M.jpg',
    formats: ['physical'],
  },
  // ── Fantasy / Sci-Fi ───────────────────────────────────────────────────────
  {
    ISBN: '978-0-7432-7357-2',
    title: 'The Hobbit',
    author: 'J.R.R. Tolkien',
    genre: 'Fantasy',
    series: 'Middle-earth',
    seriesPosition: 1,
    totalCopies: 3,
    releaseDate: '1937-09-21',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780547928227-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-0-618-57494-1',
    title: 'The Fellowship of the Ring',
    author: 'J.R.R. Tolkien',
    genre: 'Fantasy',
    series: 'The Lord of the Rings',
    seriesPosition: 1,
    totalCopies: 2,
    releaseDate: '1954-07-29',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-0-618-57495-8',
    title: 'The Two Towers',
    author: 'J.R.R. Tolkien',
    genre: 'Fantasy',
    series: 'The Lord of the Rings',
    seriesPosition: 2,
    totalCopies: 2,
    releaseDate: '1954-11-11',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-0-7432-7358-9',
    title: 'Dune',
    author: 'Frank Herbert',
    genre: 'Science Fiction',
    series: 'Dune',
    seriesPosition: 1,
    totalCopies: 3,
    releaseDate: '1965-08-01',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780441013593-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-0-441-17271-9',
    title: 'Dune Messiah',
    author: 'Frank Herbert',
    genre: 'Science Fiction',
    series: 'Dune',
    seriesPosition: 2,
    totalCopies: 2,
    releaseDate: '1969-06-01',
    formats: ['physical', 'ebook'],
  },
  {
    ISBN: '978-0-14-028428-7',
    title: 'The Hitchhiker\'s Guide to the Galaxy',
    author: 'Douglas Adams',
    genre: 'Science Fiction',
    series: 'Hitchhiker\'s Guide',
    seriesPosition: 1,
    totalCopies: 3,
    releaseDate: '1979-10-12',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780330258647-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  // ── Mystery ────────────────────────────────────────────────────────────────
  {
    ISBN: '978-0-7432-7359-6',
    title: 'Gone Girl',
    author: 'Gillian Flynn',
    genre: 'Mystery',
    totalCopies: 3,
    releaseDate: '2012-06-05',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780307588371-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-0-06-093546-9',
    title: 'Murder on the Orient Express',
    author: 'Agatha Christie',
    genre: 'Mystery',
    totalCopies: 2,
    releaseDate: '1934-01-01',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780062693662-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-1-250-30177-4',
    title: 'And Then There Were None',
    author: 'Agatha Christie',
    genre: 'Mystery',
    totalCopies: 3,
    releaseDate: '1939-11-01',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9781250301772-M.jpg',
    formats: ['physical', 'ebook'],
  },
  // ── Non-Fiction ────────────────────────────────────────────────────────────
  {
    ISBN: '978-0-525-55360-5',
    title: 'The Midnight Library',
    author: 'Matt Haig',
    genre: 'Fiction',
    totalCopies: 4,
    releaseDate: '2020-09-29',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780525559474-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-0-385-54734-9',
    title: 'Educated',
    author: 'Tara Westover',
    genre: 'Biography',
    totalCopies: 2,
    releaseDate: '2018-02-20',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780399590504-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-0-593-31012-3',
    title: 'Atomic Habits',
    author: 'James Clear',
    genre: 'Self-Help',
    totalCopies: 3,
    releaseDate: '2018-10-16',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780735211292-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-0-7432-7360-2',
    title: 'Sapiens',
    author: 'Yuval Noah Harari',
    genre: 'History',
    totalCopies: 3,
    releaseDate: '2011-01-01',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780062316097-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-0-8129-9429-2',
    title: 'A Brief History of Time',
    author: 'Stephen Hawking',
    genre: 'Science',
    totalCopies: 2,
    releaseDate: '1988-04-01',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780812994293-M.jpg',
    formats: ['physical', 'ebook'],
  },
  // ── Harry Potter ───────────────────────────────────────────────────────────
  {
    ISBN: '978-0-439-02348-1',
    title: 'Harry Potter and the Sorcerer\'s Stone',
    author: 'J.K. Rowling',
    genre: 'Fantasy',
    series: 'Harry Potter',
    seriesPosition: 1,
    totalCopies: 5,
    releaseDate: '1997-06-26',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780439023481-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-0-439-06486-6',
    title: 'Harry Potter and the Chamber of Secrets',
    author: 'J.K. Rowling',
    genre: 'Fantasy',
    series: 'Harry Potter',
    seriesPosition: 2,
    totalCopies: 4,
    releaseDate: '1998-07-02',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780439064866-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  // ── Children's Books ───────────────────────────────────────────────────────
  {
    ISBN: '978-0-399-22671-4',
    title: 'The Very Hungry Caterpillar',
    author: 'Eric Carle',
    genre: 'Children',
    totalCopies: 4,
    releaseDate: '1969-06-03',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780399226717-M.jpg',
    formats: ['physical', 'ebook'],
  },
  {
    ISBN: '978-0-06-025492-6',
    title: 'Where the Wild Things Are',
    author: 'Maurice Sendak',
    genre: 'Children',
    totalCopies: 3,
    releaseDate: '1963-04-09',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780060254926-M.jpg',
    formats: ['physical', 'ebook'],
  },
  {
    ISBN: '978-0-06-440055-8',
    title: "Charlotte's Web",
    author: 'E.B. White',
    genre: 'Children',
    totalCopies: 4,
    releaseDate: '1952-10-15',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780064400558-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-0-06-028765-8',
    title: 'Goodnight Moon',
    author: 'Margaret Wise Brown',
    genre: 'Children',
    totalCopies: 5,
    releaseDate: '1947-09-03',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780060287658-M.jpg',
    formats: ['physical', 'ebook'],
  },
  {
    ISBN: '978-0-394-80001-1',
    title: 'The Cat in the Hat',
    author: 'Dr. Seuss',
    genre: 'Children',
    totalCopies: 5,
    releaseDate: '1957-03-12',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780394800011-M.jpg',
    formats: ['physical', 'ebook'],
  },
  {
    ISBN: '978-0-394-80016-5',
    title: 'Green Eggs and Ham',
    author: 'Dr. Seuss',
    genre: 'Children',
    totalCopies: 4,
    releaseDate: '1960-08-12',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780394800165-M.jpg',
    formats: ['physical', 'ebook'],
  },
  {
    ISBN: '978-0-14-034488-5',
    title: 'Matilda',
    author: 'Roald Dahl',
    genre: 'Children',
    totalCopies: 4,
    releaseDate: '1988-10-01',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780140344882-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-0-14-130800-5',
    title: 'The BFG',
    author: 'Roald Dahl',
    genre: 'Children',
    totalCopies: 3,
    releaseDate: '1982-09-01',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780141308005-M.jpg',
    formats: ['physical', 'audiobook', 'ebook'],
  },
  {
    ISBN: '978-0-8109-9313-8',
    title: 'Diary of a Wimpy Kid',
    author: 'Jeff Kinney',
    genre: 'Children',
    series: 'Diary of a Wimpy Kid',
    seriesPosition: 1,
    totalCopies: 5,
    releaseDate: '2007-04-01',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780810993136-M.jpg',
    formats: ['physical', 'ebook'],
  },
  {
    ISBN: '978-0-590-84627-9',
    title: 'The Adventures of Captain Underpants',
    author: 'Dav Pilkey',
    genre: 'Children',
    series: 'Captain Underpants',
    seriesPosition: 1,
    totalCopies: 4,
    releaseDate: '1997-09-01',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780590846271-M.jpg',
    formats: ['physical', 'ebook'],
  },
  {
    ISBN: '978-0-316-38060-1',
    title: 'The Polar Express',
    author: 'Chris Van Allsburg',
    genre: 'Children',
    totalCopies: 3,
    releaseDate: '1985-10-28',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780316380607-M.jpg',
    formats: ['physical', 'ebook'],
  },
  {
    ISBN: '978-0-7636-4699-7',
    title: 'The Invention of Hugo Cabret',
    author: 'Brian Selznick',
    genre: 'Children',
    totalCopies: 2,
    releaseDate: '2007-01-30',
    coverImageUrl: 'https://covers.openlibrary.org/b/isbn/9780439813785-M.jpg',
    formats: ['physical'],
  },
];

async function seedBook(book) {
  const existing = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `BOOK#${book.ISBN}`, SK: 'METADATA' },
  }));

  if (existing.Item) {
    // Backfill formats on existing books that don't have them yet
    if (!existing.Item.formats) {
      await db.send(new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `BOOK#${book.ISBN}`, SK: 'METADATA' },
        UpdateExpression: 'SET formats = :f, updatedAt = :now',
        ExpressionAttributeValues: { ':f': book.formats ?? ['physical'], ':now': now },
      }));
      console.log(`  updated formats  ${book.title}`);
    } else {
      console.log(`  skip  ${book.title} (already exists)`);
    }
    return;
  }

  await db.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `BOOK#${book.ISBN}`,
      SK: 'METADATA',
      entityType: 'BOOK',
      availableCopies: book.totalCopies,
      copiesOnLoan: 0,
      createdAt: now,
      updatedAt: now,
      formats: book.formats ?? ['physical'],
      ...book,
    },
  }));
  console.log(`  added  ${book.title}`);
}

console.log(`\nSeeding ${TABLE} in ${REGION}...\n`);

try {
  for (const book of BOOKS) {
    await seedBook(book);
  }
  console.log(`\n✓ Done — ${BOOKS.length} books processed.\n`);
} catch (err) {
  console.error('\n✗ Error:', err.message);
  console.error('\nMake sure:\n  1. AWS credentials are configured (aws configure)\n  2. The DynamoDB table exists (deploy services/books first)\n  3. DYNAMO_TABLE env var matches the table name\n');
  process.exit(1);
}
