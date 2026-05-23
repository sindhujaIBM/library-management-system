import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, ok, getDynamo, TABLE } from '@library/shared';

// Claude Haiku for reasoning over aggregated data — better than Nova Micro for analysis
const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });
const CLAUDE_HAIKU = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

export const handler = withAuth(async (_event: APIGatewayProxyEvent, _auth) => {
  const db = getDynamo();

  // Fetch all loans for analysis
  const loansResult = await db.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: 'entityType = :et',
    ExpressionAttributeValues: { ':et': 'LOAN' },
    ProjectionExpression: 'ISBN, bookTitle, bookAuthor, checkoutDate, returnedDate, #status, renewalCount',
    ExpressionAttributeNames: { '#status': 'status' },
  }));

  const loans = loansResult.Items ?? [];

  // Aggregate by genre/author/month for the prompt
  const byGenre: Record<string, number> = {};
  const byAuthor: Record<string, number> = {};
  const byMonth: Record<string, number> = {};

  // Fetch books to get genre info
  const booksResult = await db.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: 'entityType = :et',
    ExpressionAttributeValues: { ':et': 'BOOK' },
    ProjectionExpression: 'ISBN, genre',
  }));
  const isbnToGenre = Object.fromEntries((booksResult.Items ?? []).map(b => [b.ISBN, b.genre]));

  for (const loan of loans) {
    const genre = isbnToGenre[loan.ISBN] ?? 'Unknown';
    byGenre[genre] = (byGenre[genre] ?? 0) + 1;
    byAuthor[loan.bookAuthor] = (byAuthor[loan.bookAuthor] ?? 0) + 1;
    const month = loan.checkoutDate?.slice(0, 7) ?? 'unknown';
    byMonth[month] = (byMonth[month] ?? 0) + 1;
  }

  const topGenres = Object.entries(byGenre).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topAuthors = Object.entries(byAuthor).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const monthlyTrend = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

  const dataSnapshot = `
Total loans in system: ${loans.length}
Active loans: ${loans.filter(l => l.status === 'active').length}

Top genres by loan count:
${topGenres.map(([g, c]) => `  ${g}: ${c} loans`).join('\n')}

Top authors by loan count:
${topAuthors.map(([a, c]) => `  ${a}: ${c} loans`).join('\n')}

Monthly loan trend (last 6 months):
${monthlyTrend.map(([m, c]) => `  ${m}: ${c} loans`).join('\n')}

Renewal rate: ${loans.filter(l => l.renewalCount > 0).length} of ${loans.length} loans were renewed
`;

  const response = await bedrock.send(new InvokeModelCommand({
    modelId: CLAUDE_HAIKU,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      system: 'You are a data analyst for a public library. Analyze the loan data and produce a concise, actionable insight report for the head librarian. Focus on trends, opportunities, and any concerns. Write in plain English, under 300 words. Use bullet points where helpful.',
      messages: [{ role: 'user', content: dataSnapshot }],
      max_tokens: 600,
      temperature: 0.3,
    }),
  }));

  const result = JSON.parse(new TextDecoder().decode(response.body));
  const insights = result.content?.[0]?.text ?? 'Unable to generate insights.';

  return ok({
    insights,
    data: { totalLoans: loans.length, topGenres, topAuthors, monthlyTrend },
    generatedAt: new Date().toISOString(),
  });
}, 'librarian');
