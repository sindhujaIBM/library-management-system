import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, ok, getDynamo, TABLE } from '@library/shared';

export const handler = withAuth(async (event: APIGatewayProxyEvent, _auth) => {
  const status = event.queryStringParameters?.status ?? 'pending';
  const db = getDynamo();

  const result = await db.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI5-alertStatus-generatedAt',
    KeyConditionExpression: 'alertStatus = :status',
    ExpressionAttributeValues: { ':status': status },
    ScanIndexForward: false, // newest first
  }));

  const alerts = (result.Items ?? []).map(item => ({
    alertId: item.alertId,
    type: item.type,
    status: item.status,
    payload: typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload,
    generatedAt: item.generatedAt,
    resolvedAt: item.resolvedAt,
  }));

  return ok({ alerts, total: alerts.length });
}, 'librarian');
