import type { Role } from './library';

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    statusCode: number;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  role: Role;
}
