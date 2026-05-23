import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TransactWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, ok, getDynamo, TABLE, ValidationError, NotFoundError, ConflictError } from '@library/shared';

export const handler = withAuth(async (event: APIGatewayProxyEvent, auth) => {
  if (!event.body) throw new ValidationError('Request body is required');
  const body = JSON.parse(event.body) as { ISBN?: string; loanSK?: string };
  if (!body.ISBN) throw new ValidationError('ISBN is required');
  if (!body.loanSK) throw new ValidationError('loanSK is required');

  const db = getDynamo();

  // Find the loan
  const loanResult = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND SK = :sk',
    ExpressionAttributeValues: {
      ':pk': `LOAN#${body.ISBN}`,
      ':sk': body.loanSK,
    },
  }));

  const loan = loanResult.Items?.[0];
  if (!loan) throw new NotFoundError('Loan not found');
  if (loan.status !== 'active') throw new ConflictError('This loan is already returned');
  if (loan.userId !== auth.userId && auth.role !== 'librarian') {
    throw new ConflictError('You can only return your own loans');
  }

  const returnedDate = new Date().toISOString();

  // Check for hold queue — notify next person if applicable (SES would go here)
  const holdsResult = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `WAITLIST#${body.ISBN}` },
    Limit: 1,
  }));
  const hasHoldQueue = (holdsResult.Items?.length ?? 0) > 0;

  await db.send(new TransactWriteCommand({
    TransactItems: [
      {
        Update: {
          TableName: TABLE,
          Key: { PK: `BOOK#${body.ISBN}`, SK: 'METADATA' },
          UpdateExpression: 'SET availableCopies = availableCopies + :one, copiesOnLoan = copiesOnLoan - :one, updatedAt = :now',
          ExpressionAttributeValues: { ':one': 1, ':now': returnedDate },
        },
      },
      {
        Update: {
          TableName: TABLE,
          Key: { PK: `LOAN#${body.ISBN}`, SK: body.loanSK },
          UpdateExpression: 'SET #status = :returned, returnedDate = :now',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':returned': 'returned', ':now': returnedDate },
        },
      },
    ],
  }));

  return ok({ returned: true, ISBN: body.ISBN, returnedDate, nextOnHold: hasHoldQueue });
});
