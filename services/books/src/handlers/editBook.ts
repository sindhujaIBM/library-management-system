import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, ok, getDynamo, TABLE, ValidationError, NotFoundError } from '@library/shared';

export const handler = withAuth(async (event: APIGatewayProxyEvent, _auth) => {
  const isbn = event.pathParameters?.isbn;
  if (!isbn) throw new ValidationError('isbn is required');
  if (!event.body) throw new ValidationError('Request body is required');

  const body = JSON.parse(event.body) as Record<string, unknown>;
  const allowed = ['title', 'author', 'genre', 'series', 'seriesPosition', 'releaseDate', 'totalCopies', 'coverImageUrl'];

  const db = getDynamo();

  const existing = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `BOOK#${isbn}`, SK: 'METADATA' },
  }));
  if (!existing.Item) throw new NotFoundError('Book not found');

  if (body.totalCopies !== undefined) {
    const newTotal = body.totalCopies as number;
    if (newTotal < 1) throw new ValidationError('totalCopies must be at least 1');
    const copiesOnLoan = existing.Item.copiesOnLoan as number;
    if (newTotal < copiesOnLoan) {
      throw new ValidationError(
        `Cannot reduce copies to ${newTotal} — ${copiesOnLoan} ${copiesOnLoan === 1 ? 'copy is' : 'copies are'} currently on loan`
      );
    }
  }

  const updates: string[] = ['updatedAt = :now'];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ':now': new Date().toISOString() };

  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = body[key];
    }
  }

  if (body.totalCopies !== undefined) {
    const delta = (body.totalCopies as number) - (existing.Item.totalCopies as number);
    const newAvailable = (existing.Item.availableCopies as number) + delta;
    updates.push('#availableCopies = :avail');
    names['#availableCopies'] = 'availableCopies';
    values[':avail'] = newAvailable;
  }

  await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `BOOK#${isbn}`, SK: 'METADATA' },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
    ExpressionAttributeValues: values,
  }));

  return ok({ ISBN: isbn, ...body, updatedAt: values[':now'] });
}, 'librarian');
