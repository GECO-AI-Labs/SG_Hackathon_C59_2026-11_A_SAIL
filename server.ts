/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * server.ts
 * High-performance full-stack Express server for SAIL Maritime Intelligence.
 * Exposes:
 * - Server-Sent Events (SSE) streaming chat with real-time multi-agent tracing
 * - Zilliz Cloud multi-collection vector search & status
 * - Databricks & in-memory MLflow tracing
 * - Maritime RSS feed subscriptions and caching
 * - Deep 4-phase system diagnostics
 */

import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { runSailWorkflowStream, runDeepDiagnostics } from './server/agent_service.js';
import { getZillizStatus } from './server/retrieval_zilliz.js';
import { getRecentTraces, getTraceById, getMLflowStatus } from './server/mlflow_tracer.js';
import { runDatabricksTraceDiagnostic } from './server/test_databricks_trace.js';
import { getSavedFeeds, saveFeed, removeFeed, fetchAllFeeds } from './server/rss_service.js';
import { SOUTHEAST_ASIA_LANES } from './src/data/shippingLanes.js';
import { 
  getAllSavedChats, 
  getSavedChatById, 
  saveChatSession, 
  renameChatSession, 
  deleteChatSession, 
  restoreChatsFromZilliz,
  ensureChatsRestoredFromZilliz
} from './server/chat_store.js';
import {
  getZillizHttpTraces,
  clearZillizHttpTraces,
  runZillizChatDiagnostic,
  runZillizQuickPromptDiagnostic,
  tracedZillizFetch
} from './server/zilliz_tracer.js';
import {
  getAllShortcuts,
  createShortcut,
  updateShortcut,
  deleteShortcut,
  ensureShortcutsRestoredFromZilliz,
  restoreShortcutsFromZilliz,
  getShortcutSyncStatus
} from './server/shortcut_store.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- API ROUTES ---

// 1. Streaming Chat Endpoint (SSE)
app.post('/api/chat/stream', async (req: Request, res: Response): Promise<void> => {
  const { prompt, sessionId, thinkingLevel } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing prompt in request body.' });
    return;
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await runSailWorkflowStream(
      prompt,
      sessionId || 'default-session',
      (event) => {
        sendEvent(event);
      },
      thinkingLevel
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    sendEvent({ type: 'error', message: errorMsg });
  } finally {
    res.end();
  }
});

// 2. RSS Feeds API
app.get('/api/rss', async (_req: Request, res: Response): Promise<void> => {
  try {
    const feeds = await fetchAllFeeds();
    const urls = getSavedFeeds();
    res.json({ urls, feeds });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

app.post('/api/rss/subscribe', (req: Request, res: Response): void => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing feed URL.' });
    return;
  }
  const added = saveFeed(url);
  res.json({ success: added, message: added ? 'Subscribed successfully.' : 'Already subscribed or invalid.' });
});

app.post('/api/rss/unsubscribe', (req: Request, res: Response): void => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing feed URL.' });
    return;
  }
  const removed = removeFeed(url);
  res.json({ success: removed, message: removed ? 'Unsubscribed successfully.' : 'Feed not found.' });
});

