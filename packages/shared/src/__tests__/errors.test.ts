import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  toErrorResponse,
} from '../errors';

describe('AppError subclasses', () => {
  it('ValidationError sets statusCode 400 and code VALIDATION_ERROR', () => {
    const err = new ValidationError('ISBN is required');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('ISBN is required');
    expect(err).toBeInstanceOf(AppError);
  });

  it('NotFoundError defaults to "Not found" message', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Not found');
  });

  it('NotFoundError accepts a custom message', () => {
    const err = new NotFoundError('Book not found');
    expect(err.message).toBe('Book not found');
  });

  it('ForbiddenError sets statusCode 403', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('UnauthorizedError sets statusCode 401', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('ConflictError sets statusCode 409 and code CONFLICT', () => {
    const err = new ConflictError('already exists');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('already exists');
  });
});

describe('toErrorResponse()', () => {
  const origin = 'http://localhost:5173';

  it('maps ValidationError → 400 with correct JSON body', () => {
    const result = toErrorResponse(new ValidationError('bad input'), origin);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('bad input');
    expect(body.error.statusCode).toBe(400);
  });

  it('maps NotFoundError → 404', () => {
    const result = toErrorResponse(new NotFoundError('Book not found'), origin);
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error.code).toBe('NOT_FOUND');
  });

  it('maps ConflictError → 409', () => {
    const result = toErrorResponse(new ConflictError('conflict'), origin);
    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body).error.code).toBe('CONFLICT');
  });

  it('maps unknown errors → 500 INTERNAL_ERROR', () => {
    const result = toErrorResponse(new Error('something exploded'), origin);
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
  });

  it('maps non-Error throws → 500', () => {
    const result = toErrorResponse('a string was thrown', origin);
    expect(result.statusCode).toBe(500);
  });

  it('sets CORS headers on every response', () => {
    const result = toErrorResponse(new ValidationError('x'), origin);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe(origin);
    expect(result.headers?.['Access-Control-Allow-Credentials']).toBe('true');
  });
});
