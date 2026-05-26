import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth, ok, getDynamo, TABLE } from '@library/shared';

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });
const CLAUDE_HAIKU = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

type DbClient = ReturnType<typeof getDynamo>;

async function scanAllLoans(db: DbClient): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'entityType = :et',
      ExpressionAttributeValues: { ':et': 'LOAN' },
      ProjectionExpression: 'ISBN, bookTitle, bookAuthor, bookGenre, checkoutDate, returnedDate, returnDueDate, userId, #status, renewalCount, #fmt',
      ExpressionAttributeNames: { '#status': 'status', '#fmt': 'format' },
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(page.Items ?? []));
    lastKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return items;
}

async function countBooks(db: DbClient): Promise<number> {
  let count = 0;
  let lastKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'begins_with(PK, :pfx) AND SK = :meta',
      ExpressionAttributeValues: { ':pfx': 'BOOK#', ':meta': 'METADATA' },
      Select: 'COUNT',
      ExclusiveStartKey: lastKey,
    }));
    count += page.Count ?? 0;
    lastKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return count;
}

export const handler = withAuth(async (_event: APIGatewayProxyEvent, _auth) => {
  const db = getDynamo();

  const [loans, totalBooks] = await Promise.all([
    scanAllLoans(db),
    countBooks(db),
  ]);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Aggregate by genre/author/month/format
  const byGenre: Record<string, number> = {};
  const byAuthor: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  const byFormat: Record<string, number> = { physical: 0, audiobook: 0, ebook: 0 };
  const activeMembers = new Set<string>();

  for (const loan of loans) {
    const genre = (loan.bookGenre as string | undefined) ?? 'Unknown';
    const author = (loan.bookAuthor as string | undefined) ?? 'Unknown';
    const month = (loan.checkoutDate as string | undefined)?.slice(0, 7) ?? 'unknown';
    const fmt = (loan.format as string | undefined) ?? 'physical';
    const userId = loan.userId as string | undefined;

    byGenre[genre] = (byGenre[genre] ?? 0) + 1;
    byAuthor[author] = (byAuthor[author] ?? 0) + 1;
    byMonth[month] = (byMonth[month] ?? 0) + 1;
    byFormat[fmt] = (byFormat[fmt] ?? 0) + 1;
    if (userId) activeMembers.add(userId);
  }

  const topGenres = Object.entries(byGenre).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topAuthors = Object.entries(byAuthor).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const monthlyTrend = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

  // Overdue analysis
  const activeLoans = loans.filter(l => l.status === 'active');
  const overdueLoans = activeLoans.filter(l => {
    const due = l.returnDueDate as string | undefined;
    return due && due < todayStr;
  });
  const overdueBuckets = { '1-7 days': 0, '8-14 days': 0, '15-30 days': 0, '30+ days': 0 };
  const overdueBorrowers = new Set<string>();

  for (const loan of overdueLoans) {
    const due = new Date(loan.returnDueDate as string);
    const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
    if (daysOverdue <= 7) overdueBuckets['1-7 days']++;
    else if (daysOverdue <= 14) overdueBuckets['8-14 days']++;
    else if (daysOverdue <= 30) overdueBuckets['15-30 days']++;
    else overdueBuckets['30+ days']++;
    if (loan.userId) overdueBorrowers.add(loan.userId as string);
  }

  // Analysis period derived from loan data
  const checkoutDates = loans
    .map(l => l.checkoutDate as string | undefined)
    .filter(Boolean)
    .sort() as string[];
  const analysisFrom = checkoutDates[0]?.slice(0, 10) ?? 'N/A';
  const analysisTo = todayStr;

  const dataSnapshot = `
Library Metadata:
  Total books in catalog: ${totalBooks}
  Active members (unique borrowers): ${activeMembers.size}
  Analysis period: ${analysisFrom} to ${analysisTo}

Loan Summary:
  Total loans in system: ${loans.length}
  Active loans: ${activeLoans.length}
  Overdue loans: ${overdueLoans.length} (${activeLoans.length > 0 ? ((overdueLoans.length / activeLoans.length) * 100).toFixed(1) : 0}% of active)
  Renewal rate: ${loans.filter(l => (l.renewalCount as number) > 0).length} of ${loans.length} loans were renewed (${loans.length > 0 ? ((loans.filter(l => (l.renewalCount as number) > 0).length / loans.length) * 100).toFixed(1) : 0}%)

Format breakdown:
  Physical: ${byFormat.physical} loans
  Audiobook: ${byFormat.audiobook} loans
  Ebook/Kindle: ${byFormat.ebook} loans

Top genres by loan count:
${topGenres.map(([g, c]) => `  ${g}: ${c} loans (${loans.length > 0 ? ((c / loans.length) * 100).toFixed(1) : 0}%)`).join('\n')}

Top authors by loan count:
${topAuthors.map(([a, c]) => `  ${a}: ${c} loans`).join('\n')}

Monthly loan trend (last 6 months):
${monthlyTrend.map(([m, c]) => `  ${m}: ${c} loans`).join('\n')}

Overdue records:
  Total overdue: ${overdueLoans.length} loans across ${overdueBorrowers.size} unique borrowers
  1–7 days overdue: ${overdueBuckets['1-7 days']}
  8–14 days overdue: ${overdueBuckets['8-14 days']}
  15–30 days overdue: ${overdueBuckets['15-30 days']}
  30+ days overdue: ${overdueBuckets['30+ days']}
`;

  const response = await bedrock.send(new InvokeModelCommand({
    modelId: CLAUDE_HAIKU,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      system: `You are an AI analytics assistant for a Library Management System.

Your role is to analyze library data and generate meaningful operational and reader insights for librarians and administrators.

You must:
- Identify borrowing trends
- Detect unusual patterns
- Predict future demand
- Recommend inventory improvements
- Highlight overdue risks
- Summarize reader behavior
- Provide actionable recommendations

Guidelines:
- Be concise but insightful.
- Prefer practical recommendations over generic observations.
- Use statistics and percentages when available.
- Group similar patterns together.
- Mention confidence level when making predictions.
- Never hallucinate unavailable data.
- If data is insufficient, clearly state limitations.
- Output should be readable by non-technical librarians.

Response format:
1. Executive Summary
2. Key Trends
3. High Demand Books
4. Low Circulation Books
5. Reader Segments
6. Overdue Risk Analysis
7. Inventory Recommendations
8. Future Demand Predictions
9. Operational Suggestions
10. Confidence Notes

Also provide:
- 5 actionable recommendations
- 3 anomalies or unusual patterns
- A short executive summary for management`,
      messages: [{ role: 'user', content: `Analyze the following library data and generate AI insights.\n\n${dataSnapshot}` }],
      max_tokens: 1500,
      temperature: 0.3,
    }),
  }));

  const result = JSON.parse(new TextDecoder().decode(response.body));
  const insights = result.content?.[0]?.text ?? 'Unable to generate insights.';

  return ok({
    insights,
    data: {
      totalBooks,
      totalLoans: loans.length,
      activeLoans: activeLoans.length,
      overdueLoans: overdueLoans.length,
      activeMembers: activeMembers.size,
      overdueBuckets,
      topGenres,
      topAuthors,
      monthlyTrend,
      byFormat,
      analysisPeriod: { from: analysisFrom, to: analysisTo },
    },
    generatedAt: new Date().toISOString(),
  });
}, 'librarian');
