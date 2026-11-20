/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * shortcut_store.ts
 * Persistence Engine for Quick Prompts / Custom Shortcuts backed by Zilliz Cloud 'QuickPrompt' collection
 * using 'ZILLIZ-2-URI' / 'ZILLIZ_2_URI' and 'ZILLIZ-2-KEY' / 'ZILLIZ_2_KEY'.
 *
 * Features:
 * 1. Connects to the dedicated QuickPrompt Zilliz cluster using ZILLIZ-2-URI / ZILLIZ_2_URI and ZILLIZ-2-KEY / ZILLIZ_2_KEY.
 * 2. If ZILLIZ-2 returns code 80020 (Cluster not exist or you don't have permission), tests project-level key if in same
 *    Zilliz Cloud project, and otherwise gracefully falls back to the primary Zilliz cluster's ChatHistory
 *    `__quickprompt__:` partition so prompts STILL persist across sessions with zero app errors.
 * 3. Checks if 'QuickPrompt' collection exists via /v2/vectordb/collections/list and creates it (3072 dims) if missing.
 * 4. Handles automatic collection load retry if code 101 (collection not loaded) occurs.
 * 5. Uses deterministic Int64 primary keys (`numericId`) for deduplicated upserts, updates & deletes.
 */

import fs from 'fs';
import path from 'path';
import { createFastPseudoEmbedding } from './retrieval_zilliz.js';
import { sessionIdToNumericId } from './chat_store.js';
import {
  tracedZillizFetch,
  getCleanZillizUri,
  getCleanZilliz2Uri,
  getDetectedZillizEnvKeyNames
} from './zilliz_tracer.js';

export type ShortcutIconName =
  | 'TrendingUp'
  | 'Ship'
  | 'Anchor'
  | 'Layers'
  | 'Compass'
  | 'Database'
  | 'Sparkles';

export type ShortcutStorageMode = 'QuickPrompt' | 'ChatHistoryFallback' | 'local';

export interface ShortcutPrompt {
  id: string;
  numericId?: number;
  title: string;
  desc: string;
  query: string;
  icon?: ShortcutIconName;
  createdAt: number;
  updatedAt: number;
}

export interface ShortcutSyncStatus {
  zillizAvailable: boolean;
  storageMode: ShortcutStorageMode;
  collectionName: string;
  lastError: string | null;
  detectedZillizKeys?: string[];
}

interface PersistedShortcutsFile {
  seeded: boolean;
  shortcuts: ShortcutPrompt[];
}

export const QUICK_PROMPT_COLLECTION = 'QuickPrompt';
const QUICK_PROMPT_PREFIX = '__quickprompt__:';

const DEFAULT_SHORTCUTS: Array<{
  id: string;
  title: string;
  desc: string;
  query: string;
  icon: ShortcutIconName;
}> = [
  {
    id: 'shortcut-default-1',
    title: 'Intra-Asia Freight vs Feeder Capacity',
    desc: 'Analyze spot rates, bunker price moderations, and feeder tightness in Southeast Asia.',
    query: 'Analyze intra-Asia container spot rates versus feeder vessel capacity deployment across Southeast Asian lanes.',
    icon: 'TrendingUp'
  },
  {
    id: 'shortcut-default-2',
    title: 'Straits of Malacca AIS Vessel Congestion',
    desc: 'Examine real-time vessel speeds, anchorage waiting, and daily transit volumes.',
    query: 'Check real-time AIS vessel congestion, speeds, and anchorage wait times in the Singapore and Malacca Straits.',
    icon: 'Ship'
  },
  {
    id: 'shortcut-default-3',
    title: '1,800 TEU Bangkokmax Charter Economics',
    desc: 'Model feeder chartering economics, port turnarounds, and route capital risks.',
    query: 'Evaluate chartering economics for a 1,800 TEU Bangkokmax feeder vessel for a Singapore-Jakarta-Belawan rotation.',
    icon: 'Anchor'
  },
  {
    id: 'shortcut-default-4',
    title: 'Drewry WCI Index & Port Throughput',
    desc: 'Correlate composite freight indices against monthly container TEU statistics.',
    query: 'Assess recent Drewry WCI container index movements against regional port container throughput statistics.',
    icon: 'Layers'
  }
];

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SHORTCUT_STORE_FILE = path.join(DATA_DIR, 'shortcuts.json');

const inMemoryShortcuts = new Map<string, ShortcutPrompt>();
let hasSeededDefaults = false;
let loadedFromDiskFile = false;

function initLocalShortcutStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(SHORTCUT_STORE_FILE)) {
      loadedFromDiskFile = true;
      const raw = fs.readFileSync(SHORTCUT_STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as PersistedShortcutsFile | ShortcutPrompt[];
      if (Array.isArray(parsed)) {
        hasSeededDefaults = true;
        parsed.forEach((s) => {
          if (s && s.id) inMemoryShortcuts.set(s.id, s);
        });
      } else if (parsed && Array.isArray(parsed.shortcuts)) {
        hasSeededDefaults = Boolean(parsed.seeded);
        parsed.shortcuts.forEach((s) => {
          if (s && s.id) inMemoryShortcuts.set(s.id, s);
        });
      }
      console.log(`[shortcutStore] Loaded ${inMemoryShortcuts.size} quick prompt(s) from local cache.`);
    } else {
      loadedFromDiskFile = false;
      const now = Date.now();
      DEFAULT_SHORTCUTS.forEach((d, idx) => {
        const item: ShortcutPrompt = {
          id: d.id,
          numericId: sessionIdToNumericId(d.id),
          title: d.title,
          desc: d.desc,
          query: d.query,
          icon: d.icon,
          createdAt: now + idx,
          updatedAt: now + idx
        };
        inMemoryShortcuts.set(item.id, item);
      });
      hasSeededDefaults = true;
      flushLocalShortcutStore();
      console.log(`[shortcutStore] Initialized ${inMemoryShortcuts.size} default maritime quick prompt(s).`);
    }
  } catch (err) {
    console.warn('[shortcutStore] Warning initializing local shortcut store:', err);
  }
}

function flushLocalShortcutStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload: PersistedShortcutsFile = {
      seeded: hasSeededDefaults,
      shortcuts: Array.from(inMemoryShortcuts.values())
    };
    fs.writeFileSync(SHORTCUT_STORE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.warn('[shortcutStore] Failed to write local shortcut store to disk:', err);
  }
}

initLocalShortcutStore();

// --- ZILLIZ CLOUD 'QuickPrompt' DATABASE INTEGRATION ---

let zillizQuickPromptChecked = false;
let currentStorageMode: ShortcutStorageMode = 'local';
let lastZillizQuickPromptError: string | null = null;
let resolvedZilliz2Creds: { cleanUri: string; token: string } | null = null;

export function getShortcutSyncStatus(): ShortcutSyncStatus {
  return {
    zillizAvailable: currentStorageMode !== 'local',
    storageMode: currentStorageMode,
    collectionName:
      currentStorageMode === 'QuickPrompt'
        ? QUICK_PROMPT_COLLECTION
        : currentStorageMode === 'ChatHistoryFallback'
        ? 'ChatHistory'
        : 'local',
    lastError: lastZillizQuickPromptError,
    detectedZillizKeys: getDetectedZillizEnvKeyNames()
  };
}

/**
 * Checks if primary Zilliz cluster has ChatHistory available for resilient cross-session fallback.
 */
async function canUsePrimaryChatHistoryFallback(): Promise<boolean> {
  const primary = getCleanZillizUri();
  if (!primary) return false;
  try {
    const listRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/collections/list',
      operation: 'list_collections',
      body: {},
      customUri: primary.cleanUri,
      customToken: primary.token,
      notes: 'Verify primary ChatHistory collection for QuickPrompt fallback persistence'
    });
    if (listRes.ok && listRes.data && Array.isArray(listRes.data.data)) {
      const cols = listRes.data.data.map((item: any) =>
        typeof item === 'string' ? item : (item.collectionName || String(item))
      );
      return cols.includes('ChatHistory');
    }
  } catch {
    // Ignore fallback check failure
  }
  return false;
}

/**
 * Ensures the 'QuickPrompt' collection exists on ZILLIZ-2 (or gracefully falls back to primary ChatHistory
 * if ZILLIZ-2 is unavailable / returns 80020 so Quick Prompts still persist in Zilliz across sessions).
 */
