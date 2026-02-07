import { Hono } from 'hono';
import type { Env } from '../index';

export const threats = new Hono<{ Bindings: Env }>();

// List threats with optional filters
threats.get('/', async (c) => {
  const source = c.req.query('source');
  const severity = c.req.query('severity');

  let sql = 'SELECT * FROM threats';
  const conditions: string[] = [];
  const params: any[] = [];

  if (source) { conditions.push('source = ?'); params.push(source); }
  if (severity) { conditions.push('severity = ?'); params.push(severity); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';

  const stmt = c.env.DB.prepare(sql);
  const rows = params.length ? await stmt.bind(...params).all() : await stmt.all();

  // Map integer booleans to real booleans for frontend
  const mapped = rows.results.map((t: any) => ({
    ...t,
    exploits_available: !!t.exploits_available,
    actively_exploited: !!t.actively_exploited,
  }));

  return c.json({ threats: mapped, total: mapped.length });
});

// Ingest all sources
threats.post('/ingest', async (c) => {
  const results: Record<string, number> = {};
  const sources = ['nvd', 'cisa_kev', 'exploitdb', 'github', 'shodan', 'greynoise'];
  for (const src of sources) {
    try {
      results[src] = await ingestSource(c.env.DB, src);
    } catch (e: any) {
      results[src] = 0;
      console.error(`Failed to ingest ${src}:`, e.message);
    }
  }
  return c.json({ status: 'completed', results, total: Object.values(results).reduce((a, b) => a + b, 0) });
});

// Ingest single source
threats.post('/ingest/:source', async (c) => {
  const source = c.req.param('source');
  try {
    const count = await ingestSource(c.env.DB, source);
    return c.json({ source, ingested: count });
  } catch (e: any) {
    return c.json({ detail: e.message }, 500);
  }
});

// --- Ingestion logic ---

async function ingestSource(db: D1Database, source: string): Promise<number> {
  switch (source) {
    case 'nvd': return ingestNvd(db);
    case 'cisa_kev': return ingestCisaKev(db);
    case 'exploitdb': return ingestExploitdb(db);
    case 'github': return ingestGithub(db);
    case 'shodan': return ingestShodan(db);
    case 'greynoise': return ingestGreynoise(db);
    default: throw new Error(`Unknown source: ${source}`);
  }
}

function severityFromCvss(score: number | null): string {
  if (!score) return 'medium';
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  return 'low';
}

async function upsertThreat(db: D1Database, t: {
  source: string; source_id: string; title: string; description?: string;
  severity: string; cvss_score?: number; affected_vendor?: string;
  affected_product?: string; affected_version?: string;
  exploits_available?: boolean; actively_exploited?: boolean;
  published_date?: string;
}): Promise<boolean> {
  // Check if already exists
  const existing = await db.prepare('SELECT id FROM threats WHERE source = ? AND source_id = ?')
    .bind(t.source, t.source_id).first();
  if (existing) return false;

  await db.prepare(`INSERT INTO threats (source, source_id, title, description, severity, cvss_score,
    affected_vendor, affected_product, affected_version, exploits_available, actively_exploited, published_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      t.source, t.source_id, t.title, t.description || null, t.severity, t.cvss_score || null,
      t.affected_vendor || null, t.affected_product || null, t.affected_version || null,
      t.exploits_available ? 1 : 0, t.actively_exploited ? 1 : 0, t.published_date || null
    ).run();
  return true;
}

async function ingestNvd(db: D1Database): Promise<number> {
  const url = 'https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=20';
  const res = await fetch(url, { headers: { 'User-Agent': 'ThreatSynth/1.0' } });
  if (!res.ok) throw new Error(`NVD API returned ${res.status}`);
  const data: any = await res.json();
  let count = 0;
  for (const item of data.vulnerabilities || []) {
    const cve = item.cve;
    const id = cve.id;
    const desc = cve.descriptions?.find((d: any) => d.lang === 'en')?.value || '';
    const metrics = cve.metrics?.cvssMetricV31?.[0]?.cvssData || cve.metrics?.cvssMetricV2?.[0]?.cvssData;
    const score = metrics?.baseScore || null;
    const severity = severityFromCvss(score);

    // Extract vendor/product from CPE
    let vendor, product, version;
    const cpes = cve.configurations?.[0]?.nodes?.[0]?.cpeMatch || [];
    if (cpes.length > 0) {
      const parts = (cpes[0].criteria || '').split(':');
      if (parts.length >= 6) { vendor = parts[3]; product = parts[4]; version = parts[5]; }
    }

    const inserted = await upsertThreat(db, {
      source: 'nvd', source_id: id, title: desc.slice(0, 200), description: desc,
      severity, cvss_score: score, affected_vendor: vendor, affected_product: product,
      affected_version: version, published_date: cve.published,
    });
    if (inserted) count++;
  }
  return count;
}

async function ingestCisaKev(db: D1Database): Promise<number> {
  const res = await fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
  if (!res.ok) throw new Error(`CISA KEV returned ${res.status}`);
  const data: any = await res.json();
  let count = 0;
  for (const vuln of (data.vulnerabilities || []).slice(0, 30)) {
    const inserted = await upsertThreat(db, {
      source: 'cisa_kev', source_id: vuln.cveID,
      title: `${vuln.vendorProject} ${vuln.product} - ${vuln.vulnerabilityName}`,
      description: vuln.shortDescription, severity: 'high',
      affected_vendor: vuln.vendorProject, affected_product: vuln.product,
      exploits_available: true, actively_exploited: true,
      published_date: vuln.dateAdded,
    });
    if (inserted) count++;
  }
  return count;
}

async function ingestExploitdb(db: D1Database): Promise<number> {
  const url = 'https://gitlab.com/exploit-database/exploitdb/-/raw/main/files_exploits.csv';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ExploitDB returned ${res.status}`);
  const text = await res.text();
  const lines = text.split('\n').slice(1).filter(l => l.trim());
  let count = 0;

  // Take last 20 entries
  for (const line of lines.slice(-20)) {
    const cols = line.split(',');
    if (cols.length < 5) continue;
    const edbId = cols[0]?.trim();
    const desc = cols[2]?.trim()?.replace(/^"|"$/g, '') || '';
    const datePublished = cols[3]?.trim();

    // Try to extract CVE from description
    const cveMatch = desc.match(/CVE-\d{4}-\d+/i);
    const sourceId = cveMatch ? cveMatch[0].toUpperCase() : `EDB-${edbId}`;

    const inserted = await upsertThreat(db, {
      source: 'exploitdb', source_id: sourceId,
      title: desc.slice(0, 200), description: desc,
      severity: 'high', exploits_available: true,
      published_date: datePublished,
    });
    if (inserted) count++;
  }
  return count;
}

async function ingestGithub(db: D1Database): Promise<number> {
  const url = 'https://api.github.com/advisories?per_page=20&type=reviewed';
  const res = await fetch(url, { headers: { 'User-Agent': 'ThreatSynth/1.0', Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  const advisories: any[] = await res.json();
  let count = 0;

  for (const adv of advisories) {
    const cveId = adv.cve_id || adv.ghsa_id;
    const score = adv.cvss?.score || null;
    const severity = adv.severity || severityFromCvss(score);

    let vendor, product;
    const vuln = adv.vulnerabilities?.[0];
    if (vuln?.package) {
      product = vuln.package.name;
      vendor = vuln.package.ecosystem;
    }

    const inserted = await upsertThreat(db, {
      source: 'github', source_id: cveId,
      title: adv.summary || '', description: adv.description || '',
      severity, cvss_score: score, affected_vendor: vendor, affected_product: product,
      affected_version: vuln?.vulnerable_version_range,
      published_date: adv.published_at,
    });
    if (inserted) count++;
  }
  return count;
}

async function ingestShodan(db: D1Database): Promise<number> {
  const url = 'https://cvedb.shodan.io/cves?limit=20&is_kev=true&sort=epss';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Shodan CVE DB returned ${res.status}`);
  const data: any = await res.json();
  let count = 0;

  for (const cve of data.cves || []) {
    const score = cve.cvss_v3 || cve.cvss || null;
    let vendor, product, version;
    if (cve.cpes && cve.cpes.length > 0) {
      const parts = cve.cpes[0].split(':');
      if (parts.length >= 6) { vendor = parts[3]; product = parts[4]; version = parts[5]; }
    }

    const inserted = await upsertThreat(db, {
      source: 'shodan', source_id: cve.cve_id,
      title: (cve.summary || '').slice(0, 200), description: cve.summary,
      severity: severityFromCvss(score), cvss_score: score,
      affected_vendor: vendor, affected_product: product, affected_version: version,
      exploits_available: true, actively_exploited: !!cve.kev,
      published_date: cve.published_time,
    });
    if (inserted) count++;
  }
  return count;
}

async function ingestGreynoise(db: D1Database): Promise<number> {
  // Get top CVEs by EPSS score
  const epssRes = await fetch('https://api.first.org/data/v1/epss?order=!epss&limit=20');
  if (!epssRes.ok) throw new Error(`FIRST EPSS returned ${epssRes.status}`);
  const epssData: any = await epssRes.json();
  let count = 0;

  for (const entry of epssData.data || []) {
    const cveId = entry.cve;
    const epssScore = parseFloat(entry.epss) || 0;

    // Enrich with Shodan CVE DB details
    let title = cveId, description = '', score = null, vendor, product, version;
    try {
      const detailRes = await fetch(`https://cvedb.shodan.io/cve/${cveId}`);
      if (detailRes.ok) {
        const detail: any = await detailRes.json();
        title = (detail.summary || cveId).slice(0, 200);
        description = detail.summary || '';
        score = detail.cvss_v3 || detail.cvss || null;
        if (detail.cpes?.length > 0) {
          const parts = detail.cpes[0].split(':');
          if (parts.length >= 6) { vendor = parts[3]; product = parts[4]; version = parts[5]; }
        }
      }
    } catch {}

    const inserted = await upsertThreat(db, {
      source: 'greynoise', source_id: cveId,
      title, description,
      severity: severityFromCvss(score), cvss_score: score,
      affected_vendor: vendor, affected_product: product, affected_version: version,
      exploits_available: epssScore > 0.5, actively_exploited: epssScore > 0.8,
      published_date: entry.date,
    });
    if (inserted) count++;
  }
  return count;
}
