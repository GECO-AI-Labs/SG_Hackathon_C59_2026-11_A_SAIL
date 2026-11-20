/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * chat_store.ts
 * Enterprise Chat History and Session Persistence Engine.
 * 
 * Responsibilities:
 * 1. Serializes conversation history into local storage / memory store.
 * 2. Syncs conversation sessions with Zilliz Cloud vector collection 'ChatHistory':
 *    - Checks if 'ChatHistory' collection is available via collections/list.
 *    - Avoids creating duplicates if collection exists.
 *    - Uses 3072-dimension vectors with full metadata (id, title, createdAt, updatedAt, messagesJson).
 * 3. Restores saved chat threads upon page refresh or server restart.
 * 4. Summarizes the first user prompt into a concise, professional title via Gemini.
 * 5. Supports renaming and deleting saved chat sessions.
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createFastPseudoEmbedding } from './retrieval_zilliz.js';
import { tracedZillizFetch, getCleanZillizUri } from './zilliz_tracer.js';

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  status?: string;
  statusMessage?: string;
  searchTopics?: string[];
  retrievals?: {
    News_Collection: string[];
    AIS_Collection: string[];
    Seaport_Collection: string[];
    Filling_Collection: string[];
  };
  traceId?: string;
  confidenceScore?: string | number;
  durationMs?: number;
}

export interface SavedChat {
  id: string; // sessionId
  numericId?: number; // 64-bit safe numeric ID for Zilliz Milvus primary key
  chunkCount?: number; // Number of Zilliz entities used when split under 65KB dynamic field limit
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessageData[];
  summary?: string;
}

export interface SavedChatSummary {
  id: string;
  numericId?: number;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  preview: string;
  userQueries?: string[];
}

// In-memory chat store
const inMemoryStore = new Map<string, SavedChat>();
const syncedChunkCounts = new Map<string, number>();

const MAX_ZILLIZ_DYNAMIC_BYTES = 54000; // Safe headroom under Milvus 65,536-byte $meta limit (after JSON escaping)

function measureDynamicFieldBytes(metaFields: Record<string, unknown>): number {
  return Buffer.byteLength(JSON.stringify(metaFields), 'utf8');
}

function sliceSafelyWithoutBreakingSurrogate(str: string, start: number, maxEnd: number): number {
  let end = Math.min(maxEnd, str.length);
  if (end <= start) return Math.min(start + 1, str.length);
  if (end < str.length) {
    const code = str.charCodeAt(end - 1);
    if (code >= 0xd800 && code <= 0xdbff) {
      end = Math.max(start + 1, end - 1);
    }
  }
  return end;
}

function splitMessagesJsonForZilliz(
  sessionId: string,
  safeTitle: string,
  createdAt: number,
  updatedAt: number,
  fullJson: string
): string[] {
  const singleMeta = {
    sessionId,
    title: safeTitle,
    createdAt,
    updatedAt,
    messagesJson: fullJson
  };
  if (measureDynamicFieldBytes(singleMeta) <= MAX_ZILLIZ_DYNAMIC_BYTES) {
    return [fullJson];
  }

  const chunks: string[] = [];
  let offset = 0;
  // Estimate worst-case JSON escaping expansion (quotes/newlines -> 2 bytes) and binary-search exact fit
  while (offset < fullJson.length) {
    let low = 1;
    let high = Math.min(fullJson.length - offset, MAX_ZILLIZ_DYNAMIC_BYTES);
    let bestEnd = offset + 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const candidateEnd = sliceSafelyWithoutBreakingSurrogate(fullJson, offset, offset + mid);
      const slice = fullJson.slice(offset, candidateEnd);
      const chunkIdx = chunks.length;
      const testMeta = {
        sessionId: chunkIdx === 0 ? sessionId : `${sessionId}::chunk::${chunkIdx}`,
        parentSessionId: sessionId,
        chunkIndex: chunkIdx,
        totalChunks: 999,
        title: safeTitle,
        createdAt,
        updatedAt,
        messagesJson: slice
      };
      if (measureDynamicFieldBytes(testMeta) <= MAX_ZILLIZ_DYNAMIC_BYTES) {
        bestEnd = candidateEnd;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (bestEnd <= offset) {
      bestEnd = sliceSafelyWithoutBreakingSurrogate(fullJson, offset, offset + 1);
    }
    chunks.push(fullJson.slice(offset, bestEnd));
    offset = bestEnd;
  }

  return chunks;
}

// Local filesystem persistence file
const DATA_DIR = path.resolve(process.cwd(), 'data');
const CHAT_STORE_FILE = path.join(DATA_DIR, 'chat_history.json');

// Gemini client initialization for title summarization
let genAIInstance: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    genAIInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: 'v1beta',
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return genAIInstance;
}

