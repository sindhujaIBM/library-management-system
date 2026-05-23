/**
 * Promotes a user to librarian role in DynamoDB.
 *
 * Usage:
 *   node scripts/make-librarian.mjs <userId>
 *
 * The userId is the value shown in the JWT — it's `google_<googleSub>`.
 * You can find it by signing in and checking localStorage:
 *   JSON.parse(localStorage.getItem('library_user')).id
 *
 * Or pass your email and this script will scan for the user.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const TABLE = process.env.DYNAMO_TABLE || 'library-dev';
const REGION = process.env.AWS_REGION || 'ca-west-1';

const base = new DynamoDBClient({ region: REGION });
const db = DynamoDBDocumentClient.from(base, { marshallOptions: { removeUndefinedValues: true } });

const arg = process.argv[2];
if (!arg) {
  console.error('\nUsage: node scripts/make-librarian.mjs <userId|email>\n');
  process.exit(1);
}

let userId = arg;

// If arg looks like an email, scan to find the userId
if (arg.includes('@')) {
  console.log(`\nLooking up user by email: ${arg}`);
  const result = await db.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: 'entityType = :et AND email = :email',
    ExpressionAttributeValues: { ':et': 'USER', ':email': arg },
  }));
  if (!result.Items?.length) {
    console.error(`\n✗ No user found with email ${arg}`);
    console.error('  Sign in to the app first, then re-run this script.\n');
    process.exit(1);
  }
  userId = result.Items[0].userId;
  console.log(`  Found userId: ${userId}`);
}

await db.send(new UpdateCommand({
  TableName: TABLE,
  Key: { PK: `USER#${userId}`, SK: 'METADATA' },
  UpdateExpression: 'SET #role = :role, updatedAt = :now',
  ExpressionAttributeNames: { '#role': 'role' },
  ExpressionAttributeValues: { ':role': 'librarian', ':now': new Date().toISOString() },
}));

console.log(`\n✓ ${userId} is now a librarian.`);
console.log('  Sign out and back in to get a fresh JWT with the new role.\n');
