import { ScanCommand, QueryCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { v4 as uuid } from 'uuid';
import { getDynamo, TABLE } from '@library/shared';

const ses = new SESClient({ region: 'us-east-1' });
const FROM = process.env.SES_FROM_EMAIL ?? 'noreply@maidlink.ca';
const CONFIG_SET = process.env.SES_CONFIG_SET;
const GOOGLE_BOOKS_KEY = process.env.GOOGLE_BOOKS_API_KEY ?? '';
const NOTIF_TTL_DAYS = 365;
// Books published within this window are treated as "new releases" → notify borrowers via SES
const NEW_RELEASE_WINDOW_DAYS = 365;

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

async function fetchSeriesVolumes(seriesName: string, author: string): Promise<GoogleVolume[]> {
  // Include author to avoid matching unrelated books with similar titles
  const q = encodeURIComponent(`intitle:"${seriesName}" inauthor:"${author}"`);
  const key = GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : '';
  const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=20${key}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as { items?: GoogleVolume[] };
  return data.items ?? [];
}

function extractISBN13(volume: GoogleVolume): string | null {
  const ids = volume.volumeInfo?.industryIdentifiers ?? [];
  return ids.find(id => id.type === 'ISBN_13')?.identifier ?? null;
}

function isNewRelease(publishedDate: string | undefined): boolean {
  if (!publishedDate) return false;
  const published = new Date(publishedDate);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NEW_RELEASE_WINDOW_DAYS);
  return published >= cutoff;
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
      ProjectionExpression: 'ISBN, title, author, #series, seriesPosition',
      ExclusiveStartKey: lastKey,
    }));
    seriesBooks.push(...(result.Items ?? []));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  // Group by series name
  const seriesMap: Record<string, { isbn: string; title: string; author: string; position?: number }[]> = {};
  for (const book of seriesBooks) {
    const s = book.series as string;
    if (!seriesMap[s]) seriesMap[s] = [];
    seriesMap[s].push({
      isbn: book.ISBN as string,
      title: book.title as string,
      author: book.author as string,
      position: book.seriesPosition as number | undefined,
    });
  }

  console.log(`seriesReleaseAgent: checking ${Object.keys(seriesMap).length} series`);

  let alertsCreated = 0;
  let emailsSent = 0;

  for (const [seriesName, catalogEntries] of Object.entries(seriesMap)) {
    const catalogISBNs = new Set(catalogEntries.map(e => e.isbn));
    const author = catalogEntries[0]?.author ?? '';

    // Weekly dedup: skip if we already ran this series check within 7 days
    const dedupKey = { PK: `SERIESCHECK#${seriesName}`, SK: 'METADATA' };
    const recentCheck = await db.send(new GetCommand({ TableName: TABLE, Key: dedupKey }));
    if (recentCheck.Item) {
      console.log(`seriesReleaseAgent: skipping "${seriesName}" — checked recently`);
      continue;
    }

    let volumes: GoogleVolume[];
    try {
      volumes = await fetchSeriesVolumes(seriesName, author);
    } catch (err) {
      console.error(`seriesReleaseAgent: Google Books API error for "${seriesName}"`, err);
      continue;
    }

    const missingBooks: { title: string; isbn: string; publishedDate: string }[] = [];
    const newReleases: { title: string; isbn: string; publishedDate: string }[] = [];

    for (const vol of volumes) {
      const isbn = extractISBN13(vol);
      if (!isbn || catalogISBNs.has(isbn)) continue;

      const title = vol.volumeInfo?.title ?? 'Unknown Title';
      const publishedDate = vol.volumeInfo?.publishedDate ?? '';

      missingBooks.push({ title, isbn, publishedDate });
      if (isNewRelease(publishedDate)) {
        newReleases.push({ title, isbn, publishedDate });
      }
    }

    // Write a single admin alert for this series if any books are missing from catalog
    if (missingBooks.length > 0) {
      const alertId = uuid();
      await db.send(new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `ALERT#${alertId}`,
          SK: 'METADATA',
          entityType: 'ALERT',
          alertId,
          type: 'series_missing',
          status: 'pending',
          alertStatus: 'pending',
          generatedAt: new Date().toISOString(),
          payload: {
            seriesName,
            author,
            catalogTitles: catalogEntries.map(e => e.title),
            missingBooks,
          },
        },
      }));
      alertsCreated++;
      console.log(`seriesReleaseAgent: alert created for "${seriesName}" — ${missingBooks.length} missing book(s)`);
    }

    // SES to borrowers only for genuine new releases (published within the last year)
    if (newReleases.length > 0) {
      const userEmails: Record<string, string> = {};
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

      for (const release of newReleases) {
        for (const [userId, email] of Object.entries(userEmails)) {
          const notifKey = { PK: `NOTIF#${userId}#${release.isbn}`, SK: 'METADATA' };
          const existing = await db.send(new GetCommand({ TableName: TABLE, Key: notifKey }));
          if (existing.Item) continue;

          await sendEmail(
            email,
            `New release in the "${seriesName}" series`,
            `Hi,\n\nA new book in the ${seriesName} series is available: "${release.title}" by ${author}.\n\nAsk your librarian to add it to the catalog, or request it at the front desk.\n\nHappy reading,\nLibrary Team`
          );

          const ttl = Math.floor(Date.now() / 1000) + NOTIF_TTL_DAYS * 24 * 60 * 60;
          await db.send(new PutCommand({
            TableName: TABLE,
            Item: { ...notifKey, entityType: 'NOTIF', userId, ISBN: release.isbn, sentAt: new Date().toISOString(), ttl },
          }));
          emailsSent++;
        }
      }
    }

    // Mark this series as checked — TTL 8 days so the weekly EventBridge trigger doesn't re-alert
    const ttl = Math.floor(Date.now() / 1000) + 8 * 24 * 60 * 60;
    await db.send(new PutCommand({
      TableName: TABLE,
      Item: { ...dedupKey, entityType: 'SERIESCHECK', seriesName, checkedAt: new Date().toISOString(), ttl },
    }));
  }

  console.log(`seriesReleaseAgent: done — ${alertsCreated} alerts created, ${emailsSent} emails sent`);
};