// Load persisted chats from disk on startup
function initLocalStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(CHAT_STORE_FILE)) {
      const raw = fs.readFileSync(CHAT_STORE_FILE, 'utf8');
      const list: SavedChat[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach(c => {
          if (c && c.id && !String(c.id).startsWith('__quickprompt__:')) {
            inMemoryStore.set(c.id, c);
          }
        });
      }
      console.log(`[chatStore] Loaded ${inMemoryStore.size} saved chat(s) from local cache.`);
    }
  } catch (err) {
    console.warn('[chatStore] Warning initializing local store:', err);
  }
}

function flushLocalStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const list = Array.from(inMemoryStore.values());
    fs.writeFileSync(CHAT_STORE_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.warn('[chatStore] Failed to write local store to disk:', err);
  }
}

initLocalStore();

// --- ZILLIZ CLOUD CHATHISTORY INTEGRATION ---

let zillizCollectionChecked = false;
let zillizCollectionAvailable = false;

/**
 * Checks if the 'ChatHistory' collection exists in Zilliz.
 * If not available, creates a new one with 3072 dimensions.
 * Never creates duplicate collections.
 */
export async function ensureZillizChatHistoryCollection(): Promise<boolean> {
  if (zillizCollectionChecked && zillizCollectionAvailable) {
    return true;
  }

  const creds = getCleanZillizUri();
  if (!creds) {
    return false;
  }

  try {
    // 1. Check if collection is available in Zilliz
    const listRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/collections/list',
      operation: 'list_collections',
      body: {},
      notes: 'Check if ChatHistory collection exists'
    });

    let existingCollections: string[] = [];
    if (listRes.ok && listRes.data && Array.isArray(listRes.data.data)) {
      existingCollections = listRes.data.data.map((item: any) =>
        typeof item === 'string' ? item : (item.collectionName || String(item))
      );
    } else {
      console.warn(`[chatStore] Zilliz collections/list returned HTTP ${listRes.status}`);
    }

    if (existingCollections.includes('ChatHistory')) {
      console.log(`[chatStore] Zilliz 'ChatHistory' collection verified and online.`);
      zillizCollectionChecked = true;
      zillizCollectionAvailable = true;
      return true;
    }

    // 2. Collection not present in Zilliz: create a new one
    console.log(`[chatStore] Collection 'ChatHistory' not found in Zilliz. Creating new collection (3072 dims)...`);
    
    // Standard 3072-dim collection creation (Zilliz REST v2)
    const createRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/collections/create',
      operation: 'create_collection',
      body: {
        collectionName: 'ChatHistory',
        dimension: 3072
      },
      notes: 'Create ChatHistory collection with 3072 dims'
    });

    if (createRes.ok && (createRes.data?.code === 0 || createRes.data?.code === undefined)) {
      console.log(`[chatStore] Successfully created new Zilliz collection 'ChatHistory'.`);
      zillizCollectionChecked = true;
      zillizCollectionAvailable = true;
      return true;
    }

    // Fallback schema with VarChar primary key 'id'
    const customCreateRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/collections/create',
      operation: 'create_collection',
      body: {
        collectionName: 'ChatHistory',
        dimension: 3072,
        metricType: 'COSINE',
        primaryField: 'id',
        idType: 'VarChar',
        maxCapacity: 128,
        vectorField: 'vector'
      },
      notes: 'Create ChatHistory collection with explicit VarChar primary key schema'
    });

    if (customCreateRes.ok && (customCreateRes.data?.code === 0 || customCreateRes.data?.code === undefined)) {
      console.log(`[chatStore] Created Zilliz 'ChatHistory' collection via custom schema.`);
      zillizCollectionChecked = true;
      zillizCollectionAvailable = true;
      return true;
    }

    console.warn(`[chatStore] Unable to create Zilliz 'ChatHistory' collection.`);
    return false;
  } catch (err) {
    console.warn('[chatStore] Zilliz collection check/create exception:', err);
    return false;
  }
}

/**
 * Deterministically maps any string or number sessionId to a positive 53-bit integer (Int64 safe)
 * for Zilliz Milvus primary key requirements while preventing duplicates.
 */
