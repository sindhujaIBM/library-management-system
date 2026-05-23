import { ScanCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { getDynamo, TABLE } from '@library/shared';

const HOLD_THRESHOLD = 5;

export const handler = async (): Promise<void> => {
  const db = getDynamo();

  // Collect all WAITLIST items with pagination
  const allWaitlist: { PK: string }[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'entityType = :et',
      ExpressionAttributeValues: { ':et': 'WAITLIST' },
      ProjectionExpression: 'PK',
      ExclusiveStartKey: lastKey,
    }));
    allWaitlist.push(...((result.Items ?? []) as { PK: string }[]));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  // Group by ISBN and count holds
  const holdsByISBN: Record<string, number> = {};
  for (const item of allWaitlist) {
    const isbn = item.PK.replace('WAITLIST#', '');
    holdsByISBN[isbn] = (holdsByISBN[isbn] ?? 0) + 1;
  }

  const highDemand = Object.entries(holdsByISBN).filter(([, count]) => count >= HOLD_THRESHOLD);
  if (highDemand.length === 0) {
    console.log('demandDetectionAgent: no books with 5+ holds');
    return;
  }

  // Load existing pending demand_order alerts to avoid duplicates
  const existingResult = await db.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI5-alertStatus-generatedAt',
    KeyConditionExpression: 'alertStatus = :status',
    ExpressionAttributeValues: { ':status': 'pending' },
    ProjectionExpression: 'alertISBN, #type',
    ExpressionAttributeNames: { '#type': 'type' },
  }));
  const pendingDemandISBNs = new Set(
    (existingResult.Items ?? [])
      .filter(a => a.type === 'demand_order')
      .map(a => a.alertISBN as string)
  );

  let created = 0;
  for (const [isbn, holdCount] of highDemand) {
    if (pendingDemandISBNs.has(isbn)) {
      console.log(`demandDetectionAgent: skipping ${isbn} — pending alert already exists`);
      continue;
    }

    const bookResult = await db.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `BOOK#${isbn}`, SK: 'METADATA' },
    }));
    if (!bookResult.Item) continue;

    const { title, author, totalCopies: currentCopies } = bookResult.Item as {
      title: string; author: string; totalCopies: number;
    };
    const recommendedCopiesOrdered = Math.ceil(holdCount / 3);
    const amazonSearchUrl = `https://www.amazon.ca/s?k=${encodeURIComponent(`${title} ${author}`)}`;
    const alertId = uuid();

    await db.send(new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `ALERT#${alertId}`,
        SK: 'METADATA',
        entityType: 'ALERT',
        alertId,
        type: 'demand_order',
        status: 'pending',
        alertStatus: 'pending',
        alertISBN: isbn,
        payload: {
          ISBN: isbn,
          title,
          author,
          currentCopies,
          holdQueueLength: holdCount,
          recommendedCopiesOrdered,
          amazonSearchUrl,
        },
        generatedAt: new Date().toISOString(),
      },
    }));
    created++;
    console.log(`demandDetectionAgent: created demand_order alert for "${title}" (${holdCount} holds)`);
  }

  console.log(`demandDetectionAgent: done — ${highDemand.length} high-demand books, ${created} new alerts`);
};
