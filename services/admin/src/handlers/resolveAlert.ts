import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, ok, getDynamo, TABLE, ValidationError, NotFoundError } from '@library/shared';

export const handler = withAuth(async (event: APIGatewayProxyEvent, _auth) => {
  const alertId = event.pathParameters?.alertId;
  if (!alertId) throw new ValidationError('alertId is required');

  if (!event.body) throw new ValidationError('Request body is required');
  const body = JSON.parse(event.body) as { decision?: 'approved' | 'rejected' };
  if (!body.decision || !['approved', 'rejected'].includes(body.decision)) {
    throw new ValidationError('decision must be "approved" or "rejected"');
  }

  const db = getDynamo();

  const existing = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `ALERT#${alertId}`, SK: 'METADATA' },
  }));
  if (!existing.Item) throw new NotFoundError('Alert not found');
  if (existing.Item.status !== 'pending') {
    throw new ValidationError('Alert has already been resolved');
  }

  const resolvedAt = new Date().toISOString();
  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `ALERT#${alertId}`, SK: 'METADATA' },
    UpdateExpression: 'SET alertStatus = :status, #status = :status, resolvedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': body.decision, ':now': resolvedAt },
  }));

  return ok({ alertId, decision: body.decision, resolvedAt });
}, 'librarian');
