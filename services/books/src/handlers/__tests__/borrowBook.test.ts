import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { signToken } from '@library/shared';

// Register mock BEFORE importing the handler so the module-level getDynamo() singleton is intercepted
const mockDynamo = mockClient(DynamoDBDocumentClient);

const { handler } = await import('../borrowBook');

function makeEvent(body: object, role: 'member' | 'librarian' = 'member'): APIGatewayProxyEvent {
  const token = signToken({ sub: 'user-123', email: 'alice@library.com', name: 'Alice', role });
  return {
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    httpMethod: 'POST',
    path: '/loans/checkout',
    queryStringParameters: null,
    pathParameters: null,
    multiValueQueryStringParameters: null,
    multiValueHeaders: {},
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: '',
    isBase64Encoded: false,
  };
}

const physicalBook = {
  PK: 'BOOK#978-0-11-000000-1',
  SK: 'METADATA',
  title: 'Great Expectations',
  author: 'Charles Dickens',
  genre: 'Classic',
  formats: ['physical'],
  availableCopies: 2,
  totalCopies: 5,
  copiesOnLoan: 3,
};

describe('borrowBook handler', () => {
  beforeEach(() => {
    mockDynamo.reset();
  });

  it('returns 401 when no Authorization header', async () => {
    const token = signToken({ sub: 'u', email: 'e@e.com', name: 'N', role: 'member' });
    const result = await handler({
      ...makeEvent({ ISBN: '978-0-11-000000-1' }),
      headers: {},
    } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(401);
    void token; // only used to ensure signToken is imported
  });

  it('returns 400 when body is null', async () => {
    const result = await handler({ ...makeEvent({}), body: null } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when ISBN is missing from body', async () => {
    const result = await handler(makeEvent({}));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error.message).toContain('ISBN');
  });

  it('returns 404 when book does not exist in DynamoDB', async () => {
    mockDynamo.on(GetCommand).resolves({ Item: undefined });
    const result = await handler(makeEvent({ ISBN: '978-0-00-000000-0' }));
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error.code).toBe('NOT_FOUND');
  });

  it('returns 409 when no physical copies available', async () => {
    mockDynamo.on(GetCommand).resolves({
      Item: { ...physicalBook, availableCopies: 0, copiesOnLoan: 5 },
    });
    const result = await handler(makeEvent({ ISBN: '978-0-11-000000-1', format: 'physical' }));
    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body).error.message).toContain('No physical copies available');
  });

  it('returns 409 when requested format is not available for the book', async () => {
    mockDynamo.on(GetCommand).resolves({
      Item: { ...physicalBook, formats: ['physical'] },
    });
    const result = await handler(makeEvent({ ISBN: '978-0-11-000000-1', format: 'audiobook' }));
    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body).error.message).toContain('not available in audiobook format');
  });

  it('returns 201 with loan data on successful physical checkout', async () => {
    mockDynamo.on(GetCommand).resolves({ Item: physicalBook });
    mockDynamo.on(TransactWriteCommand).resolves({});

    const result = await handler(makeEvent({ ISBN: '978-0-11-000000-1', format: 'physical' }));
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.data.ISBN).toBe('978-0-11-000000-1');
    expect(body.data.bookTitle).toBe('Great Expectations');
    expect(body.data.loanId).toBeDefined();
    expect(body.data.returnDueDate).toBeDefined();
    expect(body.data.format).toBe('physical');
    // Transact write (not plain put) must be used for physical books
    expect(mockDynamo.commandCalls(TransactWriteCommand)).toHaveLength(1);
    expect(mockDynamo.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('returns 201 on successful ebook checkout using PutCommand (not TransactWrite)', async () => {
    mockDynamo.on(GetCommand).resolves({
      Item: {
        ...physicalBook,
        title: 'Digital Book',
        formats: ['physical', 'ebook'],
        availableCopies: 0, // digital ignores availableCopies
      },
    });
    mockDynamo.on(PutCommand).resolves({});

    const result = await handler(makeEvent({ ISBN: '978-0-11-000000-1', format: 'ebook' }));
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body).data.format).toBe('ebook');
    expect(mockDynamo.commandCalls(PutCommand)).toHaveLength(1);
    expect(mockDynamo.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it('defaults to physical format when format is not specified', async () => {
    mockDynamo.on(GetCommand).resolves({ Item: physicalBook });
    mockDynamo.on(TransactWriteCommand).resolves({});

    const result = await handler(makeEvent({ ISBN: '978-0-11-000000-1' }));
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body).data.format).toBe('physical');
  });
});