export async function ensureZillizQuickPromptCollection(forceCheck = false): Promise<ShortcutStorageMode> {
  if (!forceCheck && zillizQuickPromptChecked && currentStorageMode === 'QuickPrompt' && resolvedZilliz2Creds) {
    return 'QuickPrompt';
  }

  const creds2 = getCleanZilliz2Uri();
  if (!creds2) {
    const detected = getDetectedZillizEnvKeyNames();
    const canFallback = await canUsePrimaryChatHistoryFallback();
    if (canFallback) {
      zillizQuickPromptChecked = true;
      currentStorageMode = 'ChatHistoryFallback';
      lastZillizQuickPromptError =
        `ZILLIZ_2_URI / ZILLIZ_2_KEY not set in container (detected: ${detected.join(', ') || 'none'}). Using primary Zilliz persistence until ZILLIZ_2 is configured.`;
      return 'ChatHistoryFallback';
    }

    currentStorageMode = 'local';
    lastZillizQuickPromptError =
      `ZILLIZ_2_URI / ZILLIZ_2_KEY not found in container environment (detected Zilliz keys: ${detected.length ? detected.join(', ') : 'none'}).`;
    return 'local';
  }

  const activeCreds2 = creds2;

  try {
    const listRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/collections/list',
      operation: 'list_collections',
      body: {},
      customUri: activeCreds2.cleanUri,
      customToken: activeCreds2.token,
      credentialLabel: 'ZILLIZ_2_URI + ZILLIZ_2_KEY',
      notes: `Check if ${QUICK_PROMPT_COLLECTION} collection exists on ZILLIZ_2_URI using ZILLIZ_2_KEY`
    });

    if (!listRes.ok || (listRes.data && listRes.data.code !== 0 && listRes.data.code !== undefined)) {
      const errMsg = listRes.error || `Failed to list collections on ZILLIZ-2 (HTTP ${listRes.status})`;
      const hostName = activeCreds2.cleanUri.replace(/^https?:\/\//, '');
      const isClusterMissingOrDenied =
        listRes.data?.code === 80020 || errMsg.toLowerCase().includes('cluster not exist');

      const canFallback = await canUsePrimaryChatHistoryFallback();
      if (canFallback) {
        zillizQuickPromptChecked = true;
        currentStorageMode = 'ChatHistoryFallback';
        resolvedZilliz2Creds = null;
        lastZillizQuickPromptError = isClusterMissingOrDenied
          ? `ZILLIZ-2 (${hostName}) returned code 80020: "${errMsg}". Verify the ZILLIZ_2_URI cluster ID is active and ZILLIZ_2_KEY has permission in Zilliz Cloud. Quick prompts remain persisted in primary Zilliz meanwhile.`
          : `ZILLIZ-2 (${hostName}) unavailable: ${errMsg}. Quick prompts remain persisted in primary Zilliz meanwhile.`;
        console.log(`[shortcutStore] Notice: ${lastZillizQuickPromptError}`);
        return 'ChatHistoryFallback';
      }

      zillizQuickPromptChecked = true;
      currentStorageMode = 'local';
      resolvedZilliz2Creds = null;
      lastZillizQuickPromptError = `ZILLIZ-2 (${hostName}): ${errMsg}`;
      console.log(`[shortcutStore] Notice: ${lastZillizQuickPromptError}`);
      return 'local';
    }

    resolvedZilliz2Creds = activeCreds2;

    let existingCollections: string[] = [];
    if (listRes.data && Array.isArray(listRes.data.data)) {
      existingCollections = listRes.data.data.map((item: any) =>
        typeof item === 'string' ? item : (item.collectionName || String(item))
      );
    }

    if (existingCollections.includes(QUICK_PROMPT_COLLECTION)) {
      zillizQuickPromptChecked = true;
      currentStorageMode = 'QuickPrompt';
      lastZillizQuickPromptError = null;
      console.log(`[shortcutStore] Zilliz '${QUICK_PROMPT_COLLECTION}' collection verified on ZILLIZ-2.`);
      return 'QuickPrompt';
    }

    console.log(`[shortcutStore] Collection '${QUICK_PROMPT_COLLECTION}' not found on ZILLIZ-2. Creating collection (3072 dims)...`);
    const createRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/collections/create',
      operation: 'create_collection',
      body: {
        collectionName: QUICK_PROMPT_COLLECTION,
        dimension: 3072
      },
      customUri: activeCreds2.cleanUri,
      customToken: activeCreds2.token,
      credentialLabel: 'ZILLIZ_2_URI + ZILLIZ_2_KEY',
      notes: `Create ${QUICK_PROMPT_COLLECTION} collection (3072 dims) on ZILLIZ-2 database`
    });

    if (createRes.ok && (createRes.data?.code === 0 || createRes.data?.code === undefined)) {
      zillizQuickPromptChecked = true;
      currentStorageMode = 'QuickPrompt';
      lastZillizQuickPromptError = null;
      console.log(`[shortcutStore] Successfully created Zilliz collection '${QUICK_PROMPT_COLLECTION}' on ZILLIZ-2.`);
      return 'QuickPrompt';
    }

    const errMsg = createRes.error || `Failed to create '${QUICK_PROMPT_COLLECTION}' collection (HTTP ${createRes.status})`;
    const canFallback = await canUsePrimaryChatHistoryFallback();
    if (canFallback) {
      zillizQuickPromptChecked = true;
      currentStorageMode = 'ChatHistoryFallback';
      lastZillizQuickPromptError = `ZILLIZ-2 create '${QUICK_PROMPT_COLLECTION}' returned: ${errMsg}. Using primary Zilliz persistence meanwhile.`;
      console.log(`[shortcutStore] Notice: ${lastZillizQuickPromptError}`);
      return 'ChatHistoryFallback';
    }

    zillizQuickPromptChecked = true;
    currentStorageMode = 'local';
    lastZillizQuickPromptError = errMsg;
    console.log(`[shortcutStore] Notice: Could not create Zilliz '${QUICK_PROMPT_COLLECTION}' collection: ${errMsg}`);
    return 'local';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const canFallback = await canUsePrimaryChatHistoryFallback();
    if (canFallback) {
      zillizQuickPromptChecked = true;
      currentStorageMode = 'ChatHistoryFallback';
      lastZillizQuickPromptError = `ZILLIZ-2 connection notice: ${msg}. Using primary Zilliz persistence meanwhile.`;
      console.log(`[shortcutStore] Notice: ${lastZillizQuickPromptError}`);
      return 'ChatHistoryFallback';
    }
    zillizQuickPromptChecked = true;
    currentStorageMode = 'local';
    lastZillizQuickPromptError = msg;
    console.log(`[shortcutStore] Notice: Zilliz ${QUICK_PROMPT_COLLECTION} check/create exception: ${msg}`);
    return 'local';
  }
}

