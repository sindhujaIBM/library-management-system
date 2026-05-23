import { ScanCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { getDynamo, TABLE } from '@library/shared';

const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
const SUGGESTED_PRICE_CAD = 4.0;

export const handler = async (): Promise<void> => {
  const db = getDynamo();
  const cutoff = new Date(Date.now() - SIX_MONTHS_MS).toISOString();

  // Collect all BOOK entities with pagination
  const allBooks: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'entityType = :et',
      ExpressionAttributeValues: { ':et': 'BOOK' },
      ProjectionExpression: 'ISBN, title, author, lastBorrowedDate, releaseDate, totalCopies',
      ExclusiveStartKey: lastKey,
    }));
    allBooks.push(...(result.Items ?? []));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  // Load existing pending stale_auction alerts to avoid duplicates
  const existingResult = await db.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI5-alertStatus-generatedAt',
    KeyConditionExpression: 'alertStatus = :status',
    ExpressionAttributeValues: { ':status': 'pending' },
    ProjectionExpression: 'alertISBN, #type',
    ExpressionAttributeNames: { '#type': 'type' },
  }));
  const pendingStaleISBNs = new Set(
    (existingResult.Items ?? [])
      .filter(a => a.type === 'stale_auction')
      .map(a => a.alertISBN as string)
  );

  let created = 0;
  for (const book of allBooks) {
    const isbn = book.ISBN as string;
    // Use lastBorrowedDate if available, fall back to releaseDate for books never borrowed
    const referenceDate = (book.lastBorrowedDate ?? book.releaseDate) as string | undefined;
    if (!referenceDate || referenceDate > cutoff) continue;
    if (pendingStaleISBNs.has(isbn)) {
      console.log(`staleInventoryAgent: skipping ${isbn} — pending alert already exists`);
      continue;
    }

    const daysSinceLastLoan = Math.floor(
      (Date.now() - new Date(referenceDate).getTime()) / (24 * 60 * 60 * 1000)
    );
    const alertId = uuid();

    await db.send(new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `ALERT#${alertId}`,
        SK: 'METADATA',
        entityType: 'ALERT',
        alertId,
        type: 'stale_auction',
        status: 'pending',
        alertStatus: 'pending',
        alertISBN: isbn,
        payload: {
          ISBN: isbn,
          title: book.title,
          author: book.author,
          lastBorrowedDate: referenceDate,
          daysSinceLastLoan,
          currentCopies: book.totalCopies,
          suggestedAction: 'Deaccession 1 copy via Friends of the Library book sale',
          suggestedStartingPriceCAD: SUGGESTED_PRICE_CAD,
        },
        generatedAt: new Date().toISOString(),
      },
    }));
    created++;
    console.log(
      `staleInventoryAgent: created stale_auction alert for "${book.title}" (${daysSinceLastLoan} days idle)`
    );
  }

  console.log(`staleInventoryAgent: done — ${allBooks.length} books checked, ${created} new alerts`);
};
