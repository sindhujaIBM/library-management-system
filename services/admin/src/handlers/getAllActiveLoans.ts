import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, ok, getDynamo, TABLE } from '@library/shared';

export const handler = withAuth(async (_event: APIGatewayProxyEvent, _auth) => {
  const db = getDynamo();
  const today = new Date().toISOString();

  const result = await db.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI4-status-returnDueDate',
    KeyConditionExpression: '#status = :active',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':active': 'active' },
  }));

  const loans = (result.Items ?? []).map(item => ({
    loanId: item.loanId,
    ISBN: item.ISBN,
    bookTitle: item.bookTitle,
    bookAuthor: item.bookAuthor,
    userId: item.userId,
    userEmail: item.userEmail,
    userName: item.userName,
    checkoutDate: item.checkoutDate,
    returnDueDate: item.returnDueDate,
    renewalCount: item.renewalCount,
    loanSK: item.SK,
    isOverdue: item.returnDueDate < today,
  }));

  return ok({ loans, total: loans.length });
}, 'librarian');
