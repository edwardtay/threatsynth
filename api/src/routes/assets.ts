import { Hono } from 'hono';
import type { Env } from '../index';

export const assets = new Hono<{ Bindings: Env }>();

// List all assets
assets.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM assets ORDER BY created_at DESC').all();
  return c.json(rows.results);
});

// Create asset
assets.post('/', async (c) => {
  const body = await c.req.json();
  const { name, type, vendor, product, version, port, network } = body;
  if (!name) return c.json({ detail: 'name is required' }, 400);

  const result = await c.env.DB.prepare(
    'INSERT INTO assets (name, type, vendor, product, version, port, network) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(name, type || 'server', vendor || null, product || null, version || null, port || null, network || null)
    .run();

  const asset = await c.env.DB.prepare('SELECT * FROM assets WHERE id = ?').bind(result.meta.last_row_id).first();
  return c.json(asset, 201);
});

// Delete asset
assets.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM assets WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// Import YAML assets
assets.post('/import-yaml', async (c) => {
  const body = await c.req.json();
  const yaml = body.yaml_content || '';

  // Simple YAML-like parser for asset lists
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
      'INSERT INTO assets (name, type, vendor, product, version, port, network) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(
        name,
        get('type') || 'server',
        get('vendor'),
        get('product'),
        get('version'),
        get('port') ? parseInt(get('port')!) : null,
        get('network')
      )
      .run();
    count++;
  }

  return c.json({ imported: count });
});

// Network scan placeholder
assets.post('/scan', async (c) => {
  return c.json({ detail: 'Network scanning requires a local backend with nmap. Use the self-hosted version for this feature.' }, 501);
});