// 3. AIS Vessels API (all 199 monitored vessels)
app.get('/api/vessels', (_req: Request, res: Response): void => {
  try {
    const vesselsPath = path.resolve(process.cwd(), 'data', 'Sample_AIS_dataset_200Rows_AsiaPacific.json');
    if (fs.existsSync(vesselsPath)) {
      const data = JSON.parse(fs.readFileSync(vesselsPath, 'utf8'));
      res.json({ vessels: data, count: data.length });
    } else {
      res.json({ vessels: [], count: 0 });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// 4. Shipping Lanes API (Southeast Asia Corridors & Chokepoints)
app.get('/api/lanes', (_req: Request, res: Response): void => {
  try {
    res.json({ lanes: SOUTHEAST_ASIA_LANES, count: SOUTHEAST_ASIA_LANES.length });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// 5. MLflow Traces API
app.get('/api/traces', (_req: Request, res: Response): void => {
  const traces = getRecentTraces();
  const status = getMLflowStatus();
  res.json({ traces, status });
});

app.get('/api/traces/:id', (req: Request, res: Response): void => {
  const trace = getTraceById(req.params.id);
  if (!trace) {
    res.status(404).json({ error: 'Trace not found.' });
    return;
  }
  res.json(trace);
});

app.post('/api/traces/test-sync', async (_req: Request, res: Response): Promise<void> => {
  try {
    const diagnostic = await runDatabricksTraceDiagnostic();
    res.json(diagnostic);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// 4. System Diagnostics API
app.post('/api/diagnostics', async (_req: Request, res: Response): Promise<void> => {
  try {
    const results = await runDeepDiagnostics();
    res.json(results);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// 5. System Status API
app.get('/api/status', (_req: Request, res: Response): void => {
  const zilliz = getZillizStatus();
  const mlflow = getMLflowStatus();
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);

  res.json({
    online: true,
    version: '2.0.0-production',
    gemini: {
      model: 'gemini-3.8-flash',
      configured: hasGemini
    },
    embedding: {
      model: 'gemini-embedding-001',
      apiVersion: 'v1beta',
      dimensions: 3072
    },
    zilliz,
    mlflow
  });
});

// 6. Config Update API (allows adjusting Zilliz / Databricks endpoint without redeploy)
app.post('/api/config', (req: Request, res: Response): void => {
  const { zillizUri, zillizApiKey, databricksHost, databricksToken, experimentName } = req.body;
  if (zillizUri !== undefined) process.env.ZILLIZ_URI = zillizUri;
  if (zillizApiKey !== undefined) process.env.ZILLIZ_API_KEY = zillizApiKey;
  if (databricksHost !== undefined) process.env.DATABRICKS_HOST = databricksHost;
  if (databricksToken !== undefined) process.env.DATABRICKS_TOKEN = databricksToken;
  if (experimentName !== undefined) process.env.MLFLOW_EXPERIMENT_NAME = experimentName;

  if (zillizUri !== undefined || zillizApiKey !== undefined) {
    restoreChatsFromZilliz().catch(() => {});
    restoreShortcutsFromZilliz(true).catch(() => {});
  }

  res.json({
    success: true,
    message: 'Configuration updated successfully.',
    status: {
      zilliz: getZillizStatus(),
      mlflow: getMLflowStatus()
    }
  });
});

// 7. Chat History & Session Persistence API (backed by Zilliz 'ChatHistory' collection)
app.get('/api/chats', async (_req: Request, res: Response): Promise<void> => {
  try {
    await ensureChatsRestoredFromZilliz();
    const chats = getAllSavedChats();
    res.json({ chats, count: chats.length });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

app.get('/api/chats/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureChatsRestoredFromZilliz();
    const chat = getSavedChatById(req.params.id);
    if (!chat) {
      res.status(404).json({ error: 'Chat session not found.' });
      return;
    }
    res.json(chat);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

app.post('/api/chats/save', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, messages, title } = req.body;
    if (!sessionId || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Missing sessionId or messages array.' });
      return;
    }
    const saved = await saveChatSession(sessionId, messages, title);
    res.json({ success: true, chat: saved });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

app.patch('/api/chats/:id/rename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string') {
      res.status(400).json({ error: 'Title string is required.' });
      return;
    }
    const updated = await renameChatSession(req.params.id, title);
    if (!updated) {
      res.status(404).json({ error: 'Chat session not found.' });
      return;
    }
    res.json({ success: true, chat: updated });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

app.delete('/api/chats/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await deleteChatSession(req.params.id);
    res.json({ success: deleted });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

app.post('/api/chats/sync-zilliz', async (_req: Request, res: Response): Promise<void> => {
  try {
    await restoreChatsFromZilliz();
    const chats = getAllSavedChats();
    res.json({ success: true, chats, count: chats.length });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// 7b. Quick Prompt Shortcuts Persistence API (backed by Zilliz 'QuickPrompt' collection)
app.get('/api/shortcuts', async (req: Request, res: Response): Promise<void> => {
  try {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    await ensureShortcutsRestoredFromZilliz(forceRefresh);
    const shortcuts = getAllShortcuts();
    res.json({
      shortcuts,
      count: shortcuts.length,
      zillizStatus: getShortcutSyncStatus()
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

app.post('/api/shortcuts/sync-zilliz', async (_req: Request, res: Response): Promise<void> => {
  try {
    await restoreShortcutsFromZilliz(true);
    const shortcuts = getAllShortcuts();
    res.json({
      success: true,
      shortcuts,
      count: shortcuts.length,
      zillizStatus: getShortcutSyncStatus()
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

app.post('/api/shortcuts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, desc, query, icon } = req.body || {};
    if (!title || typeof title !== 'string' || !query || typeof query !== 'string') {
      res.status(400).json({ error: 'Both title and prompt query text are required.' });
      return;
    }
    const result = await createShortcut({ title, desc, query, icon });
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

app.put('/api/shortcuts/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, desc, query, icon } = req.body || {};
    if (!title || typeof title !== 'string' || !query || typeof query !== 'string') {
      res.status(400).json({ error: 'Both title and prompt query text are required.' });
      return;
    }
    const result = await updateShortcut(req.params.id, { title, desc, query, icon });
    if (!result.shortcut) {
      res.status(404).json({ error: 'Shortcut prompt not found.' });
      return;
    }
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

app.delete('/api/shortcuts/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await deleteShortcut(req.params.id);
    res.json({ success: result.deleted, ...result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// 8. Zilliz HTTP Tracing & Chat Diagnostic API
app.get('/api/zilliz/traces', (_req: Request, res: Response): void => {
  try {
    const traces = getZillizHttpTraces();
    res.json({ traces, count: traces.length });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

app.post('/api/zilliz/traces/clear', (_req: Request, res: Response): void => {
  try {
    clearZillizHttpTraces();
    res.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

app.post('/api/zilliz/diagnostic', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await runZillizChatDiagnostic();
    res.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

app.post('/api/zilliz/quickprompt-diagnostic', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await runZillizQuickPromptDiagnostic();
    res.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

app.post('/api/zilliz/collections/drop-backup', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await tracedZillizFetch({
      endpoint: '/v2/vectordb/collections/drop',
      operation: 'delete_chat',
      body: { collectionName: 'AIS_backup_api_v1' },
      notes: 'User requested drop of unused AIS_backup_api_v1 to free up 5th collection slot for ChatHistory'
    });
    res.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorMsg });
  }
});

// 9. Cross-Tab / Cross-Iframe Relay for "Ask Copilot" from Scenario Planning HTML
interface CopilotBriefPayload {
  type: 'ASK_COPILOT_BRIEF';
  requestId: string;
  prompt: string;
  scenarioName?: string;
  timestamp: number;
  acknowledged?: boolean;
}

const copilotBriefSseClients = new Set<Response>();
const briefQueue: CopilotBriefPayload[] = [];

// Helper to prune briefs older than 5 minutes
function pruneBriefQueue() {
  const cutoff = Date.now() - 5 * 60 * 1000;
  while (briefQueue.length > 0 && briefQueue[0].timestamp < cutoff) {
    briefQueue.shift();
  }
}

app.post('/api/copilot/brief', (req: Request, res: Response): void => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const { requestId, prompt, scenarioName, timestamp } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'Missing strategy brief prompt.' });
    return;
  }

  pruneBriefQueue();

  const reqId = typeof requestId === 'string' && requestId ? requestId : `brief-${Date.now()}`;
  const payload: CopilotBriefPayload = {
    type: 'ASK_COPILOT_BRIEF',
    requestId: reqId,
    prompt,
    scenarioName: typeof scenarioName === 'string' ? scenarioName : 'Scenario Planning',
    timestamp: typeof timestamp === 'number' ? timestamp : Date.now(),
    acknowledged: false
  };

  briefQueue.push(payload);

  // Broadcast immediately to all connected Maritime Assistant webapp SSE clients (with padding to bypass proxy buffering)
  const padding = ': ' + ' '.repeat(2048) + '\n';
  const sseData = `${padding}data: ${JSON.stringify(payload)}\n\n`;
  let deliveredCount = 0;
  for (const clientRes of copilotBriefSseClients) {
    try {
      clientRes.write(sseData);
      deliveredCount++;
    } catch {
      copilotBriefSseClients.delete(clientRes);
    }
  }

  res.json({
    success: true,
    requestId: payload.requestId,
    deliveredToActiveClients: deliveredCount
  });
});

app.get('/api/copilot/brief-pending', (_req: Request, res: Response): void => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  pruneBriefQueue();
  // Return the newest unacknowledged brief (within last 2 minutes)
  const unacked = [...briefQueue]
    .reverse()
    .find((b) => !b.acknowledged && Date.now() - b.timestamp < 120000);
  res.json({ pending: unacked || null });
});

app.post('/api/copilot/brief-ack', (req: Request, res: Response): void => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const { requestId } = req.body || {};
  if (requestId && typeof requestId === 'string') {
    for (const item of briefQueue) {
      if (item.requestId === requestId) {
        item.acknowledged = true;
      }
    }
  } else {
    for (const item of briefQueue) {
      item.acknowledged = true;
    }
  }
  res.json({ success: true });
});

app.get('/api/copilot/brief-status', (req: Request, res: Response): void => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const requestId = String(req.query.requestId || '');
  const found = briefQueue.find((b) => b.requestId === requestId);
  res.json({
    found: Boolean(found),
    acknowledged: Boolean(found?.acknowledged)
  });
});

app.get('/api/copilot/brief-events', (req: Request, res: Response): void => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Send initial 2KB comment padding so Cloud Run / reverse proxies flush the stream immediately
  res.write(`: connected ${' '.repeat(2048)}\n\n`);

  copilotBriefSseClients.add(res);

  pruneBriefQueue();
  const unacked = [...briefQueue]
    .reverse()
    .find((b) => !b.acknowledged && Date.now() - b.timestamp < 60000);
  if (unacked) {
    res.write(`data: ${JSON.stringify(unacked)}\n\n`);
  }

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
      copilotBriefSseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    copilotBriefSseClients.delete(res);
  });
});

// --- VITE MIDDLEWARE OR STATIC SERVING ---
async function startServer() {
  const publicPath = path.resolve(__dirname, 'public');
  const aistudioAssetsPath = path.resolve(publicPath, 'assets/aistudio');

  // Serve attached static web apps with no-store headers so updates are always live immediately
  app.use(
    '/assets/aistudio',
    express.static(aistudioAssetsPath, {
      etag: false,
      lastModified: false,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    })
  );
  app.get(['/fleet-strategy', '/fleet-strategy/'], (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(path.join(aistudioAssetsPath, 'index_23d044a4.html'));
  });

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SAIL Server] Listening on http://0.0.0.0:${PORT} (${isProduction ? 'Production' : 'Development'})`);
  });
}

startServer().catch((err) => {
  console.error('[SAIL Server] Fatal startup error:', err);
  process.exit(1);
});
