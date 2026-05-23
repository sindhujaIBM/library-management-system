import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TransactWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { withAuth, created, getDynamo, TABLE, ValidationError, NotFoundError, ConflictError } from '@library/shared';

export const handler = withAuth(async (event: APIGatewayProxyEvent, auth) => {
  if (!event.body) throw new ValidationError('Request body is required');
  const body = JSON.parse(event.body) as { ISBN?: string };
  if (!body.ISBN) throw new ValidationError('ISBN is required');

  const db = getDynamo();

  const bookResult = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `BOOK#${body.ISBN}`, SK: 'METADATA' },
  }));

  if (!bookResult.Item) throw new NotFoundError('Book not found');
  if ((bookResult.Item.availableCopies as number) < 1) {
    throw new ConflictError('No copies available — consider placing a hold');
  }

  const now = new Date();
  const checkoutDate = now.toISOString();
  const returnDueDate = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString();
  const loanId = uuidv4();
  const loanSK = `LOAN#${auth.userId}#${checkoutDate}`;

  try {
    await db.send(new TransactWriteCommand({
      TransactItems: [
        {
          // Atomic decrement with guard — prevents race condition on last copy
          Update: {
            TableName: TABLE,
            Key: { PK: `BOOK#${body.ISBN}`, SK: 'METADATA' },
            UpdateExpression: 'SET availableCopies = availableCopies - :one, copiesOnLoan = copiesOnLoan + :one, lastBorrowedDate = :now, updatedAt = :now',
            ConditionExpression: 'availableCopies > :zero',
            ExpressionAttributeValues: { ':one': 1, ':zero': 0, ':now': checkoutDate },
          },
        },
        {
          Put: {
            TableName: TABLE,
            Item: {
              PK: `LOAN#${body.ISBN}`,
              SK: loanSK,
              entityType: 'LOAN',
              loanId,
              ISBN: body.ISBN,
              userId: auth.userId,
              userEmail: auth.email,
              userName: auth.name,
              bookTitle: bookResult.Item.title,
              bookAuthor: bookResult.Item.author,
              checkoutDate,
              returnDueDate,
              status: 'active',
              renewalCount: 0,
            },
          },
        },
      ],
    }));
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'TransactionCanceledException') {
      throw new ConflictError('No copies available — someone just borrowed the last one');
    }
    throw err;
  }

  return created({
    loanId,
    ISBN: body.ISBN,
    bookTitle: bookResult.Item.title,
    checkoutDate,
    returnDueDate,
  });
});
