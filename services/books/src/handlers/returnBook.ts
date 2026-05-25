import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TransactWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { withAuth, ok, getDynamo, TABLE, ValidationError, NotFoundError, ConflictError } from '@library/shared';

const ses = new SESClient({ region: 'us-east-1' });
const FROM = process.env.SES_FROM_EMAIL ?? 'noreply@maidlink.ca';

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
  const isDigital = loan.format === 'audiobook' || loan.format === 'ebook';

  // Check for hold queue — notify the first person in line
  const holdsResult = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `WAITLIST#${body.ISBN}` },
  }));
  const holdItems = holdsResult.Items ?? [];
  const hasHoldQueue = holdItems.length > 0;

  if (hasHoldQueue) {
    const next = holdItems.sort((a, b) => String(a.joinedAt).localeCompare(String(b.joinedAt)))[0];
    if (next?.userEmail) {
      await ses.send(new SendEmailCommand({
        Source: FROM,
        Destination: { ToAddresses: [next.userEmail as string] },
        Message: {
          Subject: { Data: `"${loan.bookTitle as string}" is now available` },
          Body: {
            Text: {
              Data: `Hi ${next.userName as string},\n\nGood news! The copy of "${loan.bookTitle as string}" you placed a hold on has just been returned and is now available.\n\nPlease visit the library to pick it up.\n\nThank you,\nLibrary Team`,
            },
          },
        },
      }));
    }
  }

  if (isDigital) {
    const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
    await db.send(new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `LOAN#${body.ISBN}`, SK: body.loanSK },
      UpdateExpression: 'SET #status = :returned, returnedDate = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':returned': 'returned', ':now': returnedDate },
    }));
  } else {
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
  }

  return ok({ returned: true, ISBN: body.ISBN, returnedDate, nextOnHold: hasHoldQueue });
});
