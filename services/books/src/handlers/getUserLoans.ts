import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, ok, getDynamo, TABLE, ValidationError, ForbiddenError } from '@library/shared';

export const handler = withAuth(async (event: APIGatewayProxyEvent, auth) => {
  const userId = event.pathParameters?.userId;
  if (!userId) throw new ValidationError('userId is required');

  // Members can only view their own loans
  if (auth.userId !== userId && auth.role !== 'librarian') {
    throw new ForbiddenError('You can only view your own loans');
  }

  const db = getDynamo();

  const result = await db.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI3-userId-checkoutDate',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    ScanIndexForward: false, // newest first
  }));

  const today = new Date().toISOString().split('T')[0];
  const loans = (result.Items ?? []).map(item => ({
    loanId: item.loanId,
    ISBN: item.ISBN,
    bookTitle: item.bookTitle,
    bookAuthor: item.bookAuthor,
    checkoutDate: item.checkoutDate,
    returnDueDate: item.returnDueDate,
    returnedDate: item.returnedDate,
    status: item.status,
    renewalCount: item.renewalCount,
    loanSK: item.SK,
    format: item.format ?? 'physical',
    isOverdue: item.status === 'active' && item.returnDueDate < today,
  }));

  return ok({ loans });
});
