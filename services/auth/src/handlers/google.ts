import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamo, TABLE, signToken, toErrorResponse, corsOrigin, ValidationError } from '@library/shared';
import { exchangeCodeForTokens, verifyIdToken } from '../lib/googleOAuth';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const origin = corsOrigin(event);
  try {
    if (!event.body) throw new ValidationError('Request body is required');

    const body = JSON.parse(event.body) as { code?: string; redirectUri?: string };
    if (!body.code) throw new ValidationError('code is required');
    if (!body.redirectUri) throw new ValidationError('redirectUri is required');

    const tokens = await exchangeCodeForTokens(body.code, body.redirectUri);
    const googleUser = await verifyIdToken(tokens.id_token);

    const db = getDynamo();
    const userId = `google_${googleUser.sub}`;

    // Check if user already exists to preserve their role
    const existing = await db.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `USER#${userId}`, SK: 'METADATA' },
    }));

    const role = (existing.Item?.role as string) ?? 'member';

    const now = new Date().toISOString();
    await db.send(new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `USER#${userId}`,
        SK: 'METADATA',
        entityType: 'USER',
        userId,
        email: googleUser.email,
        name: googleUser.name,
        role,
        googleId: googleUser.sub,
        createdAt: existing.Item?.createdAt ?? now,
        updatedAt: now,
      },
    }));

    const accessToken = signToken({
      sub: userId,
      email: googleUser.email,
      name: googleUser.name,
      role: role as 'member' | 'librarian',
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          accessToken,
          user: { id: userId, email: googleUser.email, name: googleUser.name, role },
        },
      }),
    };
  } catch (err) {
    return toErrorResponse(err, origin);
  }
}
