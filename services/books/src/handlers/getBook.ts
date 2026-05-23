import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamo, TABLE, toErrorResponse, corsOrigin, NotFoundError, ValidationError } from '@library/shared';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const origin = corsOrigin(event);
  try {
    const isbn = event.pathParameters?.isbn;
    if (!isbn) throw new ValidationError('isbn is required');

    const db = getDynamo();

    const [bookResult, holdsResult] = await Promise.all([
      db.send(new GetCommand({ TableName: TABLE, Key: { PK: `BOOK#${isbn}`, SK: 'METADATA' } })),
      db.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `WAITLIST#${isbn}` },
      })),
    ]);

    if (!bookResult.Item) throw new NotFoundError('Book not found');

    const holdCount = holdsResult.Items?.length ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { PK, SK, entityType, ...book } = bookResult.Item;

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { ...book, holdCount } }),
    };
  } catch (err) {
    return toErrorResponse(err, origin);
  }
}
