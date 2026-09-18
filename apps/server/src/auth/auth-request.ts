import type { FastifyRequest } from 'fastify';

export interface AuthContext {
  sessionId: string;
  userId: string;
}

export type AuthenticatedRequest = FastifyRequest & { auth?: AuthContext };

export function requireAuthContext(request: AuthenticatedRequest): AuthContext {
  if (!request.auth) throw new Error('Authentication context is missing');

  return request.auth;
}
