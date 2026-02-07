import { Hono } from 'hono';
import type { Env } from './index';

export const auth = new Hono<{ Bindings: Env }>();

// Simple password hashing using Web Crypto (no external deps)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'threatsynth-salt-2026');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Simple JWT using Web Crypto
async function createToken(payload: Record<string, any>): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode('threatsynth-jwt-secret-2026'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${header}.${body}.${signature}`;
}

export async function verifyToken(token: string): Promise<{ id: number; email: string; name: string } | null> {
  try {
    const [header, body, signature] = token.split('.');
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode('threatsynth-jwt-secret-2026'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const expectedSig = new Uint8Array(atob(signature).split('').map(c => c.charCodeAt(0)));
    const valid = await crypto.subtle.verify('HMAC', key, expectedSig, encoder.encode(`${header}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp < Date.now()) return null;
    return { id: payload.id, email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}

// Register
auth.post('/register', async (c) => {
  const { email, password, name } = await c.req.json();
  if (!email || !password) return c.json({ detail: 'Email and password required' }, 400);
  if (password.length < 6) return c.json({ detail: 'Password must be at least 6 characters' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();
  if (existing) return c.json({ detail: 'Email already registered' }, 409);

  const hash = await hashPassword(password);
  const result = await c.env.DB.prepare(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)'
  ).bind(email.toLowerCase(), hash, name || email.split('@')[0]).run();

  const user = { id: result.meta.last_row_id, email: email.toLowerCase(), name: name || email.split('@')[0] };
  const token = await createToken(user);

  return c.json({ user, token }, 201);
});

// Login
auth.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ detail: 'Email and password required' }, 400);

  const user = await c.env.DB.prepare(
    'SELECT id, email, password_hash, name FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first<{ id: number; email: string; password_hash: string; name: string }>();

  if (!user) return c.json({ detail: 'Invalid email or password' }, 401);

  const hash = await hashPassword(password);
  if (hash !== user.password_hash) return c.json({ detail: 'Invalid email or password' }, 401);

  const token = await createToken({ id: user.id, email: user.email, name: user.name });
  return c.json({ user: { id: user.id, email: user.email, name: user.name }, token });
});

// Get current user
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ detail: 'Not authenticated' }, 401);

  const user = await verifyToken(authHeader.slice(7));
  if (!user) return c.json({ detail: 'Invalid or expired token' }, 401);

  return c.json({ user });
});
