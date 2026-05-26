import { describe, it, expect, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { signToken } from '@library/shared';

// Register both mocks BEFORE importing the handler.
// getLoanInsights.ts creates a BedrockRuntimeClient at module load time;
// mockClient patches the prototype so the singleton is intercepted.
const mockDynamo = mockClient(DynamoDBDocumentClient);
const mockBedrock = mockClient(BedrockRuntimeClient);

const { handler } = await import('../getLoanInsights');

function encodeBedrockResponse(text: string): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ content: [{ type: 'text', text }] }));
}

function makeEvent(role: 'member' | 'librarian'): APIGatewayProxyEvent {
  const token = signToken({ sub: 'lib-001', email: 'librarian@lib.com', name: 'Head Librarian', role });
  return {
    headers: { Authorization: `Bearer ${token}` },
    body: null,
    httpMethod: 'GET',
    path: '/ai/insights',
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

const sampleLoans = [
  {
    ISBN: '978-0001',
    bookTitle: 'Book A',
    bookAuthor: 'Author X',
    bookGenre: 'Fiction',
    checkoutDate: '2025-01-15T10:00:00.000Z',
    status: 'active',
    renewalCount: 0,
    format: 'physical',
  },
  {
    ISBN: '978-0002',
    bookTitle: 'Book B',
    bookAuthor: 'Author Y',
    bookGenre: 'Fiction',
    checkoutDate: '2025-02-20T10:00:00.000Z',
    status: 'returned',
    renewalCount: 1,
    format: 'ebook',
  },
  {
    ISBN: '978-0003',
    bookTitle: 'Book C',
    bookAuthor: 'Author X',
    bookGenre: 'Science',
    checkoutDate: '2025-03-10T10:00:00.000Z',
    status: 'active',
    renewalCount: 0,
    format: 'audiobook',
  },
];

describe('getLoanInsights handler', () => {
  beforeEach(() => {
    mockDynamo.reset();
    mockBedrock.reset();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const result = await handler({ ...makeEvent('librarian'), headers: {} } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(401);
  });

  it('returns 403 when caller is a member (not librarian)', async () => {
    const result = await handler(makeEvent('member'));
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).error.code).toBe('FORBIDDEN');
  });

  it('returns 200 with insights and aggregated data', async () => {
    mockDynamo.on(ScanCommand).resolves({ Items: sampleLoans, LastEvaluatedKey: undefined });
    mockBedrock.on(InvokeModelCommand).resolves({
      body: encodeBedrockResponse('Fiction is trending. Author X has high engagement.'),
    });

    const result = await handler(makeEvent('librarian'));
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.data.insights).toBe('Fiction is trending. Author X has high engagement.');
    expect(body.data.data.totalLoans).toBe(3);
    expect(body.data.data.byFormat.physical).toBe(1);
    expect(body.data.data.byFormat.ebook).toBe(1);
    expect(body.data.data.byFormat.audiobook).toBe(1);
    expect(body.data.generatedAt).toBeDefined();
  });

  it('aggregates top genres and authors correctly', async () => {
    mockDynamo.on(ScanCommand).resolves({ Items: sampleLoans, LastEvaluatedKey: undefined });
    mockBedrock.on(InvokeModelCommand).resolves({
      body: encodeBedrockResponse('Insights here.'),
    });

    const result = await handler(makeEvent('librarian'));
    const { topGenres, topAuthors } = JSON.parse(result.body).data.data;

    // Fiction appears twice, Science once — Fiction should rank first
    expect(topGenres[0][0]).toBe('Fiction');
    expect(topGenres[0][1]).toBe(2);

    // Author X appears twice
    expect(topAuthors[0][0]).toBe('Author X');
    expect(topAuthors[0][1]).toBe(2);
  });

  it('handles paginated DynamoDB scan (two pages)', async () => {
    // scanAllLoans and countBooks run in parallel — both call ScanCommand.
    // Call order (single-threaded): loans page 1 → countBooks → loans page 2.
    mockDynamo
      .on(ScanCommand)
      .resolvesOnce({
        Items: [sampleLoans[0]],
        LastEvaluatedKey: { PK: 'LOAN#978-page1-last' },
      })
      .resolvesOnce({
        // countBooks uses Select: COUNT — returns Count, not Items
        Count: 10,
        LastEvaluatedKey: undefined,
      })
      .resolvesOnce({
        Items: [sampleLoans[1]],
        LastEvaluatedKey: undefined,
      });

    mockBedrock.on(InvokeModelCommand).resolves({
      body: encodeBedrockResponse('Paginated result.'),
    });

    const result = await handler(makeEvent('librarian'));
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body).data.data;
    expect(body.totalLoans).toBe(2);
    expect(body.totalBooks).toBe(10);
    // loans page 1 + countBooks + loans page 2 = 3 ScanCommand calls
    expect(mockDynamo.commandCalls(ScanCommand)).toHaveLength(3);
  });

  it('reports renewal rate based on loans with renewalCount > 0', async () => {
    // sampleLoans[1] has renewalCount: 1 — the Bedrock prompt should mention "1 of 3 loans were renewed"
    mockDynamo.on(ScanCommand).resolves({ Items: sampleLoans, LastEvaluatedKey: undefined });
    mockBedrock.on(InvokeModelCommand).resolves({
      body: encodeBedrockResponse('Renewal insight.'),
    });

    // Verify Bedrock was called with prompt mentioning renewal info
    await handler(makeEvent('librarian'));
    const bedrockCall = mockBedrock.commandCalls(InvokeModelCommand)[0];
    const promptBody = JSON.parse(bedrockCall.args[0].input.body as string);
    const userContent = promptBody.messages[0].content as string;
    expect(userContent).toContain('1 of 3 loans were renewed');
  });
});