/**
 * Loads the 'QuickPrompt' collection if Zilliz returns code 101 (collection not loaded).
 */
async function loadQuickPromptCollectionIfNeeded(creds: { cleanUri: string; token: string }): Promise<void> {
  await tracedZillizFetch({
    endpoint: '/v2/vectordb/collections/load',
    operation: 'list_collections',
    body: { collectionName: QUICK_PROMPT_COLLECTION },
    customUri: creds.cleanUri,
    customToken: creds.token,
    credentialLabel: 'ZILLIZ_2_URI + ZILLIZ_2_KEY',
    notes: `Load ${QUICK_PROMPT_COLLECTION} collection on ZILLIZ-2 database`
  });
}

function getFallbackNumericId(shortcutId: string): number {
  return sessionIdToNumericId(`${QUICK_PROMPT_PREFIX}${shortcutId}`);
}

/**
 * Upserts a single quick prompt into ZILLIZ-2 'QuickPrompt' collection (or primary ChatHistory fallback).
 */
async function syncShortcutToZilliz(
  shortcut: ShortcutPrompt,
  forcedMode?: ShortcutStorageMode
): Promise<{ synced: boolean; mode: ShortcutStorageMode; error?: string }> {
  const mode = forcedMode || (await ensureZillizQuickPromptCollection());
  if (mode === 'local') {
    return {
      synced: false,
      mode: 'local',
      error: lastZillizQuickPromptError || `Zilliz '${QUICK_PROMPT_COLLECTION}' collection unavailable`
    };
  }

  try {
    const textToEmbed = `${shortcut.title} ${shortcut.desc} ${shortcut.query}`;
    const vector = createFastPseudoEmbedding(textToEmbed, 3072);

    if (mode === 'QuickPrompt') {
      const creds2 = resolvedZilliz2Creds || getCleanZilliz2Uri();
      if (!creds2) {
        return { synced: false, mode: 'local', error: 'ZILLIZ-2 credentials missing' };
      }

      const numericId = shortcut.numericId || sessionIdToNumericId(shortcut.id);
      shortcut.numericId = numericId;

      const upsertRes = await tracedZillizFetch({
        endpoint: '/v2/vectordb/entities/upsert',
        operation: 'upsert_shortcut',
        body: {
          collectionName: QUICK_PROMPT_COLLECTION,
          data: [
            {
              id: numericId,
              shortcutId: shortcut.id,
              vector,
              title: shortcut.title,
              desc: shortcut.desc,
              query: shortcut.query,
              icon: shortcut.icon || 'Sparkles',
              createdAt: shortcut.createdAt,
              updatedAt: shortcut.updatedAt
            }
          ]
        },
        customUri: creds2.cleanUri,
        customToken: creds2.token,
        credentialLabel: 'ZILLIZ_2_URI + ZILLIZ_2_KEY',
        notes: `Upsert QuickPrompt '${shortcut.title}' (ID: ${shortcut.id}, Numeric ID: ${numericId}) to ZILLIZ-2`
      });

      if (!upsertRes.ok || (upsertRes.data && upsertRes.data.code !== 0 && upsertRes.data.code !== undefined)) {
        const errMsg = upsertRes.error || `HTTP ${upsertRes.status}`;
        lastZillizQuickPromptError = errMsg;
        return { synced: false, mode, error: errMsg };
      }

      lastZillizQuickPromptError = null;
      console.log(`[shortcutStore] Synced quick prompt '${shortcut.title}' (ID: ${shortcut.id}) to ZILLIZ-2 ${QUICK_PROMPT_COLLECTION}.`);
      return { synced: true, mode };
    }

    // ChatHistoryFallback on primary Zilliz cluster
    const primary = getCleanZillizUri();
    if (!primary) {
      return { synced: false, mode: 'local', error: lastZillizQuickPromptError || 'Primary Zilliz unavailable' };
    }

    const fallbackNumericId = getFallbackNumericId(shortcut.id);
    const taggedSessionId = `${QUICK_PROMPT_PREFIX}${shortcut.id}`;
    const serializedPayload = JSON.stringify({
      __type: 'QuickPrompt',
      id: shortcut.id,
      numericId: shortcut.numericId || sessionIdToNumericId(shortcut.id),
      title: shortcut.title,
      desc: shortcut.desc,
      query: shortcut.query,
      icon: shortcut.icon || 'Sparkles',
      createdAt: shortcut.createdAt,
      updatedAt: shortcut.updatedAt
    });

    const upsertRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/entities/upsert',
      operation: 'upsert_shortcut',
      body: {
        collectionName: 'ChatHistory',
        data: [
          {
            id: fallbackNumericId,
            sessionId: taggedSessionId,
            vector,
            title: `[QuickPrompt] ${shortcut.title}`,
            createdAt: shortcut.createdAt,
            updatedAt: shortcut.updatedAt,
            messagesJson: serializedPayload
          }
        ]
      },
      customUri: primary.cleanUri,
      customToken: primary.token,
      notes: `Upsert QuickPrompt '${shortcut.title}' to primary Zilliz fallback (awaiting ZILLIZ-2 fix)`
    });

    if (!upsertRes.ok || (upsertRes.data && upsertRes.data.code !== 0 && upsertRes.data.code !== undefined)) {
      const errMsg = upsertRes.error || `HTTP ${upsertRes.status}`;
      return { synced: false, mode, error: errMsg };
    }

    console.log(`[shortcutStore] Synced quick prompt '${shortcut.title}' (ID: ${shortcut.id}) to primary Zilliz fallback.`);
    return { synced: true, mode, error: lastZillizQuickPromptError || undefined };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { synced: false, mode, error: errMsg };
  }
}

