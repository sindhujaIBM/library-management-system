import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, ok, getDynamo, TABLE, ValidationError, NotFoundError } from '@library/shared';

export const handler = withAuth(async (event: APIGatewayProxyEvent, auth) => {
  const isbn = event.pathParameters?.isbn;
  if (!isbn) throw new ValidationError('isbn is required');

  const db = getDynamo();

  const existing = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `WAITLIST#${isbn}`, SK: `USER#${auth.userId}` },
  }));
  if (!existing.Item) throw new NotFoundError('Hold not found');

  await db.send(new DeleteCommand({
    TableName: TABLE,
    Key: { PK: `WAITLIST#${isbn}`, SK: `USER#${auth.userId}` },
  }));

  return ok({ cancelled: true, ISBN: isbn });
});
