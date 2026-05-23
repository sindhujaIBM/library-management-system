/**
 * Seeds demo admin alerts so the Alerts UI can be tested before
 * the background agents (demandDetectionAgent, staleInventoryAgent) are built.
 *
 * Usage:
 *   node scripts/seed-alerts.mjs
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';

const TABLE  = process.env.DYNAMO_TABLE || 'library-dev';
const REGION = process.env.AWS_REGION   || 'ca-west-1';

const db = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

const DAY = 24 * 60 * 60 * 1000;
function daysAgo(n) { return new Date(Date.now() - n * DAY).toISOString(); }

const ALERTS = [
  // ── Demand order alerts (high-demand books) ─────────────────────────────
  {
    type: 'demand_order',
    status: 'pending',
    generatedAt: daysAgo(0),
    payload: {
      ISBN: '978-1-250-28769-2',
      title: 'Fourth Wing',
      author: 'Rebecca Yarros',
      currentCopies: 2,
      activeLoanCount: 2,
      holdQueueLength: 4,
      recommendedCopiesOrdered: 3,
      estimatedCostCAD: 89.97,
      reasoning: 'Hold queue has grown to 4 patrons with both copies continuously on loan for 10+ days. Ordering 3 additional copies would clear the queue within one loan cycle.',
      amazonSearchUrl: 'https://www.amazon.ca/s?k=Fourth+Wing+Rebecca+Yarros',
    },
  },
  {
    type: 'demand_order',
    status: 'pending',
    generatedAt: daysAgo(1),
    payload: {
      ISBN: '978-0-593-13520-4',
      title: 'Project Hail Mary',
      author: 'Andy Weir',
      currentCopies: 2,
      activeLoanCount: 2,
      holdQueueLength: 4,
      recommendedCopiesOrdered: 2,
      estimatedCostCAD: 49.98,
      reasoning: 'Consistent demand over past 3 months with 12 total loans. Hold queue of 4 suggests purchasing 2 additional copies is justified.',
      amazonSearchUrl: 'https://www.amazon.ca/s?k=Project+Hail+Mary+Andy+Weir',
    },
  },
  {
    type: 'demand_order',
    status: 'pending',
    generatedAt: daysAgo(2),
    payload: {
      ISBN: '978-0-593-32121-1',
      title: 'Tomorrow, and Tomorrow, and Tomorrow',
      author: 'Gabrielle Zevin',
      currentCopies: 2,
      activeLoanCount: 2,
      holdQueueLength: 4,
      recommendedCopiesOrdered: 2,
      estimatedCostCAD: 43.98,
      reasoning: 'Strong borrowing pattern across diverse patron demographics. 12 loans in 8 months indicates sustained interest beyond initial bestseller hype.',
      amazonSearchUrl: 'https://www.amazon.ca/s?k=Tomorrow+and+Tomorrow+Gabrielle+Zevin',
    },
  },

  // ── Stale inventory alerts ───────────────────────────────────────────────
  {
    type: 'stale_auction',
    status: 'pending',
    generatedAt: daysAgo(3),
    payload: {
      ISBN: '978-0-14-143955-6',
      title: 'Wuthering Heights',
      author: 'Emily Brontë',
      lastBorrowedDate: daysAgo(350),
      daysSinceLastLoan: 350,
      currentCopies: 2,
      suggestedAction: 'Deaccession 1 copy via Friends of the Library book sale',
      suggestedStartingPriceCAD: 4.00,
      reasoning: 'No borrowing activity in 350 days despite shelf availability. Retaining 1 copy for collection completeness while deaccessioning the duplicate is reasonable.',
    },
  },
  {
    type: 'stale_auction',
    status: 'pending',
    generatedAt: daysAgo(4),
    payload: {
      ISBN: '978-0-14-028227-6',
      title: 'East of Eden',
      author: 'John Steinbeck',
      lastBorrowedDate: daysAgo(320),
      daysSinceLastLoan: 320,
      currentCopies: 2,
      suggestedAction: 'Deaccession 1 copy via Friends of the Library book sale',
      suggestedStartingPriceCAD: 5.00,
      reasoning: '320 days without a loan. Collection already has Of Mice and Men and Grapes of Wrath by the same author with higher circulation. Reduce East of Eden to 1 copy.',
    },
  },
  {
    type: 'stale_auction',
    status: 'pending',
    generatedAt: daysAgo(5),
    payload: {
      ISBN: '978-0-14-303943-3',
      title: 'The Grapes of Wrath',
      author: 'John Steinbeck',
      lastBorrowedDate: daysAgo(260),
      daysSinceLastLoan: 260,
      currentCopies: 2,
      suggestedAction: 'Deaccession 1 copy via Friends of the Library book sale',
      suggestedStartingPriceCAD: 4.00,
      reasoning: 'Marginal borrowing activity. 260 days without loan. 1 copy sufficient for a collection of this size.',
    },
  },

  // ── Already resolved alerts (for the approved/rejected tabs) ────────────
  {
    type: 'demand_order',
    status: 'approved',
    generatedAt: daysAgo(14),
    resolvedAt: daysAgo(13),
    payload: {
      ISBN: '978-0-8041-3902-8',
      title: 'The Martian',
      author: 'Andy Weir',
      currentCopies: 2,
      holdQueueLength: 5,
      recommendedCopiesOrdered: 2,
      estimatedCostCAD: 43.98,
      reasoning: 'Sustained demand — 12 loans, 5 on hold queue.',
      amazonSearchUrl: 'https://www.amazon.ca/s?k=The+Martian+Andy+Weir',
    },
  },
  {
    type: 'stale_auction',
    status: 'rejected',
    generatedAt: daysAgo(10),
    resolvedAt: daysAgo(9),
    payload: {
      ISBN: '978-0-684-80122-3',
      title: 'The Old Man and the Sea',
      author: 'Ernest Hemingway',
      lastBorrowedDate: daysAgo(210),
      daysSinceLastLoan: 210,
      currentCopies: 2,
      suggestedAction: 'Deaccession 1 copy',
      suggestedStartingPriceCAD: 5.00,
      reasoning: 'Low recent circulation.',
    },
  },
];

console.log(`\nSeeding ${ALERTS.length} alerts into ${TABLE}...\n`);

let added = 0;
for (const alert of ALERTS) {
  const alertId = uuid();
  await db.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `ALERT#${alertId}`,
      SK: 'METADATA',
      entityType: 'ALERT',
      alertId,
      type: alert.type,
      status: alert.status,
      alertStatus: alert.status,   // GSI5 key
      payload: alert.payload,
      generatedAt: alert.generatedAt,
      resolvedAt: alert.resolvedAt,
    },
  }));
  console.log(`  ${alert.status.padEnd(8)} ${alert.type === 'demand_order' ? '📦' : '🏷️ '} ${alert.payload.title}`);
  added++;
}

console.log(`\n✓ ${added} alerts written. Open /admin/alerts to review.\n`);
