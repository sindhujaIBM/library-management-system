import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, ok, getDynamo, TABLE, ValidationError, TooManyRequestsError } from '@library/shared';

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });
const NOVA_MICRO = 'us.amazon.nova-micro-v1:0';

const DAILY_LIMIT = 5;
const TWO_DAYS_SECONDS = 60 * 60 * 24 * 2;

async function checkAndIncrementRateLimit(userId: string): Promise<void> {
  const db = getDynamo();
  const today = new Date().toISOString().split('T')[0];

  // Atomically increment the counter for today. Returns the new count.
  // TTL ensures the item auto-expires after 2 days — no cleanup needed.
  // Note: two simultaneous requests on the exact limit boundary may both
  // succeed (off-by-one race). This is acceptable for a soft daily cap.
  const result = await db.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `RATELIMIT#${userId}#${today}`, SK: 'METADATA' },
    UpdateExpression: 'ADD callCount :one SET #ttl = :ttl',
    ExpressionAttributeNames: { '#ttl': 'ttl' },
    ExpressionAttributeValues: {
      ':one': 1,
      ':ttl': Math.floor(Date.now() / 1000) + TWO_DAYS_SECONDS,
    },
    ReturnValues: 'UPDATED_NEW',
  }));

  const count = result.Attributes?.callCount as number;
  if (count > DAILY_LIMIT) {
    throw new TooManyRequestsError(
      `Daily recommendation limit reached (${DAILY_LIMIT} per day). Come back tomorrow!`
    );
  }
}

export const handler = withAuth(async (event: APIGatewayProxyEvent, auth) => {
  if (!event.body) throw new ValidationError('Request body is required');
  const body = JSON.parse(event.body) as {
    message?: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  if (!body.message) throw new ValidationError('message is required');

  // Rate limit check before any expensive operations
  await checkAndIncrementRateLimit(auth.userId);

  const db = getDynamo();

  const [loanHistory, catalog] = await Promise.all([
    db.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI3-userId-checkoutDate',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': auth.userId },
      Limit: 10,
      ScanIndexForward: false,
    })),
    db.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'entityType = :et',
      ExpressionAttributeValues: { ':et': 'BOOK' },
      ProjectionExpression: 'ISBN, title, author, genre, series, availableCopies',
    })),
  ]);

  const recentlyBorrowed = (loanHistory.Items ?? [])
    .map(l => `"${l.bookTitle}" by ${l.bookAuthor}`)
    .join(', ');

  const catalogList = (catalog.Items ?? [])
    .map(b => `- "${b.title}" by ${b.author} (${b.genre})${b.series ? ` — ${b.series} series` : ''} [${b.availableCopies > 0 ? 'Available' : 'On hold'}]`)
    .join('\n');

  const systemPrompt = `You are a helpful library assistant for a public library. Your job is to recommend books from the library's catalog based on what the patron tells you they enjoy.

IMPORTANT RULES:
- Only recommend books that appear in the catalog below. Never invent book titles, authors, or ISBNs.
- If the patron's taste doesn't match anything in the catalog, say so honestly.
- Keep responses friendly, concise, and under 200 words.
- When recommending, mention whether the book is currently available or on hold.

Patron's recent borrowing history: ${recentlyBorrowed || 'No history yet'}

LIBRARY CATALOG (only recommend from this list):
${catalogList}`;

  const messages = [
    ...(body.conversationHistory ?? []).map(m => ({
      role: m.role,
      content: [{ text: m.content }],
    })),
    { role: 'user' as const, content: [{ text: body.message }] },
  ];

  const response = await bedrock.send(new InvokeModelCommand({
    modelId: NOVA_MICRO,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      system: [{ text: systemPrompt }],
      messages,
      inferenceConfig: { maxTokens: 400, temperature: 0.7 },
    }),
  }));

  const result = JSON.parse(new TextDecoder().decode(response.body));
  const reply = result.output?.message?.content?.[0]?.text ?? 'Sorry, I could not generate a recommendation.';

  return ok({ reply, role: 'assistant' });
});