export function sessionIdToNumericId(sessionId: string | number): number {
  if (typeof sessionId === 'number') {
    return Math.floor(Math.abs(sessionId));
  }
  const clean = String(sessionId).trim();
  if (/^\d+$/.test(clean)) {
    const parsed = Number(clean);
    if (!isNaN(parsed) && parsed > 0 && parsed <= Number.MAX_SAFE_INTEGER) {
      return parsed;
    }
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x5b79;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x01000193);
  }
  const low = (h1 >>> 0);
  const high = (h2 >>> 0) & 0x1fffff; // 21 bits
  const num = (high * 4294967296) + low;
  return num > 0 ? num : 1;
}

/**
 * Syncs a single chat to remote Zilliz ChatHistory collection.
 * Uses numeric Int64 ID mapped from sessionId as primary key identification.
 * Automatically splits messagesJson across chunk entities when exceeding Milvus's 65,536-byte dynamic field limit.
 */
async function syncChatToZilliz(chat: SavedChat): Promise<void> {
  const creds = getCleanZillizUri();
  if (!creds) return;

  const isReady = await ensureZillizChatHistoryCollection();
  if (!isReady) return;

  try {
    const numericId = chat.numericId || sessionIdToNumericId(chat.id);
    chat.numericId = numericId;
    const safeTitle = String(chat.title || 'Maritime Analysis Session').slice(0, 500);
    const firstContent = String(chat.messages[0]?.content || '').slice(0, 1000);
    const textToEmbed = `${safeTitle} ${firstContent}`;
    const vector = createFastPseudoEmbedding(textToEmbed, 3072);

    const fullJson = JSON.stringify(chat.messages);
    const chunks = splitMessagesJsonForZilliz(
      chat.id,
      safeTitle,
      chat.createdAt,
      chat.updatedAt,
      fullJson
    );
    const totalChunks = chunks.length;
    const prevChunkCount = syncedChunkCounts.get(chat.id) || 0;

    let allSucceeded = true;
    for (let idx = 0; idx < totalChunks; idx++) {
      const chunkSessionId = idx === 0 ? chat.id : `${chat.id}::chunk::${idx}`;
      const chunkNumericId = idx === 0 ? numericId : sessionIdToNumericId(chunkSessionId);

      const entity: Record<string, unknown> =
        totalChunks === 1
          ? {
              id: chunkNumericId,
              sessionId: chunkSessionId,
              vector,
              title: safeTitle,
              createdAt: chat.createdAt,
              updatedAt: chat.updatedAt,
              messagesJson: chunks[idx]
            }
          : {
              id: chunkNumericId,
              sessionId: chunkSessionId,
              parentSessionId: chat.id,
              chunkIndex: idx,
              totalChunks,
              vector,
              title: safeTitle,
              createdAt: chat.createdAt,
              updatedAt: chat.updatedAt,
              messagesJson: chunks[idx]
            };

      const upsertRes = await tracedZillizFetch({
        endpoint: '/v2/vectordb/entities/upsert',
        operation: 'upsert_chat',
        body: {
          collectionName: 'ChatHistory',
          data: [entity]
        },
        notes:
          totalChunks === 1
            ? `Upsert chat '${safeTitle}' (Session: ${chat.id}, Numeric ID: ${numericId})`
            : `Upsert chat '${safeTitle}' chunk ${idx + 1}/${totalChunks} (Session: ${chat.id}, Numeric ID: ${chunkNumericId})`
      });

      if (!upsertRes.ok || (upsertRes.data && upsertRes.data.code !== 0 && upsertRes.data.code !== undefined)) {
        allSucceeded = false;
        console.warn(`[chatStore] Failed to upsert chat ${chat.id} chunk ${idx + 1}/${totalChunks} to Zilliz (${upsertRes.status}):`, upsertRes.error);
      }
    }

    if (allSucceeded) {
      const prevSavedChunkCount = chat.chunkCount || prevChunkCount;
      syncedChunkCounts.set(chat.id, totalChunks);
      chat.chunkCount = totalChunks;
      flushLocalStore();
      // Clean up any leftover chunks if the chat shrank in chunk count
      if (prevSavedChunkCount > totalChunks) {
        const staleIds: number[] = [];
        for (let k = totalChunks; k < prevSavedChunkCount; k++) {
          staleIds.push(sessionIdToNumericId(`${chat.id}::chunk::${k}`));
        }
        if (staleIds.length > 0) {
          await tracedZillizFetch({
            endpoint: '/v2/vectordb/entities/delete',
            operation: 'delete_chat',
            body: {
              collectionName: 'ChatHistory',
              filter: `id in [${staleIds.join(',')}]`
            },
            notes: `Clean up ${staleIds.length} stale chunk(s) for chat '${chat.id}'`
          });
        }
      }
      console.log(
        `[chatStore] Synced chat session '${safeTitle}' (ID: ${chat.id}, Numeric ID: ${numericId}${totalChunks > 1 ? `, ${totalChunks} chunks` : ''}) to Zilliz ChatHistory.`
      );
    }
  } catch (err) {
    console.warn(`[chatStore] Zilliz sync failed for chat ${chat.id}:`, err);
  }
}

