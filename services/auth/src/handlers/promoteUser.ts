import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, ok, getDynamo, TABLE, NotFoundError, ValidationError } from '@library/shared';

export const handler = withAuth(async (event: APIGatewayProxyEvent, _auth) => {
  const userId = event.pathParameters?.userId;
  if (!userId) throw new ValidationError('userId is required');

  const body = JSON.parse(event.body || '{}') as { role?: string };
  if (body.role !== 'librarian' && body.role !== 'member') {
    throw new ValidationError('role must be "member" or "librarian"');
  }

  const db = getDynamo();

  const existing = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: 'METADATA' },
  }));

  if (!existing.Item) throw new NotFoundError('User not found');

  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: 'METADATA' },
    UpdateExpression: 'SET #role = :role, updatedAt = :now',
    ExpressionAttributeNames: { '#role': 'role' },
    ExpressionAttributeValues: { ':role': body.role, ':now': new Date().toISOString() },
  }));

  return ok({ userId, role: body.role });
}, 'librarian');
