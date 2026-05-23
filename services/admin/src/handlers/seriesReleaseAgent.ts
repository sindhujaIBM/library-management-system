import { ScanCommand, QueryCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { getDynamo, TABLE } from '@library/shared';

const ses = new SESClient({ region: 'us-east-1' });
const FROM = process.env.SES_FROM_EMAIL ?? 'noreply@maidlink.ca';
const CONFIG_SET = process.env.SES_CONFIG_SET;
const GOOGLE_BOOKS_KEY = process.env.GOOGLE_BOOKS_API_KEY ?? '';
const NOTIF_TTL_DAYS = 365;

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  await ses.send(new SendEmailCommand({
    Source: FROM,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Text: { Data: body } },
    },
    ...(CONFIG_SET ? { ConfigurationSetName: CONFIG_SET } : {}),
  }));
}

interface GoogleVolume {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
  };
}

async function fetchSeriesReleases(seriesName: string): Promise<GoogleVolume[]> {
  const query = encodeURIComponent(`intitle:"${seriesName}"`);
  const key = GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : '';
  const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&orderBy=newest&maxResults=10${key}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as { items?: GoogleVolume[] };
  return data.items ?? [];
}

function extractISBN13(volume: GoogleVolume): string | null {
  const ids = volume.volumeInfo?.industryIdentifiers ?? [];
  const isbn13 = ids.find(id => id.type === 'ISBN_13');
  return isbn13?.identifier ?? null;
}

export const handler = async (): Promise<void> => {
  const db = getDynamo();

  // Collect all books with a series field
  const seriesBooks: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'entityType = :et AND attribute_exists(#series) AND #series <> :empty',
      ExpressionAttributeNames: { '#series': 'series' },
      ExpressionAttributeValues: { ':et': 'BOOK', ':empty': '' },
      ProjectionExpression: 'ISBN, title, author, #series',
      ExclusiveStartKey: lastKey,
    }));
    seriesBooks.push(...(result.Items ?? []));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  // Group by series name → map of seriesName → list of ISBNs in our catalog
  const seriesMap: Record<string, { isbn: string; title: string; author: string }[]> = {};
  for (const book of seriesBooks) {
    const s = book.series as string;
    if (!seriesMap[s]) seriesMap[s] = [];
    seriesMap[s].push({ isbn: book.ISBN as string, title: book.title as string, author: book.author as string });
  }

  console.log(`seriesReleaseAgent: checking ${Object.keys(seriesMap).length} series`);

  let notificationsSent = 0;

  for (const [seriesName, catalogEntries] of Object.entries(seriesMap)) {
    const catalogISBNs = new Set(catalogEntries.map(e => e.isbn));

    // Call Google Books API
    let volumes: GoogleVolume[];
    try {
      volumes = await fetchSeriesReleases(seriesName);
    } catch (err) {
      console.error(`seriesReleaseAgent: Google Books API error for "${seriesName}"`, err);
      continue;
    }

    for (const vol of volumes) {
      const newISBN = extractISBN13(vol);
      if (!newISBN || catalogISBNs.has(newISBN)) continue; // already in our catalog

      const newTitle = vol.volumeInfo?.title ?? 'Unknown Title';
      const newAuthor = vol.volumeInfo?.authors?.[0] ?? catalogEntries[0]?.author ?? 'Unknown Author';

      // Find all users who ever borrowed any book in this series
      const userEmails: Record<string, string> = {}; // userId → email
      for (const entry of catalogEntries) {
        const loansResult = await db.send(new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: { ':pk': `LOAN#${entry.isbn}` },
          ProjectionExpression: 'userId, userEmail',
        }));
        for (const loan of loansResult.Items ?? []) {
          userEmails[loan.userId as string] = loan.userEmail as string;
        }
      }

      // Send notification to each user, with dedup
      for (const [userId, email] of Object.entries(userEmails)) {
        const notifKey = { PK: `NOTIF#${userId}#${newISBN}`, SK: 'METADATA' };

        const existing = await db.send(new GetCommand({ TableName: TABLE, Key: notifKey }));
        if (existing.Item) continue; // already notified

        await sendEmail(
          email,
          `New release in the "${seriesName}" series`,
          `Hi,\n\nA new book in the ${seriesName} series is available: "${newTitle}" by ${newAuthor}.\n\nAsk your librarian to add it to the catalog, or request it at the front desk.\n\nHappy reading,\nLibrary Team`
        );

        // Write dedup record — TTL prevents it from accumulating forever
        const ttl = Math.floor(Date.now() / 1000) + NOTIF_TTL_DAYS * 24 * 60 * 60;
        await db.send(new PutCommand({
          TableName: TABLE,
          Item: { ...notifKey, entityType: 'NOTIF', userId, ISBN: newISBN, sentAt: new Date().toISOString(), ttl },
        }));

        notificationsSent++;
      }

      console.log(`seriesReleaseAgent: new release "${newTitle}" (${newISBN}) in series "${seriesName}"`);
    }
  }

  console.log(`seriesReleaseAgent: done — ${notificationsSent} notifications sent`);
};