/**
 * Deletes a chat (and any multi-part chunks) from remote Zilliz ChatHistory collection by ID
 */
export async function deleteChatFromZilliz(chatId: string): Promise<boolean> {
  const creds = getCleanZillizUri();
  if (!creds) return false;

  const chat = inMemoryStore.get(chatId);
  const numericId = chat?.numericId || sessionIdToNumericId(chatId);
  const idsToDelete = new Set<number>([numericId]);

  const trackedChunks = Math.max(syncedChunkCounts.get(chatId) || 1, chat?.chunkCount || 1);
  for (let k = 1; k < trackedChunks; k++) {
    idsToDelete.add(sessionIdToNumericId(`${chatId}::chunk::${k}`));
  }

  try {
    const idList = Array.from(idsToDelete).join(',');
    const deleteRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/entities/delete',
      operation: 'delete_chat',
      body: {
        collectionName: 'ChatHistory',
        filter: `id in [${idList}]`
      },
      notes: `Delete chat session ID '${chatId}' (IDs: ${idList})`
    });
    if (deleteRes.ok && (deleteRes.data?.code === 0 || deleteRes.data?.code === undefined)) {
      syncedChunkCounts.delete(chatId);
      console.log(`[chatStore] Deleted chat session ID '${chatId}' (Numeric ID: ${numericId}) from Zilliz ChatHistory.`);
      return true;
    } else {
      console.warn(`[chatStore] Zilliz delete failed for chat ${chatId}:`, deleteRes.error);
      return false;
    }
  } catch (err) {
    console.warn(`[chatStore] Zilliz delete exception for chat ${chatId}:`, err);
    return false;
  }
}

/**
 * Restores all chat threads from remote Zilliz collection into inMemoryStore (reassembling multi-chunk chats)
 */
