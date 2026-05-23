import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, ok, getDynamo, TABLE, ValidationError } from '@library/shared';

export const handler = withAuth(async (event: APIGatewayProxyEvent, auth) => {
  const isbn = event.pathParameters?.isbn;
  if (!isbn) throw new ValidationError('isbn is required');

  const db = getDynamo();
  const result = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `WAITLIST#${isbn}`, SK: `USER#${auth.userId}` },
  }));

  return ok({ hold: result.Item ?? null });
});
