import { Hono } from 'hono';
import type { Env } from '../index';
import { optionalAuth } from '../middleware';

export const dashboard = new Hono<{ Bindings: Env }>();

dashboard.use('/*', optionalAuth);

dashboard.get('/stats', async (c) => {
  const db = c.env.DB;
  const user = c.get('user') as any;

  // Assets and briefings are user-scoped; threats are global
  const assetFilter = user ? 'WHERE user_id = ?' : 'WHERE user_id IS NULL';
  const briefingFilter = user ? 'WHERE user_id = ?' : 'WHERE user_id IS NULL';
  const bindVal = user?.id;

  const [totalAssets, totalThreats, criticalThreats, activeExploits, pendingBriefings, resolvedBriefings, severityCounts, sourceCounts] = await Promise.all([
    bindVal != null
      ? db.prepare(`SELECT COUNT(*) as c FROM assets ${assetFilter}`).bind(bindVal).first<{ c: number }>()
      : db.prepare(`SELECT COUNT(*) as c FROM assets ${assetFilter}`).first<{ c: number }>(),
    db.prepare('SELECT COUNT(*) as c FROM threats').first<{ c: number }>(),
    db.prepare("SELECT COUNT(*) as c FROM threats WHERE severity = 'critical'").first<{ c: number }>(),
    db.prepare('SELECT COUNT(*) as c FROM threats WHERE actively_exploited = 1').first<{ c: number }>(),
    bindVal != null
      ? db.prepare(`SELECT COUNT(*) as c FROM briefings ${briefingFilter} AND status IN ('new', 'acknowledged', 'in_progress')`).bind(bindVal).first<{ c: number }>()
      : db.prepare(`SELECT COUNT(*) as c FROM briefings ${briefingFilter} AND status IN ('new', 'acknowledged', 'in_progress')`).first<{ c: number }>(),
    bindVal != null
      ? db.prepare(`SELECT COUNT(*) as c FROM briefings ${briefingFilter} AND status = 'resolved'`).bind(bindVal).first<{ c: number }>()
      : db.prepare(`SELECT COUNT(*) as c FROM briefings ${briefingFilter} AND status = 'resolved'`).first<{ c: number }>(),
    db.prepare('SELECT severity, COUNT(*) as c FROM threats GROUP BY severity').all(),
    db.prepare('SELECT source, COUNT(*) as c FROM threats GROUP BY source').all(),
  ]);

  const severityBreakdown: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const row of (severityCounts?.results || []) as any[]) severityBreakdown[row.severity] = row.c;

  const sourceBreakdown: Record<string, number> = {};
  for (const row of (sourceCounts?.results || []) as any[]) sourceBreakdown[row.source] = row.c;

  return c.json({
    total_assets: totalAssets?.c || 0,
    total_threats: totalThreats?.c || 0,
    critical_threats: criticalThreats?.c || 0,
    active_exploits: activeExploits?.c || 0,
    pending_briefings: pendingBriefings?.c || 0,
    resolved_briefings: resolvedBriefings?.c || 0,
    severity_breakdown: severityBreakdown,
    source_breakdown: sourceBreakdown,
  });
});

dashboard.get('/recent', async (c) => {
  const user = c.get('user') as any;
  const rows = user
    ? await c.env.DB.prepare(`
        SELECT b.*, t.source_id as threat_source_id, t.severity as threat_severity, a.name as asset_name
        FROM briefings b LEFT JOIN threats t ON b.threat_id = t.id LEFT JOIN assets a ON b.asset_id = a.id
        WHERE b.user_id = ? ORDER BY b.priority_score DESC LIMIT 10
      `).bind(user.id).all()
    : await c.env.DB.prepare(`
        SELECT b.*, t.source_id as threat_source_id, t.severity as threat_severity, a.name as asset_name
        FROM briefings b LEFT JOIN threats t ON b.threat_id = t.id LEFT JOIN assets a ON b.asset_id = a.id
        WHERE b.user_id IS NULL ORDER BY b.priority_score DESC LIMIT 10
      `).all();

  const mapped = rows.results.map((r: any) => ({
    id: r.id, summary: r.summary, priority_score: r.priority_score, status: r.status,
    threat: { severity: r.threat_severity, source_id: r.threat_source_id },
    asset: { name: r.asset_name },
  }));

  return c.json(mapped);
});