export async function restoreChatsFromZilliz(): Promise<void> {
  const creds = getCleanZillizUri();
  if (!creds) return;

  const isReady = await ensureZillizChatHistoryCollection();
  if (!isReady) return;

  try {
    const queryRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/entities/query',
      operation: 'query_chats',
      body: {
        collectionName: 'ChatHistory',
        outputFields: ['id', 'sessionId', 'parentSessionId', 'chunkIndex', 'totalChunks', 'title', 'createdAt', 'updatedAt', 'messagesJson'],
        limit: 200
      },
      notes: 'Restore saved chats from Zilliz ChatHistory'
    });

    if (queryRes.ok && queryRes.data && (queryRes.data.code === 0 || queryRes.data.code === undefined)) {
      // Zilliz REST API v2 returns a flat array directly inside queryRes.data.data
      if (Array.isArray(queryRes.data.data)) {
        const chunkGroups = new Map<
          string,
          {
            numericId: number;
            title: string;
            createdAt: number;
            updatedAt: number;
            totalChunks: number;
            parts: Map<number, string>;
          }
        >();

        for (const item of queryRes.data.data) {
          if (!item.id && !item.sessionId) continue;
          const rawSessionId = String(item.sessionId || '');
          if (rawSessionId.startsWith('__quickprompt__:')) continue;

          const isChunkRecord =
            rawSessionId.includes('::chunk::') ||
            (typeof item.totalChunks === 'number' && item.totalChunks > 1);

          if (isChunkRecord) {
            const baseSessionId = String(
              item.parentSessionId || rawSessionId.split('::chunk::')[0] || item.id
            );
            const chunkIdx =
              typeof item.chunkIndex === 'number'
                ? item.chunkIndex
                : rawSessionId.includes('::chunk::')
                ? Number(rawSessionId.split('::chunk::')[1]) || 0
                : 0;
            const totalChunks = Number(item.totalChunks) || 1;
            const rawNumericId = typeof item.id === 'number' ? item.id : Number(item.id);
            const baseNumericId =
              chunkIdx === 0 && !isNaN(rawNumericId) && rawNumericId > 0
                ? rawNumericId
                : sessionIdToNumericId(baseSessionId);

            let group = chunkGroups.get(baseSessionId);
            if (!group) {
              group = {
                numericId: baseNumericId,
                title: String(item.title || 'Untitled Maritime Chat'),
                createdAt: Number(item.createdAt) || Date.now(),
                updatedAt: Number(item.updatedAt) || Date.now(),
                totalChunks,
                parts: new Map<number, string>()
              };
              chunkGroups.set(baseSessionId, group);
            }
            if (chunkIdx === 0 && !isNaN(rawNumericId) && rawNumericId > 0) {
              group.numericId = rawNumericId;
            }
            if (Number(item.updatedAt) >= group.updatedAt) {
              group.updatedAt = Number(item.updatedAt) || group.updatedAt;
              if (item.title) group.title = String(item.title);
            }
            group.totalChunks = Math.max(group.totalChunks, totalChunks);
            if (typeof item.messagesJson === 'string') {
              group.parts.set(chunkIdx, item.messagesJson);
            }
            continue;
          }

          let messages: ChatMessageData[] = [];
          try {
            messages = typeof item.messagesJson === 'string' ? JSON.parse(item.messagesJson) : (item.messages || []);
          } catch {
            messages = [];
          }

          const rawNumericId = typeof item.id === 'number' ? item.id : Number(item.id);
          const sessionId = String(item.sessionId || item.id);
          const numericId = !isNaN(rawNumericId) && rawNumericId > 0 ? rawNumericId : sessionIdToNumericId(sessionId);

          syncedChunkCounts.set(sessionId, 1);
          const chat: SavedChat = {
            id: sessionId,
            numericId,
            title: String(item.title || 'Untitled Maritime Chat'),
            createdAt: Number(item.createdAt) || Date.now(),
            updatedAt: Number(item.updatedAt) || Date.now(),
            messages
          };

          // Update memory if not already newer locally
          const local = inMemoryStore.get(chat.id);
          if (!local || local.updatedAt <= chat.updatedAt) {
            inMemoryStore.set(chat.id, chat);
          }
        }

        // Reassemble multi-chunk chats
        for (const [baseSessionId, group] of chunkGroups.entries()) {
          const orderedParts: string[] = [];
          let missingChunk = false;
          for (let i = 0; i < group.totalChunks; i++) {
            const part = group.parts.get(i);
            if (part === undefined) {
              missingChunk = true;
              break;
            }
            orderedParts.push(part);
          }
          if (missingChunk) continue;

          let messages: ChatMessageData[] = [];
          try {
            const parsed = JSON.parse(orderedParts.join(''));
            if (Array.isArray(parsed)) {
              messages = parsed;
            }
          } catch {
            continue;
          }

          syncedChunkCounts.set(baseSessionId, group.totalChunks);
          const chat: SavedChat = {
            id: baseSessionId,
            numericId: group.numericId,
            chunkCount: group.totalChunks,
            title: group.title,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt,
            messages
          };
          const local = inMemoryStore.get(chat.id);
          if (!local || local.updatedAt <= chat.updatedAt) {
            inMemoryStore.set(chat.id, chat);
          }
        }

        flushLocalStore();
        console.log(`[chatStore] Restored ${queryRes.data.data.length} chat record(s) from Zilliz.`);
      }
    } else {
      console.warn('[chatStore] Zilliz query returned non-zero code or error:', queryRes.error);
    }
  } catch (err) {
    console.warn('[chatStore] Error restoring chats from Zilliz:', err);
  }
}

let zillizRestorePromise: Promise<void> | null = null;

/**
 * Ensures Zilliz chat restoration runs at least once and returns the Promise.
 */
export function ensureChatsRestoredFromZilliz(): Promise<void> {
  if (!zillizRestorePromise) {
    zillizRestorePromise = restoreChatsFromZilliz().catch((err) => {
      console.warn('[chatStore] Zilliz restore error:', err);
    });
  }
  return zillizRestorePromise;
}

// Trigger background restore immediately on startup
ensureChatsRestoredFromZilliz();

