import { QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { getDynamo, TABLE } from '@library/shared';

const ses = new SESClient({ region: 'us-east-1' });
const FROM = process.env.SES_FROM_EMAIL ?? 'noreply@maidlink.ca';
const CONFIG_SET = process.env.SES_CONFIG_SET;

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  await ses.send(new SendEmailCommand({
    Source: FROM,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Text: { Data: body } },
    },
    ConfigurationSetName: CONFIG_SET,
  }));
}

function toDateStr(iso: string): string {
  return iso.slice(0, 10); // 'YYYY-MM-DD'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

function diffDays(dueDateIso: string, todayStr: string): number {
  const due = new Date(toDateStr(dueDateIso));
  const today = new Date(todayStr);
  return Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export const handler = async (): Promise<void> => {
  const db = getDynamo();
  const todayStr = toDateStr(new Date().toISOString());

  // Query all active loans from GSI4, sorted by returnDueDate ascending
  const allLoans: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI4-status-returnDueDate',
      KeyConditionExpression: '#status = :active',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':active': 'active' },
      ScanIndexForward: true,
      ExclusiveStartKey: lastKey,
    }));
    allLoans.push(...(result.Items ?? []));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  console.log(`loanLifecycleAgent: processing ${allLoans.length} active loans`);

  let reminders = 0, renewals = 0, blocked = 0, finalDue = 0, overdue = 0;

  for (const loan of allLoans) {
    const diff = diffDays(loan.returnDueDate as string, todayStr);
    const name = loan.userName as string;
    const email = loan.userEmail as string;
    const title = loan.bookTitle as string;
    const dueFormatted = formatDate(loan.returnDueDate as string);
    const isbn = loan.ISBN as string;
    const renewalCount = (loan.renewalCount as number) ?? 0;

    if (diff === 3) {
      // 3-day reminder
      await sendEmail(
        email,
        `Reminder: "${title}" is due in 3 days`,
        `Hi ${name},\n\nThis is a reminder that "${title}" is due back on ${dueFormatted}.\n\nPlease return it to the library by that date.\n\nThank you,\nLibrary Team`
      );
      reminders++;

    } else if (diff === 0 && renewalCount === 0) {
      // Due today — check for holds
      const holdsResult = await db.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `WAITLIST#${isbn}` },
        ScanIndexForward: true, // sort by SK (USER#userId) — we'll re-sort by joinedAt for the "next" person
      }));
      const holdItems = holdsResult.Items ?? [];

      if (holdItems.length === 0) {
        // Auto-renew
        const newDueDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
        const now = new Date().toISOString();
        await db.send(new TransactWriteCommand({
          TransactItems: [{
            Update: {
              TableName: TABLE,
              Key: { PK: loan.PK as string, SK: loan.SK as string },
              UpdateExpression: 'SET returnDueDate = :newDue, renewalCount = :one, autoRenewedAt = :now',
              ExpressionAttributeValues: { ':newDue': newDueDate, ':one': 1, ':now': now },
            },
          }],
        }));
        await sendEmail(
          email,
          `"${title}" has been automatically renewed`,
          `Hi ${name},\n\nYour loan of "${title}" has been automatically renewed. Your new due date is ${formatDate(newDueDate)}.\n\nNote: no further renewals are available after this date.\n\nThank you,\nLibrary Team`
        );
        renewals++;

      } else {
        // Holds exist — cannot renew, notify borrower and next in queue
        await sendEmail(
          email,
          `"${title}" is due today — holds on file`,
          `Hi ${name},\n\nYour loan of "${title}" is due today (${dueFormatted}).\n\nBecause other patrons are waiting for this book, it cannot be renewed. Please return it to the library today.\n\nThank you,\nLibrary Team`
        );

        // Notify next person on hold queue (sort by joinedAt ascending)
        const sorted = holdItems.sort((a, b) =>
          String(a.joinedAt).localeCompare(String(b.joinedAt))
        );
        const next = sorted[0];
        if (next?.userEmail) {
          await sendEmail(
            next.userEmail as string,
            `Good news: "${title}" will be available soon`,
            `Hi ${next.userName as string},\n\nThe copy of "${title}" you're waiting for is due back today and the current borrower has been asked to return it.\n\nWe'll notify you when it's ready to pick up.\n\nThank you,\nLibrary Team`
          );
        }
        blocked++;
      }

    } else if (diff === 0 && renewalCount >= 1) {
      // Due today, already renewed once — final notice
      await sendEmail(
        email,
        `"${title}" is due today — no further renewals`,
        `Hi ${name},\n\nYour loan of "${title}" is due today (${dueFormatted}). This book has already been renewed once and cannot be renewed again.\n\nPlease return it to the library today.\n\nThank you,\nLibrary Team`
      );
      finalDue++;

    } else if (diff < 0) {
      // Overdue — send daily until returned
      const daysOverdue = Math.abs(diff);
      await sendEmail(
        email,
        `Overdue notice: "${title}" was due ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} ago`,
        `Hi ${name},\n\nYour loan of "${title}" was due on ${dueFormatted} and is now ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue.\n\nPlease return it to the library as soon as possible.\n\nThank you,\nLibrary Team`
      );
      overdue++;
    }
  }

  console.log(
    `loanLifecycleAgent: done — reminders=${reminders} renewals=${renewals} blocked=${blocked} finalDue=${finalDue} overdue=${overdue}`
  );
};
