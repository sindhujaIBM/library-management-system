import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { NativeAttributeValue } from '@aws-sdk/util-dynamodb';
import { getDynamo, TABLE, toErrorResponse, corsOrigin } from '@library/shared';
import type { Book } from '@library/shared';

// Transparently page through all DynamoDB scan results.
// DynamoDB returns at most 1MB per call — without this, large catalogs
// would be silently truncated. For a library catalog this handles up to
// ~5000 books without exposing cursor pagination to the client.
async function scanAllBooks(): Promise<Book[]> {
  const db = getDynamo();
  const items: Book[] = [];
  let lastKey: Record<string, NativeAttributeValue> | undefined;
  const MAX = 5000;

  do {
    const result = await db.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'entityType = :et',
      ExpressionAttributeValues: { ':et': 'BOOK' },
      ExclusiveStartKey: lastKey,
    }));
    items.push(...((result.Items ?? []) as Book[]));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey && items.length < MAX);

  return items;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const origin = corsOrigin(event);
  try {
    const q = (event.queryStringParameters?.q ?? '').toLowerCase().trim();
    const genre = event.queryStringParameters?.genre ?? '';
    const author = event.queryStringParameters?.author ?? '';
    const availableOnly = event.queryStringParameters?.available === 'true';

    let books = await scanAllBooks();

    if (q) {
      books = books.filter(b =>
        b.title?.toLowerCase().includes(q) ||
        b.author?.toLowerCase().includes(q) ||
        b.genre?.toLowerCase().includes(q) ||
        b.series?.toLowerCase().includes(q)
      );
    }
    if (genre) books = books.filter(b => b.genre?.toLowerCase() === genre.toLowerCase());
    if (author) books = books.filter(b => b.author?.toLowerCase().includes(author.toLowerCase()));
    if (availableOnly) books = books.filter(b => b.availableCopies > 0);

    books.sort((a, b) => a.title.localeCompare(b.title));

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { books, total: books.length } }),
    };
  } catch (err) {
    return toErrorResponse(err, origin);
  }
}
