import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withAuth, ok } from '@library/shared';

export const handler = withAuth(async (_event: APIGatewayProxyEvent, auth) => {
  return ok({ id: auth.userId, email: auth.email, name: auth.name, role: auth.role });
});
