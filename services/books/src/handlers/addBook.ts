import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, created, getDynamo, TABLE, ValidationError, ConflictError } from '@library/shared';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

export const handler = withAuth(async (event: APIGatewayProxyEvent, _auth) => {
  if (!event.body) throw new ValidationError('Request body is required');

  const body = JSON.parse(event.body) as {
    ISBN?: string; title?: string; author?: string; genre?: string;
    series?: string; seriesPosition?: number; releaseDate?: string;
    totalCopies?: number; coverImageUrl?: string;
  };

  if (!body.ISBN) throw new ValidationError('ISBN is required');
  if (!body.title) throw new ValidationError('title is required');
  if (!body.author) throw new ValidationError('author is required');
  if (!body.genre) throw new ValidationError('genre is required');
  if (!body.totalCopies || body.totalCopies < 1) throw new ValidationError('totalCopies must be >= 1');

  const db = getDynamo();

  const existing = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `BOOK#${body.ISBN}`, SK: 'METADATA' },
  }));
  if (existing.Item) throw new ConflictError(`Book with ISBN ${body.ISBN} already exists`);

  const now = new Date().toISOString();
  const item = {
    PK: `BOOK#${body.ISBN}`,
    SK: 'METADATA',
    entityType: 'BOOK',
    ISBN: body.ISBN,
    title: body.title,
    author: body.author,
    genre: body.genre,
    series: body.series,
    seriesPosition: body.seriesPosition,
    releaseDate: body.releaseDate,
    totalCopies: body.totalCopies,
    availableCopies: body.totalCopies,
    copiesOnLoan: 0,
    coverImageUrl: body.coverImageUrl,
    createdAt: now,
    updatedAt: now,
  };

  await db.send(new PutCommand({ TableName: TABLE, Item: item }));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { PK, SK, entityType, ...book } = item;
  return created(book);
}, 'librarian');