// --- CHAT STORE PUBLIC OPERATIONS ---

/**
 * Summarizes the first user prompt into a short, informative title (3-6 words)
 */
export async function summarizeFirstPrompt(prompt: string): Promise<string> {
  const clean = prompt.trim();
  if (!clean) return 'New Maritime Inquiry';

  try {
    const ai = getGenAI();
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `You are an AI assistant for a maritime intelligence platform.
Summarize this user prompt into a concise, professional title (3 to 6 words maximum).
Do NOT use quotation marks, punctuation, or conversational intros like "Title:".

User Prompt: "${clean}"`
    });

    const summary = res.text?.trim().replace(/^["']|["']$/g, '').replace(/^[A-Za-z]+:\s*/, '').trim();
    if (summary && summary.length >= 3 && summary.length <= 60) {
      return summary;
    }
  } catch (err) {
    console.warn('[chatStore] Gemini title summarization fallback:', err);
  }

  // Graceful fallback: clean first 35 chars
  const fallback = clean.slice(0, 35).trim();
  return fallback + (clean.length > 35 ? '...' : '');
}

/**
 * Saves or updates a chat session in the store and syncs to Zilliz
 */
export async function saveChatSession(
  sessionId: string,
  messages: ChatMessageData[],
  customTitle?: string
): Promise<SavedChat> {
  const now = Date.now();
  let chat = inMemoryStore.get(sessionId);

  // If new chat and no title provided, summarize from first user prompt
  let title = customTitle || chat?.title;
  if (!title) {
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (firstUserMsg && firstUserMsg.content) {
      title = await summarizeFirstPrompt(firstUserMsg.content);
    } else {
      title = 'Maritime Analysis Session';
    }
  }

  if (chat) {
    chat.title = title;
    chat.messages = messages;
    chat.updatedAt = now;
    if (!chat.numericId) {
      chat.numericId = sessionIdToNumericId(sessionId);
    }
  } else {
    chat = {
      id: sessionId,
      numericId: sessionIdToNumericId(sessionId),
      title,
      createdAt: now,
      updatedAt: now,
      messages
    };
    inMemoryStore.set(sessionId, chat);
  }

  flushLocalStore();

  // Async sync to Zilliz without blocking response
  syncChatToZilliz(chat).catch(err => {
    console.warn('[chatStore] Background sync to Zilliz failed:', err);
  });

  return chat;
}

/**
 * Renames an existing chat session
 */
export async function renameChatSession(sessionId: string, newTitle: string): Promise<SavedChat | null> {
  const chat = inMemoryStore.get(sessionId);
  if (!chat) return null;

  chat.title = newTitle.trim() || 'Untitled Session';
  chat.updatedAt = Date.now();

  flushLocalStore();

  syncChatToZilliz(chat).catch(err => {
    console.warn('[chatStore] Background rename sync to Zilliz failed:', err);
  });

  return chat;
}

/**
 * Deletes a chat session from memory, disk, and Zilliz (synchronously awaiting remote Zilliz delete)
 */
export async function deleteChatSession(sessionId: string): Promise<boolean> {
  const existed = inMemoryStore.delete(sessionId);
  flushLocalStore();

  // Await deletion from remote Zilliz collection so UI and DB stay in strict lockstep
  let remoteDeleted = false;
  try {
    remoteDeleted = await deleteChatFromZilliz(sessionId);
  } catch (err) {
    console.warn('[chatStore] Error during Zilliz remote chat deletion:', err);
  }

  return existed || remoteDeleted;
}

/**
 * Retrieves all saved chats sorted by updatedAt descending
 */
export function getAllSavedChats(): SavedChatSummary[] {
  return Array.from(inMemoryStore.values())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(c => {
      const lastMsg = c.messages[c.messages.length - 1];
      const preview = lastMsg ? (lastMsg.content.slice(0, 90) + (lastMsg.content.length > 90 ? '...' : '')) : '';
      const userQueries = c.messages
        .filter(m => m.role === 'user' && m.content && m.content.trim().length > 0)
        .map(m => m.content.trim());
      return {
        id: c.id,
        numericId: c.numericId || sessionIdToNumericId(c.id),
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messageCount: c.messages.length,
        preview,
        userQueries
      };
    });
}

/**
 * Retrieves a specific saved chat by ID
 */
export function getSavedChatById(sessionId: string): SavedChat | undefined {
  return inMemoryStore.get(sessionId);
}
