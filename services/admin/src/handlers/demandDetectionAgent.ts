import { ScanCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { v4 as uuid } from 'uuid';
import { getDynamo, TABLE } from '@library/shared';

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });
const CLAUDE_HAIKU = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

const HOLD_THRESHOLD = 5;

export const handler = async (): Promise<void> => {
  const db = getDynamo();

  // Collect all WAITLIST items with pagination
  const allWaitlist: { PK: string }[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'entityType = :et',
      ExpressionAttributeValues: { ':et': 'WAITLIST' },
      ProjectionExpression: 'PK',
      ExclusiveStartKey: lastKey,
    }));
    allWaitlist.push(...((result.Items ?? []) as { PK: string }[]));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  // Group by ISBN and count holds
  const holdsByISBN: Record<string, number> = {};
  for (const item of allWaitlist) {
    const isbn = item.PK.replace('WAITLIST#', '');
    holdsByISBN[isbn] = (holdsByISBN[isbn] ?? 0) + 1;
  }

  const highDemand = Object.entries(holdsByISBN).filter(([, count]) => count >= HOLD_THRESHOLD);
  if (highDemand.length === 0) {
    console.log('demandDetectionAgent: no books with 5+ holds');
    return;
  }

  // Load existing pending demand_order alerts to avoid duplicates
  const existingResult = await db.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI5-alertStatus-generatedAt',
    KeyConditionExpression: 'alertStatus = :status',
    ExpressionAttributeValues: { ':status': 'pending' },
    ProjectionExpression: 'alertISBN, #type',
    ExpressionAttributeNames: { '#type': 'type' },
  }));
  const pendingDemandISBNs = new Set(
    (existingResult.Items ?? [])
      .filter(a => a.type === 'demand_order')
      .map(a => a.alertISBN as string)
  );

  let created = 0;
  for (const [isbn, holdCount] of highDemand) {
    if (pendingDemandISBNs.has(isbn)) {
      console.log(`demandDetectionAgent: skipping ${isbn} — pending alert already exists`);
      continue;
    }

    const bookResult = await db.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `BOOK#${isbn}`, SK: 'METADATA' },
    }));
    if (!bookResult.Item) continue;

    const { title, author, totalCopies: currentCopies } = bookResult.Item as {
      title: string; author: string; totalCopies: number;
    };
    const amazonSearchUrl = `https://www.amazon.ca/s?k=${encodeURIComponent(`${title} ${author}`)}`;

    // Ask Claude Haiku for a reasoned order recommendation
    let recommendedCopiesOrdered = Math.ceil(holdCount / 3);
    let estimatedCostCAD: number | null = null;
    let reasoning: string | null = null;
    try {
      const haikuResponse = await bedrock.send(new InvokeModelCommand({
        modelId: CLAUDE_HAIKU,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          system: 'You are a library acquisition advisor. Respond only with valid JSON — no markdown, no explanation outside the JSON.',
          messages: [{
            role: 'user',
            content: `The library has ${holdCount} patrons waiting for "${title}" by ${author} and currently owns ${currentCopies} ${currentCopies === 1 ? 'copy' : 'copies'}. Recommend how many additional copies to order and estimate the total cost (assume $22 CAD per copy on average). Respond with JSON: {"recommendedCopiesOrdered": number, "estimatedCostCAD": number, "reasoning": "1-2 sentences"}`,
          }],
          max_tokens: 200,
          temperature: 0.2,
        }),
      }));
      const haikuResult = JSON.parse(Buffer.from(haikuResponse.body as Uint8Array).toString());
      const parsed = JSON.parse(haikuResult.content?.[0]?.text ?? '{}') as {
        recommendedCopiesOrdered?: number;
        estimatedCostCAD?: number;
        reasoning?: string;
      };
      if (parsed.recommendedCopiesOrdered) recommendedCopiesOrdered = parsed.recommendedCopiesOrdered;
      if (parsed.estimatedCostCAD) estimatedCostCAD = parsed.estimatedCostCAD;
      if (parsed.reasoning) reasoning = parsed.reasoning;
    } catch {
      // Haiku call failed — fall back to computed defaults, alert still gets created
    }

    const alertId = uuid();
    await db.send(new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `ALERT#${alertId}`,
        SK: 'METADATA',
        entityType: 'ALERT',
        alertId,
        type: 'demand_order',
        status: 'pending',
        alertStatus: 'pending',
        alertISBN: isbn,
        payload: {
          ISBN: isbn,
          title,
          author,
          currentCopies,
          holdQueueLength: holdCount,
          recommendedCopiesOrdered,
          ...(estimatedCostCAD !== null ? { estimatedCostCAD } : {}),
          ...(reasoning ? { reasoning } : {}),
          amazonSearchUrl,
        },
        generatedAt: new Date().toISOString(),
      },
    }));
    created++;
    console.log(`demandDetectionAgent: created demand_order alert for "${title}" (${holdCount} holds)`);
  }

  console.log(`demandDetectionAgent: done — ${highDemand.length} high-demand books, ${created} new alerts`);
};
