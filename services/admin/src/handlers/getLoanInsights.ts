import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, ok, getDynamo, TABLE } from '@library/shared';

// Claude Haiku for reasoning over aggregated data — better than Nova Micro for analysis
const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });
const CLAUDE_HAIKU = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

export const handler = withAuth(async (_event: APIGatewayProxyEvent, _auth) => {
  const db = getDynamo();

  // Fetch all loans for analysis — paginate to handle tables larger than 1MB
  const loans: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'entityType = :et',
      ExpressionAttributeValues: { ':et': 'LOAN' },
      ProjectionExpression: 'ISBN, bookTitle, bookAuthor, bookGenre, checkoutDate, returnedDate, #status, renewalCount, #fmt',
      ExpressionAttributeNames: { '#status': 'status', '#fmt': 'format' },
      ExclusiveStartKey: lastKey,
    }));
    loans.push(...(page.Items ?? []));
    lastKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  // Aggregate by genre/author/month for the prompt
  const byGenre: Record<string, number> = {};
  const byAuthor: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  const byFormat: Record<string, number> = { physical: 0, audiobook: 0, ebook: 0 };

  for (const loan of loans) {
    const genre = (loan.bookGenre as string | undefined) ?? 'Unknown';
    const author = (loan.bookAuthor as string | undefined) ?? 'Unknown';
    const month = (loan.checkoutDate as string | undefined)?.slice(0, 7) ?? 'unknown';
    const fmt = (loan.format as string | undefined) ?? 'physical';
    byGenre[genre] = (byGenre[genre] ?? 0) + 1;
    byAuthor[author] = (byAuthor[author] ?? 0) + 1;
    byMonth[month] = (byMonth[month] ?? 0) + 1;
    byFormat[fmt] = (byFormat[fmt] ?? 0) + 1;
  }

  const topGenres = Object.entries(byGenre).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topAuthors = Object.entries(byAuthor).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const monthlyTrend = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

  const dataSnapshot = `
Total loans in system: ${loans.length}
Active loans: ${loans.filter(l => l.status === 'active').length}

Format breakdown:
  Physical: ${byFormat.physical} loans
  Audiobook: ${byFormat.audiobook} loans
  Ebook/Kindle: ${byFormat.ebook} loans

Top genres by loan count:
${topGenres.map(([g, c]) => `  ${g}: ${c} loans`).join('\n')}

Top authors by loan count:
${topAuthors.map(([a, c]) => `  ${a}: ${c} loans`).join('\n')}

Monthly loan trend (last 6 months):
${monthlyTrend.map(([m, c]) => `  ${m}: ${c} loans`).join('\n')}

Renewal rate: ${loans.filter(l => (l.renewalCount as number) > 0).length} of ${loans.length} loans were renewed
`;

  const response = await bedrock.send(new InvokeModelCommand({
    modelId: CLAUDE_HAIKU,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
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
    data: { totalLoans: loans.length, topGenres, topAuthors, monthlyTrend, byFormat },
    generatedAt: new Date().toISOString(),
  });
}, 'librarian');
