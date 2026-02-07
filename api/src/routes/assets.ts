import { Hono } from 'hono';
import type { Env } from '../index';
import { optionalAuth, requireAuth } from '../middleware';

export const assets = new Hono<{ Bindings: Env }>();

assets.use('/*', optionalAuth);

// List assets (scoped to user if logged in)
assets.get('/', async (c) => {
  const user = c.get('user') as any;
  const stmt = user
    ? c.env.DB.prepare('SELECT * FROM assets WHERE user_id = ? ORDER BY created_at DESC').bind(user.id)
    : c.env.DB.prepare('SELECT * FROM assets WHERE user_id IS NULL ORDER BY created_at DESC');
  const rows = await stmt.all();
  return c.json(rows.results);
});

// Create asset
assets.post('/', async (c) => {
  const body = await c.req.json();
  const { name, type, vendor, product, version, port, network } = body;
  if (!name) return c.json({ detail: 'name is required' }, 400);
  const user = c.get('user') as any;

  const result = await c.env.DB.prepare(
    'INSERT INTO assets (name, type, vendor, product, version, port, network, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(name, type || 'server', vendor || null, product || null, version || null, port || null, network || null, user?.id || null)
    .run();

  const asset = await c.env.DB.prepare('SELECT * FROM assets WHERE id = ?').bind(result.meta.last_row_id).first();
  return c.json(asset, 201);
});

// Delete asset
assets.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user') as any;
  if (user) {
    await c.env.DB.prepare('DELETE FROM assets WHERE id = ? AND user_id = ?').bind(id, user.id).run();
  } else {
    await c.env.DB.prepare('DELETE FROM assets WHERE id = ? AND user_id IS NULL').bind(id).run();
  }
  return c.json({ ok: true });
});

// Import YAML assets
assets.post('/import-yaml', async (c) => {
  const body = await c.req.json();
  const yaml = body.yaml_content || '';
  const user = c.get('user') as any;

  const assetBlocks = yaml.split(/^  - /m).filter((b: string) => b.trim());
  let count = 0;

  for (const block of assetBlocks) {
    const get = (key: string) => {
      const m = block.match(new RegExp(`${key}:\\s*"?([^"\\n]+)"?`));
      return m ? m[1].trim() : null;
    };
    const name = get('name');
    if (!name) continue;

    await c.env.DB.prepare(
      'INSERT INTO assets (name, type, vendor, product, version, port, network, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(name, get('type') || 'server', get('vendor'), get('product'), get('version'),
        get('port') ? parseInt(get('port')!) : null, get('network'), user?.id || null)
      .run();
    count++;
  }

  return c.json({ imported: count });
});

// Network scan placeholder
assets.post('/scan', async (c) => {
  return c.json({ detail: 'Network scanning requires a local backend with nmap. Use the self-hosted version for this feature.' }, 501);
});
