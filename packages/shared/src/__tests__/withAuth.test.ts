import { describe, it, expect, vi } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { withAuth } from '../middleware/withAuth';
import { signToken } from '../jwt';

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    headers: {},
    body: null,
    httpMethod: 'GET',
    path: '/',
    queryStringParameters: null,
    pathParameters: null,
    multiValueQueryStringParameters: null,
    multiValueHeaders: {},
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: '',
    isBase64Encoded: false,
    ...overrides,
  };
}

function makeToken(role: 'member' | 'librarian' = 'member'): string {
  return `Bearer ${signToken({ sub: 'user-123', email: 'test@example.com', name: 'Test User', role })}`;
}

describe('withAuth middleware', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const handler = withAuth(async () => ({ statusCode: 200, body: '{}', headers: {} }));
    const result = await handler(makeEvent({ headers: {} }));
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when token is not Bearer-prefixed', async () => {
    const handler = withAuth(async () => ({ statusCode: 200, body: '{}', headers: {} }));
    const result = await handler(makeEvent({ headers: { Authorization: 'Basic abc123' } }));
    expect(result.statusCode).toBe(401);
  });

  it('returns 401 when token is malformed', async () => {
    const handler = withAuth(async () => ({ statusCode: 200, body: '{}', headers: {} }));
    const result = await handler(makeEvent({ headers: { Authorization: 'Bearer not.a.real.token' } }));
    expect(result.statusCode).toBe(401);
  });

  it('returns 403 when member token used on librarian-only route', async () => {
    const handler = withAuth(
      async () => ({ statusCode: 200, body: '{}', headers: {} }),
      'librarian',
    );
    const result = await handler(makeEvent({ headers: { Authorization: makeToken('member') } }));
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).error.code).toBe('FORBIDDEN');
  });

  it('calls inner handler and passes auth context for a valid member token', async () => {
    const innerHandler = vi.fn(async (_event: APIGatewayProxyEvent, auth: { userId: string }) => ({
      statusCode: 200,
      body: JSON.stringify({ userId: auth.userId }),
      headers: {},
    }));
    const handler = withAuth(innerHandler);
    const result = await handler(makeEvent({ headers: { Authorization: makeToken('member') } }));
    expect(result.statusCode).toBe(200);
    expect(innerHandler).toHaveBeenCalledOnce();
    expect(JSON.parse(result.body).userId).toBe('user-123');
  });

  it('allows librarian token on librarian-only route', async () => {
    const handler = withAuth(
      async () => ({ statusCode: 200, body: '{}', headers: {} }),
      'librarian',
    );
    const result = await handler(makeEvent({ headers: { Authorization: makeToken('librarian') } }));
    expect(result.statusCode).toBe(200);
  });

  it('merges CORS headers into every successful response', async () => {
    const handler = withAuth(async () => ({ statusCode: 200, body: '{}', headers: {} }));
    const result = await handler(makeEvent({ headers: { Authorization: makeToken() } }));
    expect(result.headers?.['Access-Control-Allow-Origin']).toBeDefined();
    expect(result.headers?.['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('uses lowercase authorization header as fallback', async () => {
    const handler = withAuth(async () => ({ statusCode: 200, body: '{}', headers: {} }));
    const result = await handler(makeEvent({ headers: { authorization: makeToken() } }));
    expect(result.statusCode).toBe(200);
  });
});
