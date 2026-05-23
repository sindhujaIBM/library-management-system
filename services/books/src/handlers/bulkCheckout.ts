import type { APIGatewayProxyEvent } from 'aws-lambda';
import { TransactWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { v4 as uuidv4 } from 'uuid';
import { withAuth, created, getDynamo, TABLE, ValidationError } from '@library/shared';

const ses = new SESClient({ region: 'us-east-1' });
const FROM = process.env.SES_FROM_EMAIL ?? 'noreply@maidlink.ca';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

interface CheckedOutBook {
  ISBN: string;
  bookTitle: string;
  bookAuthor: string;
  loanId: string;
  checkoutDate: string;
  returnDueDate: string;
}

interface FailedBook {
  ISBN: string;
  title?: string;
  reason: string;
}

export const handler = withAuth(async (event: APIGatewayProxyEvent, auth) => {
  if (!event.body) throw new ValidationError('Request body is required');
  const body = JSON.parse(event.body) as { ISBNs?: string[] };
  if (!Array.isArray(body.ISBNs) || body.ISBNs.length === 0) {
    throw new ValidationError('ISBNs must be a non-empty array');
  }
  if (body.ISBNs.length > 10) {
    throw new ValidationError('Cannot checkout more than 10 books at once');
  }

  const db = getDynamo();
  const succeeded: CheckedOutBook[] = [];
  const failed: FailedBook[] = [];

  for (const isbn of body.ISBNs) {
    const bookResult = await db.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `BOOK#${isbn}`, SK: 'METADATA' },
    }));

    if (!bookResult.Item) {
      failed.push({ ISBN: isbn, reason: 'Book not found' });
      continue;
    }
    if ((bookResult.Item.availableCopies as number) < 1) {
      failed.push({ ISBN: isbn, title: bookResult.Item.title as string, reason: 'No copies available' });
      continue;
    }

    const now = new Date();
    const checkoutDate = now.toISOString();
    const returnDueDate = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString();
    const loanId = uuidv4();
    const loanSK = `LOAN#${auth.userId}#${checkoutDate}`;

    try {
      await db.send(new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: TABLE,
              Key: { PK: `BOOK#${isbn}`, SK: 'METADATA' },
              UpdateExpression: 'SET availableCopies = availableCopies - :one, copiesOnLoan = copiesOnLoan + :one, lastBorrowedDate = :now, updatedAt = :now',
              ConditionExpression: 'availableCopies > :zero',
              ExpressionAttributeValues: { ':one': 1, ':zero': 0, ':now': checkoutDate },
            },
          },
          {
            Put: {
              TableName: TABLE,
              Item: {
                PK: `LOAN#${isbn}`,
                SK: loanSK,
                entityType: 'LOAN',
                loanId,
                ISBN: isbn,
                userId: auth.userId,
                userEmail: auth.email,
                userName: auth.name,
                bookTitle: bookResult.Item.title,
                bookAuthor: bookResult.Item.author,
                checkoutDate,
                returnDueDate,
                status: 'active',
                renewalCount: 0,
              },
            },
          },
        ],
      }));

      succeeded.push({
        ISBN: isbn,
        bookTitle: bookResult.Item.title as string,
        bookAuthor: bookResult.Item.author as string,
        loanId,
        checkoutDate,
        returnDueDate,
      });
    } catch (err: unknown) {
      const isRaceCondition = err instanceof Error && err.name === 'TransactionCanceledException';
      failed.push({
        ISBN: isbn,
        title: bookResult.Item.title as string,
        reason: isRaceCondition ? 'No copies available — someone just borrowed the last one' : 'Checkout failed',
      });
    }
  }

  // Send one summary email if at least one book was checked out
  if (succeeded.length > 0) {
    const bookLines = succeeded
      .map((b, i) =>
        `  ${i + 1}. ${b.bookTitle} by ${b.bookAuthor}\n` +
        `     Checked out: ${formatDate(b.checkoutDate)}\n` +
        `     Due date:    ${formatDate(b.returnDueDate)}`
      )
      .join('\n\n');

    const failedNote = failed.length > 0
      ? `\n\nNote: ${failed.length} book${failed.length > 1 ? 's' : ''} could not be checked out:\n` +
        failed.map(f => `  - ${f.title ?? f.ISBN}: ${f.reason}`).join('\n')
      : '';

    const body =
      `Hi ${auth.name},\n\n` +
      `You've successfully checked out ${succeeded.length} book${succeeded.length > 1 ? 's' : ''}:\n\n` +
      `${bookLines}\n\n` +
      `Loan period: 21 days. If no one is waiting, your loan will be automatically renewed once for an additional 21 days.` +
      `${failedNote}\n\n` +
      `Thank you,\nLibrary Team`;

    try {
      await ses.send(new SendEmailCommand({
        Source: FROM,
        Destination: { ToAddresses: [auth.email] },
        Message: {
          Subject: { Data: `Checkout confirmed — ${succeeded.length} book${succeeded.length > 1 ? 's' : ''} borrowed` },
          Body: { Text: { Data: body } },
        },
      }));
    } catch (sesErr) {
      // Email failure is non-fatal — loans are already written
      console.error('bulkCheckout: SES send failed', sesErr);
    }
  }

  return created({ succeeded, failed });
});
