import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, created, getDynamo, TABLE, ValidationError, NotFoundError, ConflictError } from '@library/shared';

export const handler = withAuth(async (event: APIGatewayProxyEvent, auth) => {
  if (!event.body) throw new ValidationError('Request body is required');
  const body = JSON.parse(event.body) as { ISBN?: string };
  if (!body.ISBN) throw new ValidationError('ISBN is required');

  const db = getDynamo();

  const [bookResult, existingHold] = await Promise.all([
    db.send(new GetCommand({ TableName: TABLE, Key: { PK: `BOOK#${body.ISBN}`, SK: 'METADATA' } })),
    db.send(new GetCommand({ TableName: TABLE, Key: { PK: `WAITLIST#${body.ISBN}`, SK: `USER#${auth.userId}` } })),
  ]);

  if (!bookResult.Item) throw new NotFoundError('Book not found');
  if (bookResult.Item.availableCopies > 0) throw new ConflictError('Book is available — borrow it directly');
  if (existingHold.Item) throw new ConflictError('You already have a hold on this book');

  // joinedAt is the ordering key — position is computed at read time by sorting joinedAt.
  // Storing a position counter here would require a read-then-write that has a race condition
  // under concurrent requests. Sorting on read is always correct and requires no coordination.
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `WAITLIST#${body.ISBN}`,
      SK: `USER#${auth.userId}`,
      entityType: 'WAITLIST',
      ISBN: body.ISBN,
      userId: auth.userId,
      userEmail: auth.email,
      userName: auth.name,
      joinedAt: new Date().toISOString(),
    },
  }));

  return created({ ISBN: body.ISBN, bookTitle: bookResult.Item.title });
});
