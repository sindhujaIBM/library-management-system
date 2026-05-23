import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, ok, getDynamo, TABLE, ValidationError } from '@library/shared';

export const handler = withAuth(async (event: APIGatewayProxyEvent, _auth) => {
  const isbn = event.pathParameters?.isbn;
  if (!isbn) throw new ValidationError('isbn is required');

  const db = getDynamo();
  const result = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `WAITLIST#${isbn}` },
  }));

  const holds = (result.Items ?? [])
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
    .map((item, index) => ({
      userId: item.userId,
      userEmail: item.userEmail,
      userName: item.userName,
      joinedAt: item.joinedAt,
      position: index + 1,
    }));

  return ok({ holds, ISBN: isbn, total: holds.length });
}, 'librarian');
