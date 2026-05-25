How JWTs Are Created Here
The flow:

User signs in with Google → services/auth/src/handlers/google.ts calls signToken()
signToken() is in packages/shared/src/jwt.ts
The token is returned to the frontend and stored in localStorage
The actual signing code (packages/shared/src/jwt.ts):


export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '24h', algorithm: 'HS256' });
}
What goes into the payload (packages/shared/src/types/api.ts):


{
  sub: userId,       // "google_1234567890"
  email: string,
  name: string,
  role: 'member' | 'librarian',
  iat: number,       // issued at (added by jsonwebtoken)
  exp: number        // expires at (added by jsonwebtoken, 24h from now)
}
Where it's verified — every protected Lambda uses withAuth (packages/shared/src/middleware/withAuth.ts):


const payload = verifyToken(event.headers?.Authorization);
// extracts sub, email, name, role from the token



node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"