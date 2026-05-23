import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, ok, getDynamo, TABLE, ValidationError, NotFoundError, ConflictError } from '@library/shared';

export const handler = withAuth(async (event: APIGatewayProxyEvent, _auth) => {
  const isbn = event.pathParameters?.isbn;
  if (!isbn) throw new ValidationError('isbn is required');

  const db = getDynamo();

  const existing = await db.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `BOOK#${isbn}`, SK: 'METADATA' },
  }));
  if (!existing.Item) throw new NotFoundError('Book not found');

  if ((existing.Item.copiesOnLoan as number) > 0) {
    throw new ConflictError('Cannot delete a book that has active loans');
  }

  await db.send(new DeleteCommand({
    TableName: TABLE,
    Key: { PK: `BOOK#${isbn}`, SK: 'METADATA' },
  }));

  return ok({ deleted: isbn });
}, 'librarian');
