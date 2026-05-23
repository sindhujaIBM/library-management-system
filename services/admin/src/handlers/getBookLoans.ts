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
    ExpressionAttributeValues: { ':pk': `LOAN#${isbn}` },
    ScanIndexForward: false,
  }));

  const today = new Date().toISOString().split('T')[0];
  const loans = (result.Items ?? []).map(item => ({
    loanId: item.loanId,
    userId: item.userId,
    userEmail: item.userEmail,
    userName: item.userName,
    checkoutDate: item.checkoutDate,
    returnDueDate: item.returnDueDate,
    returnedDate: item.returnedDate,
    status: item.status,
    renewalCount: item.renewalCount,
    loanSK: item.SK,
    isOverdue: item.status === 'active' && item.returnDueDate < today,
  }));

  return ok({ loans, ISBN: isbn });
}, 'librarian');
