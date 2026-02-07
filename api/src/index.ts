import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from './auth';
import { assets } from './routes/assets';
import { threats } from './routes/threats';
import { briefings } from './routes/briefings';
import { dashboard } from './routes/dashboard';

export type Env = {
  DB: D1Database;
  AI: any;
};

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors());

app.route('/api/auth', auth);
app.route('/api/assets', assets);
app.route('/api/threats', threats);
app.route('/api/briefings', briefings);
app.route('/api/dashboard', dashboard);

app.get('/api/health', (c) =>
  c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'ThreatSynth API (Cloudflare Workers)',
  })
);

export default app;
