import { Hono } from 'hono';
import type { Env } from '../index';
import { optionalAuth } from '../middleware';

export const briefings = new Hono<{ Bindings: Env }>();

briefings.use('/*', optionalAuth);

// List briefings with threat + asset data (scoped to user)
briefings.get('/', async (c) => {
  const user = c.get('user') as any;
  const userFilter = user ? 'AND b.user_id = ?' : 'AND b.user_id IS NULL';
  const rows = user
    ? await c.env.DB.prepare(`
        SELECT b.*, t.source_id as threat_source_id, t.severity as threat_severity, t.title as threat_title, t.source as threat_source,
          a.name as asset_name, a.version as asset_version, a.vendor as asset_vendor
        FROM briefings b LEFT JOIN threats t ON b.threat_id = t.id LEFT JOIN assets a ON b.asset_id = a.id
        WHERE b.user_id = ? ORDER BY b.priority_score DESC
      `).bind(user.id).all()
    : await c.env.DB.prepare(`
        SELECT b.*, t.source_id as threat_source_id, t.severity as threat_severity, t.title as threat_title, t.source as threat_source,
          a.name as asset_name, a.version as asset_version, a.vendor as asset_vendor
        FROM briefings b LEFT JOIN threats t ON b.threat_id = t.id LEFT JOIN assets a ON b.asset_id = a.id
        WHERE b.user_id IS NULL ORDER BY b.priority_score DESC
      `).all();

  const mapped = rows.results.map((r: any) => ({
    id: r.id, threat_id: r.threat_id, asset_id: r.asset_id,
    summary: r.summary, remediation: r.remediation, business_impact: r.business_impact,
    priority_score: r.priority_score, status: r.status, created_at: r.created_at,
    threat: { id: r.threat_id, source_id: r.threat_source_id, severity: r.threat_severity, title: r.threat_title, source: r.threat_source },
    asset: { id: r.asset_id, name: r.asset_name, version: r.asset_version, vendor: r.asset_vendor },
  }));

  return c.json({ briefings: mapped, total: mapped.length });
});

// Generate briefings using Workers AI (scoped to user's assets)
briefings.post('/generate', async (c) => {
  const user = c.get('user') as any;
  const userAssets = user
    ? await c.env.DB.prepare('SELECT * FROM assets WHERE user_id = ?').bind(user.id).all()
    : await c.env.DB.prepare('SELECT * FROM assets WHERE user_id IS NULL').all();
  const threats = await c.env.DB.prepare(
    "SELECT * FROM threats WHERE severity IN ('critical', 'high') ORDER BY cvss_score DESC LIMIT 50"
  ).all();

  if (userAssets.results.length === 0) return c.json({ detail: 'No assets registered. Add assets first.' }, 400);
  if (threats.results.length === 0) return c.json({ detail: 'No threats ingested. Ingest threats first.' }, 400);

  let generated = 0;

  for (const asset of userAssets.results) {
    const a = asset as any;
    const matching = threats.results.filter((t: any) => {
      if (!a.vendor && !a.product) return false;
      const vendorMatch = a.vendor && t.affected_vendor && a.vendor.toLowerCase().includes(t.affected_vendor.toLowerCase());
      const productMatch = a.product && t.affected_product && a.product.toLowerCase().includes(t.affected_product.toLowerCase());
      return vendorMatch || productMatch;
    });

    const toProcess = matching.length > 0 ? matching.slice(0, 3) : threats.results.slice(0, 2);

    for (const threat of toProcess) {
      const t = threat as any;

      const existing = await c.env.DB.prepare(
        'SELECT id FROM briefings WHERE threat_id = ? AND asset_id = ?'
      ).bind(t.id, a.id).first();
      if (existing) continue;

      const cvssWeight = (t.cvss_score || 5) / 10;
      const exploitWeight = t.exploits_available ? 0.2 : 0;
      const activeWeight = t.actively_exploited ? 0.3 : 0;
      const matchWeight = matching.includes(threat) ? 0.2 : 0;
      const priority = Math.min(10, (cvssWeight + exploitWeight + activeWeight + matchWeight) * 10);

      let summary = '', remediation = '', businessImpact = '';
      try {
        const prompt = `You are a cybersecurity analyst. Generate a brief security briefing.

Threat: ${t.source_id} - ${t.title}
Description: ${(t.description || '').slice(0, 300)}
CVSS: ${t.cvss_score || 'N/A'} | Severity: ${t.severity}
Actively exploited: ${t.actively_exploited ? 'Yes' : 'No'}

Affected Asset: ${a.name} (${a.vendor} ${a.product} ${a.version})

Respond in this exact format (no markdown):
SUMMARY: [2-3 sentence analysis of the threat impact on this specific asset]
REMEDIATION: [3-5 numbered steps to mitigate]
IMPACT: [1-2 sentences on business impact]`;

        const aiResult = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
        });

        const text = aiResult.response || '';
        summary = text.match(/SUMMARY:\s*([\s\S]*?)(?=REMEDIATION:|$)/i)?.[1]?.trim() || text.slice(0, 200);
        remediation = text.match(/REMEDIATION:\s*([\s\S]*?)(?=IMPACT:|$)/i)?.[1]?.trim() || '';
        businessImpact = text.match(/IMPACT:\s*([\s\S]*?)$/i)?.[1]?.trim() || '';
      } catch {
        summary = `${t.source_id} (${t.severity}) affects ${a.name}. CVSS ${t.cvss_score || 'N/A'}.${t.actively_exploited ? ' Actively exploited in the wild.' : ''}`;
        remediation = `1. Review ${a.name} for exposure to ${t.source_id}\n2. Apply vendor patches immediately\n3. Monitor for indicators of compromise`;
        businessImpact = `Potential ${t.severity}-severity impact on ${a.name} infrastructure.`;
      }

      await c.env.DB.prepare(`INSERT INTO briefings (threat_id, asset_id, summary, remediation, business_impact, priority_score, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(t.id, a.id, summary, remediation, businessImpact, Math.round(priority * 10) / 10, user?.id || null)
        .run();
      generated++;
    }
  }

  return c.json({ status: 'completed', generated });
});

// Update briefing status
briefings.patch('/:id/status', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const status = body.status;
  if (!['new', 'acknowledged', 'in_progress', 'resolved'].includes(status)) {
    return c.json({ detail: 'Invalid status' }, 400);
  }
  await c.env.DB.prepare('UPDATE briefings SET status = ? WHERE id = ?').bind(status, id).run();
  return c.json({ ok: true });
});
