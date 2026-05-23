import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { verifyToken } from '../jwt';
import type { AuthContext, JwtPayload } from '../types/api';
import type { Role } from '../types/library';
import { toErrorResponse, ForbiddenError } from '../errors';

type AuthenticatedHandler = (
  event: APIGatewayProxyEvent,
  auth: AuthContext
) => Promise<APIGatewayProxyResult>;

const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(o => o.trim())
);

export function corsOrigin(event: { headers?: Record<string, string | undefined> | null }): string {
  const origin = event.headers?.origin ?? event.headers?.Origin ?? '';
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  // Fall back to first allowed origin (covers server-side calls with no Origin header)
  return [...ALLOWED_ORIGINS][0];
}

export function withAuth(fn: AuthenticatedHandler, requiredRole?: Role) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const origin = corsOrigin(event);
    try {
      const payload: JwtPayload = verifyToken(
        event.headers?.Authorization || event.headers?.authorization
      );

      const auth: AuthContext = {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };

      if (requiredRole && auth.role !== requiredRole) {
        throw new ForbiddenError('Librarian access required');
      }

      const result = await fn(event, auth);
      return { ...result, headers: { ...result.headers, 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' } };
    } catch (err) {
      return toErrorResponse(err, origin);
    }
  };
}

export function ok<T>(data: T, origin = 'http://localhost:5173'): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  };
}

export function created<T>(data: T, origin = 'http://localhost:5173'): APIGatewayProxyResult {
  return {
    statusCode: 201,
    headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  };
}