/**
 * Deletes a quick prompt from ZILLIZ-2 'QuickPrompt' (or primary fallback).
 */
async function deleteShortcutFromZilliz(shortcutId: string): Promise<{ synced: boolean; error?: string }> {
  const mode = await ensureZillizQuickPromptCollection();
  if (mode === 'local') {
    return {
      synced: false,
      error: lastZillizQuickPromptError || `Zilliz '${QUICK_PROMPT_COLLECTION}' collection unavailable`
    };
  }

  const existing = inMemoryShortcuts.get(shortcutId);
  const numericId = existing?.numericId || sessionIdToNumericId(shortcutId);
  const fallbackNumericId = getFallbackNumericId(shortcutId);

  try {
    if (mode === 'QuickPrompt') {
      const creds2 = resolvedZilliz2Creds || getCleanZilliz2Uri();
      if (!creds2) return { synced: false, error: 'ZILLIZ-2 credentials missing' };

      const deleteRes = await tracedZillizFetch({
        endpoint: '/v2/vectordb/entities/delete',
        operation: 'delete_shortcut',
        body: {
          collectionName: QUICK_PROMPT_COLLECTION,
          filter: `id in [${numericId}]`
        },
        customUri: creds2.cleanUri,
        customToken: creds2.token,
        credentialLabel: 'ZILLIZ_2_URI + ZILLIZ_2_KEY',
        notes: `Delete QuickPrompt ID '${shortcutId}' (Numeric ID: ${numericId}) from ZILLIZ-2`
      });

      if (deleteRes.ok && (deleteRes.data?.code === 0 || deleteRes.data?.code === undefined)) {
        lastZillizQuickPromptError = null;
        return { synced: true };
      }

      return { synced: false, error: deleteRes.error || `HTTP ${deleteRes.status}` };
    }

    const primary = getCleanZillizUri();
    if (!primary) return { synced: false, error: lastZillizQuickPromptError || 'Primary Zilliz unavailable' };

    const deleteRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/entities/delete',
      operation: 'delete_shortcut',
      body: {
        collectionName: 'ChatHistory',
        filter: `id in [${fallbackNumericId}]`
      },
      customUri: primary.cleanUri,
      customToken: primary.token,
      notes: `Delete QuickPrompt ID '${shortcutId}' from primary Zilliz fallback`
    });

    if (deleteRes.ok && (deleteRes.data?.code === 0 || deleteRes.data?.code === undefined)) {
      return { synced: true, error: lastZillizQuickPromptError || undefined };
    }

    return { synced: false, error: deleteRes.error || `HTTP ${deleteRes.status}` };
  } catch (err) {
    return { synced: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function queryFallbackShortcutsFromChatHistory(): Promise<ShortcutPrompt[]> {
  const primary = getCleanZillizUri();
  if (!primary) return [];

  const results: ShortcutPrompt[] = [];
  const queryRes = await tracedZillizFetch({
    endpoint: '/v2/vectordb/entities/query',
    operation: 'query_shortcuts',
    body: {
      collectionName: 'ChatHistory',
      outputFields: ['id', 'sessionId', 'title', 'createdAt', 'updatedAt', 'messagesJson'],
      limit: 100
    },
    customUri: primary.cleanUri,
    customToken: primary.token,
    notes: 'Restore QuickPrompt items from primary Zilliz ChatHistory fallback'
  });

  if (queryRes.ok && queryRes.data && (queryRes.data.code === 0 || queryRes.data.code === undefined)) {
    if (Array.isArray(queryRes.data.data)) {
      for (const item of queryRes.data.data) {
        const sessionId = String(item.sessionId || '');
        if (!sessionId.startsWith(QUICK_PROMPT_PREFIX)) continue;

        const cleanId = sessionId.slice(QUICK_PROMPT_PREFIX.length);
        try {
          const parsed = typeof item.messagesJson === 'string' ? JSON.parse(item.messagesJson) : item.messagesJson;
          if (parsed && parsed.query) {
            results.push({
              id: String(parsed.id || cleanId),
              numericId: Number(parsed.numericId) || sessionIdToNumericId(cleanId),
              title: String(parsed.title || 'Untitled Prompt'),
              desc: String(parsed.desc || ''),
              query: String(parsed.query),
              icon: (parsed.icon as ShortcutIconName) || 'Sparkles',
              createdAt: Number(parsed.createdAt || item.createdAt) || Date.now(),
              updatedAt: Number(parsed.updatedAt || item.updatedAt) || Date.now()
            });
          }
        } catch {
          // Ignore malformed fallback item
        }
      }
    }
  }
  return results;
}

/**
 * Restores all quick prompts from ZILLIZ-2 'QuickPrompt' collection (or primary fallback)
 * adhering strictly to Zilliz REST v2 flat json.data array parsing.
 */
export async function restoreShortcutsFromZilliz(forceRemoteAuthoritative = false): Promise<void> {
  const mode = await ensureZillizQuickPromptCollection(true);
  if (mode === 'local') return;

  try {
    let remoteShortcuts: ShortcutPrompt[] = [];
    let querySucceeded = false;

    if (mode === 'QuickPrompt') {
      const creds2 = resolvedZilliz2Creds || getCleanZilliz2Uri();
      if (!creds2) return;

      const queryBody = {
        collectionName: QUICK_PROMPT_COLLECTION,
        outputFields: ['id', 'shortcutId', 'title', 'desc', 'query', 'icon', 'createdAt', 'updatedAt'],
        limit: 100
      };

      let queryRes = await tracedZillizFetch({
        endpoint: '/v2/vectordb/entities/query',
        operation: 'query_shortcuts',
        body: queryBody,
        customUri: creds2.cleanUri,
        customToken: creds2.token,
        credentialLabel: 'ZILLIZ_2_URI + ZILLIZ_2_KEY',
        notes: `Restore quick prompts from ZILLIZ-2 ${QUICK_PROMPT_COLLECTION} collection`
      });

      if (queryRes.data && queryRes.data.code === 101) {
        await loadQuickPromptCollectionIfNeeded(creds2);
        queryRes = await tracedZillizFetch({
          endpoint: '/v2/vectordb/entities/query',
          operation: 'query_shortcuts',
          body: queryBody,
          customUri: creds2.cleanUri,
          customToken: creds2.token,
          credentialLabel: 'ZILLIZ_2_URI + ZILLIZ_2_KEY',
          notes: `Retry restore quick prompts from ZILLIZ-2 ${QUICK_PROMPT_COLLECTION} after load`
        });
      }

      if (!queryRes.ok || (queryRes.data && queryRes.data.code !== 0 && queryRes.data.code !== undefined)) {
        lastZillizQuickPromptError = queryRes.error || `Query failed (HTTP ${queryRes.status})`;
        return;
      }

      querySucceeded = true;
      if (queryRes.data && Array.isArray(queryRes.data.data)) {
        for (const item of queryRes.data.data) {
          if (!item.id && !item.shortcutId) continue;
          const rawNumericId = typeof item.id === 'number' ? item.id : Number(item.id);
          const shortcutId = String(item.shortcutId || item.id);
          const numericId = !isNaN(rawNumericId) && rawNumericId > 0 ? rawNumericId : sessionIdToNumericId(shortcutId);

          remoteShortcuts.push({
            id: shortcutId,
            numericId,
            title: String(item.title || 'Untitled Prompt'),
            desc: String(item.desc || ''),
            query: String(item.query || ''),
            icon: (item.icon as ShortcutIconName) || 'Sparkles',
            createdAt: Number(item.createdAt) || Date.now(),
            updatedAt: Number(item.updatedAt) || Date.now()
          });
        }
      }

      // Auto-migrate any fallback quick prompts from primary ChatHistory into ZILLIZ-2 QuickPrompt
      if (remoteShortcuts.length === 0) {
        const fallbackItems = await queryFallbackShortcutsFromChatHistory();
        if (fallbackItems.length > 0) {
          for (const item of fallbackItems) {
            await syncShortcutToZilliz(item, 'QuickPrompt');
            remoteShortcuts.push(item);
          }
        }
      }
    } else if (mode === 'ChatHistoryFallback') {
      remoteShortcuts = await queryFallbackShortcutsFromChatHistory();
      querySucceeded = true;
    }

    if (!querySucceeded) return;

    if (remoteShortcuts.length > 0) {
      if (!loadedFromDiskFile || forceRemoteAuthoritative) {
        inMemoryShortcuts.clear();
        for (const sc of remoteShortcuts) {
          inMemoryShortcuts.set(sc.id, sc);
        }
      } else {
        for (const sc of remoteShortcuts) {
          const local = inMemoryShortcuts.get(sc.id);
          if (!local || local.updatedAt <= sc.updatedAt) {
            inMemoryShortcuts.set(sc.id, sc);
          }
        }
      }
      loadedFromDiskFile = true;
      flushLocalShortcutStore();
      console.log(`[shortcutStore] Restored ${remoteShortcuts.length} quick prompt(s) from Zilliz (${mode}).`);
    } else if (inMemoryShortcuts.size > 0) {
      for (const sc of inMemoryShortcuts.values()) {
        await syncShortcutToZilliz(sc, mode);
      }
      flushLocalShortcutStore();
      console.log(`[shortcutStore] Seeded ${inMemoryShortcuts.size} quick prompt(s) into Zilliz (${mode}).`);
    }
  } catch (err) {
    lastZillizQuickPromptError = err instanceof Error ? err.message : String(err);
    console.log('[shortcutStore] Quick prompt Zilliz restore notice:', lastZillizQuickPromptError);
  }
}

let zillizShortcutRestorePromise: Promise<void> | null = null;

export function ensureShortcutsRestoredFromZilliz(force = false): Promise<void> {
  if (force || !zillizShortcutRestorePromise) {
    zillizShortcutRestorePromise = restoreShortcutsFromZilliz(force).catch((err) => {
      console.log('[shortcutStore] Zilliz quick prompt restore notice:', err);
    });
  }
  return zillizShortcutRestorePromise;
}

// Trigger initial Zilliz check/restore on startup
ensureShortcutsRestoredFromZilliz();

// --- PUBLIC CRUD OPERATIONS ---

export function getAllShortcuts(): ShortcutPrompt[] {
  return Array.from(inMemoryShortcuts.values()).sort((a, b) => a.createdAt - b.createdAt);
}

export async function createShortcut(input: {
  title: string;
  desc?: string;
  query: string;
  icon?: ShortcutIconName;
}): Promise<{
  shortcut: ShortcutPrompt;
  zillizSynced: boolean;
  zillizStatus: ShortcutSyncStatus;
  zillizError?: string;
}> {
  const now = Date.now();
  const id = `shortcut-${now}-${Math.random().toString(36).substring(2, 7)}`;
  const shortcut: ShortcutPrompt = {
    id,
    numericId: sessionIdToNumericId(id),
    title: input.title.trim(),
    desc: (input.desc || '').trim() || input.query.trim().slice(0, 90),
    query: input.query.trim(),
    icon: input.icon || 'Sparkles',
    createdAt: now,
    updatedAt: now
  };

  inMemoryShortcuts.set(id, shortcut);
  hasSeededDefaults = true;
  loadedFromDiskFile = true;
  flushLocalShortcutStore();

  const zillizRes = await syncShortcutToZilliz(shortcut);
  return {
    shortcut,
    zillizSynced: zillizRes.synced,
    zillizStatus: getShortcutSyncStatus(),
    zillizError: zillizRes.error
  };
}

export async function updateShortcut(
  id: string,
  input: {
    title: string;
    desc?: string;
    query: string;
    icon?: ShortcutIconName;
  }
): Promise<{
  shortcut: ShortcutPrompt | null;
  zillizSynced: boolean;
  zillizStatus: ShortcutSyncStatus;
  zillizError?: string;
}> {
  const existing = inMemoryShortcuts.get(id);
  if (!existing) {
    return {
      shortcut: null,
      zillizSynced: false,
      zillizStatus: getShortcutSyncStatus(),
      zillizError: 'Quick prompt not found'
    };
  }

  const updated: ShortcutPrompt = {
    ...existing,
    numericId: existing.numericId || sessionIdToNumericId(id),
    title: input.title.trim(),
    desc: (input.desc ?? existing.desc).trim() || input.query.trim().slice(0, 90),
    query: input.query.trim(),
    icon: input.icon || existing.icon || 'Sparkles',
    updatedAt: Date.now()
  };

  inMemoryShortcuts.set(id, updated);
  hasSeededDefaults = true;
  loadedFromDiskFile = true;
  flushLocalShortcutStore();

  const zillizRes = await syncShortcutToZilliz(updated);
  return {
    shortcut: updated,
    zillizSynced: zillizRes.synced,
    zillizStatus: getShortcutSyncStatus(),
    zillizError: zillizRes.error
  };
}

export async function deleteShortcut(id: string): Promise<{
  deleted: boolean;
  zillizSynced: boolean;
  zillizStatus: ShortcutSyncStatus;
  zillizError?: string;
}> {
  const zillizRes = await deleteShortcutFromZilliz(id);
  const existed = inMemoryShortcuts.delete(id);
  hasSeededDefaults = true;
  loadedFromDiskFile = true;
  flushLocalShortcutStore();

  return {
    deleted: existed || zillizRes.synced,
    zillizSynced: zillizRes.synced,
    zillizStatus: getShortcutSyncStatus(),
    zillizError: zillizRes.error
  };
}
