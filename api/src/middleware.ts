import type { Context, Next } from 'hono';
import { verifyToken } from './auth';

// Middleware that extracts user from JWT if present, but doesn't block
export async function optionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const user = await verifyToken(authHeader.slice(7));
    if (user) c.set('user', user);
  }
  await next();
}

// Middleware that requires authentication
export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ detail: 'Authentication required' }, 401);
  }
  const user = await verifyToken(authHeader.slice(7));
  if (!user) return c.json({ detail: 'Invalid or expired token' }, 401);
  c.set('user', user);
  await next();
}
