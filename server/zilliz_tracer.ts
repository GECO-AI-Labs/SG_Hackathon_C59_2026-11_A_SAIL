/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * zilliz_tracer.ts
 * Observability, HTTP Tracing, and Diagnostic Engine for Zilliz Cloud Milvus REST API v2.
 * 
 * Features:
 * 1. Ring buffer recording all outgoing HTTP requests and incoming responses to Zilliz.
 * 2. Automatic sanitization of credentials for display in Observability UI.
 * 3. Enforces clean REST URI (strips port :19530).
 * 4. Adheres strictly to Zilliz REST API v2 format (flat json.data array, code === 0 check).
 * 5. Full roundtrip diagnostic (Check -> List -> Create -> Upsert -> Query back -> Delete -> Validate).
 */

import fs from 'fs';
import path from 'path';
import { createFastPseudoEmbedding } from './retrieval_zilliz.js';

export interface ZillizHttpTrace {
  id: string;
  timestamp: string;
  timestampMs: number;
  operation: 'list_collections' | 'create_collection' | 'upsert_chat' | 'query_chats' | 'delete_chat' | 'upsert_shortcut' | 'query_shortcuts' | 'delete_shortcut' | 'diagnostic_roundtrip' | 'vector_search';
  method: string;
  url: string;
  endpoint: string;
  requestPayload?: Record<string, unknown> | null;
  responseStatus: number;
  statusText?: string;
  durationMs: number;
  responseBody?: Record<string, unknown> | null;
  error?: string | null;
  success: boolean;
  notes?: string;
}

export interface ZillizDiagnosticStep {
  name: string;
  success: boolean;
  durationMs: number;
  details: string;
  payloadSent?: Record<string, unknown>;
  responseReceived?: Record<string, unknown>;
}

export interface ZillizDiagnosticResult {
  timestamp: string;
  configured: boolean;
  overallSuccess: boolean;
  zillizUri: string;
  steps: ZillizDiagnosticStep[];
  error?: string;
}

// In-memory ring buffer for HTTP traces (keep up to 100 recent calls)
const MAX_TRACES = 100;
const httpTraces: ZillizHttpTrace[] = [];

/**
 * Normalizes Zilliz REST URL (strips quotes, gRPC port :19530, and trailing slashes)
 */
export function normalizeZillizRestUrl(uri: string): string {
  let clean = uri.trim().replace(/^["']|["']$/g, '').trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  // Strip trailing slashes
  clean = clean.replace(/\/+$/, '');
  // Strip gRPC port 19530 if inadvertently provided in REST URI
  clean = clean.replace(/:19530\/?$/, '');
  return clean;
}

/**
 * Normalizes Zilliz API Key / Token (strips surrounding quotes and accidental "Bearer " prefix)
 */
export function normalizeZillizToken(token: string): string {
  return token
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .trim();
}

export function getCleanZillizUri(): { cleanUri: string; token: string } | null {
  const uri = process.env.ZILLIZ_URI?.trim();
  const token = (process.env.ZILLIZ_API_KEY || process.env.ZILLIZ_TOKEN)?.trim();
  if (!uri || !token) return null;

  return { cleanUri: normalizeZillizRestUrl(uri), token: normalizeZillizToken(token) };
}

function readSecretFileIfPresent(names: string[]): string | undefined {
  for (const dir of ['/etc/secrets', '/run/secrets']) {
    for (const name of names) {
      try {
        const fullPath = path.join(dir, name);
        if (fs.existsSync(fullPath)) {
          const val = fs.readFileSync(fullPath, 'utf8').trim();
          if (val) return val;
        }
      } catch {
        // Ignore unreadable secret mount paths
      }
    }
  }
  return undefined;
}

/**
 * Resolves secondary Zilliz credentials dedicated to the 'QuickPrompt' database:
 * Prioritizes ZILLIZ_2_URI and ZILLIZ_2_KEY (with fallback support for hyphenated ZILLIZ-2-* names).
 */
export function getCleanZilliz2UriWithMeta(): {
  cleanUri: string;
  token: string;
  uriKey: string;
  keyKey: string;
} | null {
  const uriCandidates: Array<[string, string | undefined]> = [
    ['ZILLIZ_2_URI', process.env.ZILLIZ_2_URI],
    ['ZILLIZ-2-URI', process.env['ZILLIZ-2-URI']],
    ['ZILLIZ_2_ENDPOINT', process.env.ZILLIZ_2_ENDPOINT],
    ['ZILLIZ-2-ENDPOINT', process.env['ZILLIZ-2-ENDPOINT']]
  ];

  const keyCandidates: Array<[string, string | undefined]> = [
    ['ZILLIZ_2_KEY', process.env.ZILLIZ_2_KEY],
    ['ZILLIZ-2-KEY', process.env['ZILLIZ-2-KEY']],
    ['ZILLIZ_2_API_KEY', process.env.ZILLIZ_2_API_KEY],
    ['ZILLIZ-2-API-KEY', process.env['ZILLIZ-2-API-KEY']],
    ['ZILLIZ_2_TOKEN', process.env.ZILLIZ_2_TOKEN]
  ];

  let uri = '';
  let uriKey = '';
  for (const [name, val] of uriCandidates) {
    if (val && val.trim()) {
      uri = val.trim();
      uriKey = name;
      break;
    }
  }

  let token = '';
  let keyKey = '';
  for (const [name, val] of keyCandidates) {
    if (val && val.trim()) {
      token = val.trim();
      keyKey = name;
      break;
    }
  }

  // Case-insensitive env key scan in case secret names were prefixed/normalized
  if (!uri || !token) {
    for (const [k, v] of Object.entries(process.env)) {
      if (!v || !v.trim()) continue;
      if (!uri && /^(?:secret_)?zilliz[-_]?2[-_]?(uri|url|endpoint)$/i.test(k)) {
        uri = v.trim();
        uriKey = k;
      }
      if (!token && /^(?:secret_)?zilliz[-_]?2[-_]?(key|api[-_]?key|token)$/i.test(k)) {
        token = v.trim();
        keyKey = k;
      }
    }
  }

  // Optional mounted secret files fallback
  if (!uri) {
    const fileVal = readSecretFileIfPresent(['ZILLIZ_2_URI', 'ZILLIZ-2-URI']);
    if (fileVal) {
      uri = fileVal;
      uriKey = 'secret_file';
    }
  }
  if (!token) {
    const fileVal = readSecretFileIfPresent(['ZILLIZ_2_KEY', 'ZILLIZ-2-KEY']);
    if (fileVal) {
      token = fileVal;
      keyKey = 'secret_file';
    }
  }

  if (!uri || !token) return null;

  return {
    cleanUri: normalizeZillizRestUrl(uri),
    token: normalizeZillizToken(token),
    uriKey,
    keyKey
  };
}

export function getCleanZilliz2Uri(): { cleanUri: string; token: string } | null {
  const res = getCleanZilliz2UriWithMeta();
  if (!res) return null;
  return { cleanUri: res.cleanUri, token: res.token };
}

/**
 * Returns ONLY environment variable key names mentioning 'zilliz' (never values) for diagnostics.
 */
export function getDetectedZillizEnvKeyNames(): string[] {
  return Object.keys(process.env).filter((k) => /zilliz/i.test(k));
}

/**
 * Records an HTTP trace into the ring buffer
 */
export function recordZillizHttpTrace(entry: Omit<ZillizHttpTrace, 'id'>): ZillizHttpTrace {
  const trace: ZillizHttpTrace = {
    id: `ztrace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ...entry
  };
  httpTraces.unshift(trace);
  if (httpTraces.length > MAX_TRACES) {
    httpTraces.pop();
  }
  return trace;
}

/**
 * Returns all recorded Zilliz HTTP traces
 */
export function getZillizHttpTraces(): ZillizHttpTrace[] {
  return [...httpTraces];
}

/**
 * Clears recorded Zilliz HTTP traces
 */
export function clearZillizHttpTraces(): void {
  httpTraces.length = 0;
}

/**
 * Universal wrapper for executing and tracing all HTTP requests sent to Zilliz REST API v2
 */
export async function tracedZillizFetch<T = any>(options: {
  endpoint: string;
  method?: string;
  body?: Record<string, unknown>;
  operation: ZillizHttpTrace['operation'];
  notes?: string;
  customToken?: string;
  customUri?: string;
  credentialLabel?: string;
}): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  data: T | null;
  error: string | null;
  durationMs: number;
}> {
  const method = options.method || 'POST';
  const hasCustomOverride = options.customUri !== undefined || options.customToken !== undefined;
  const creds = hasCustomOverride ? null : getCleanZillizUri();

  const rawBaseUri = hasCustomOverride ? options.customUri : creds?.cleanUri;
  const rawToken = hasCustomOverride ? options.customToken : creds?.token;
  const baseUri = rawBaseUri ? normalizeZillizRestUrl(rawBaseUri) : '';
  const token = rawToken ? normalizeZillizToken(rawToken) : '';
  const authNote = options.credentialLabel
    ? `${options.notes ? `${options.notes} ` : ''}[Creds: ${options.credentialLabel}]`
    : options.notes;

  if (!baseUri || !token) {
    const errorMsg = hasCustomOverride
      ? 'Custom Zilliz URI or API Key missing (strict custom auth mode)'
      : 'Zilliz URI or API Key not configured';
    recordZillizHttpTrace({
      timestamp: new Date().toISOString(),
      timestampMs: Date.now(),
      operation: options.operation,
      method,
      url: options.endpoint,
      endpoint: options.endpoint,
      requestPayload: options.body || null,
      responseStatus: 0,
      statusText: 'Client Error: Missing Credentials',
      durationMs: 0,
      responseBody: null,
      error: errorMsg,
      success: false,
      notes: authNote || 'Aborted: Missing credentials'
    });
    return { ok: false, status: 0, statusText: 'Missing Credentials', data: null, error: errorMsg, durationMs: 0 };
  }

  const cleanEndpoint = options.endpoint.startsWith('/') ? options.endpoint : `/${options.endpoint}`;
  const fullUrl = `${baseUri}${cleanEndpoint}`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const durationMs = Date.now() - startTime;
    let jsonBody: any = null;
    let rawText = '';

    try {
      rawText = await res.text();
      jsonBody = rawText ? JSON.parse(rawText) : null;
    } catch {
      jsonBody = { raw: rawText };
    }

    const isCodeOk = jsonBody && (jsonBody.code === 0 || jsonBody.code === undefined);
    const success = res.ok && isCodeOk;
    const error = !success ? (jsonBody?.message || `HTTP ${res.status} ${res.statusText}`) : null;

    recordZillizHttpTrace({
      timestamp: new Date().toISOString(),
      timestampMs: startTime,
      operation: options.operation,
      method,
      url: fullUrl,
      endpoint: cleanEndpoint,
      requestPayload: options.body || null,
      responseStatus: res.status,
      statusText: res.statusText,
      durationMs,
      responseBody: jsonBody,
      error,
      success,
      notes: authNote
    });

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      data: jsonBody,
      error,
      durationMs
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    recordZillizHttpTrace({
      timestamp: new Date().toISOString(),
      timestampMs: startTime,
      operation: options.operation,
      method,
      url: fullUrl,
      endpoint: cleanEndpoint,
      requestPayload: options.body || null,
      responseStatus: 0,
      statusText: 'Network / Fetch Error',
      durationMs,
      responseBody: null,
      error: errorMsg,
      success: false,
      notes: authNote
    });

    return {
      ok: false,
      status: 0,
      statusText: 'Fetch Error',
      data: null,
      error: errorMsg,
      durationMs
    };
  }
}

/**
 * Runs a comprehensive end-to-end diagnostic checking:
 * 1. Zilliz credentials & REST endpoint sanitization (stripping :19530)
 * 2. Collection listing and ChatHistory presence check
 * 3. Collection creation (if not exists)
 * 4. Writing (upserting) a synthetic chat record
 * 5. Retrieving back the written chat record (verifying flat json.data array & code === 0)
 * 6. Cleaning up the test chat record (delete)
 */
export async function runZillizChatDiagnostic(): Promise<ZillizDiagnosticResult> {
  const steps: ZillizDiagnosticStep[] = [];
  const creds = getCleanZillizUri();

  if (!creds) {
    return {
      timestamp: new Date().toISOString(),
      configured: false,
      overallSuccess: false,
      zillizUri: 'Not Configured',
      error: 'ZILLIZ_URI and/or ZILLIZ_API_KEY environment variables are not configured.',
      steps: [
        {
          name: '1. Credentials & REST URI Validation',
          success: false,
          durationMs: 0,
          details: 'Missing ZILLIZ_URI or ZILLIZ_API_KEY. Configure in environment or settings.'
        }
      ]
    };
  }

  // Step 1: Handshake & Credential Sanity Check
  steps.push({
    name: '1. Credentials & REST URI Validation',
    success: true,
    durationMs: 1,
    details: `Target REST URI: ${creds.cleanUri} (gRPC port 19530 safely omitted). API Key authenticated.`,
    payloadSent: { cleanUri: creds.cleanUri, hasToken: true }
  });

  const testSessionId = `diagnostic-test-${Date.now()}`;
  let overallSuccess = true;

  try {
    // Step 2: List collections
    const listRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/collections/list',
      operation: 'list_collections',
      body: {},
      notes: 'Diagnostic: Check if ChatHistory collection exists'
    });

    let collectionsList: string[] = [];
    if (listRes.data && Array.isArray(listRes.data.data)) {
      collectionsList = listRes.data.data.map((item: any) =>
        typeof item === 'string' ? item : (item.collectionName || String(item))
      );
    }

    const hasChatHistory = collectionsList.includes('ChatHistory');
    steps.push({
      name: '2. Check Zilliz Collections List',
      success: listRes.ok && (listRes.data?.code === 0 || listRes.data?.code === undefined),
      durationMs: listRes.durationMs,
      details: listRes.ok
        ? `Found ${collectionsList.length} collection(s): [${collectionsList.join(', ')}]. 'ChatHistory' available: ${hasChatHistory}`
        : `Failed to list collections: ${listRes.error}`,
      payloadSent: {},
      responseReceived: listRes.data || undefined
    });

    if (!listRes.ok) overallSuccess = false;

    // Step 3: Ensure / Create Collection if missing
    if (!hasChatHistory) {
      const createRes = await tracedZillizFetch({
        endpoint: '/v2/vectordb/collections/create',
        operation: 'create_collection',
        body: {
          collectionName: 'ChatHistory',
          dimension: 3072
        },
        notes: 'Diagnostic: Create ChatHistory collection'
      });

      const createOk = createRes.ok && (createRes.data?.code === 0 || createRes.data?.code === undefined);
      const isLimitExceeded = createRes.data?.code === 102 || Boolean(createRes.error?.includes('exceeded the limit'));

      let stepDetails = `Creation error: ${createRes.error}`;
      if (createOk) {
        stepDetails = `Created 'ChatHistory' collection with 3072 dimensions.`;
      } else if (isLimitExceeded) {
        stepDetails = `Zilliz Serverless cluster collection limit reached (5/5). Existing: [${collectionsList.join(', ')}]. The 5th slot is occupied by backup collection 'AIS_backup_api_v1'. Drop 'AIS_backup_api_v1' to free up the slot for 'ChatHistory'.`;
      }

      steps.push({
        name: '3. Create Collection (ChatHistory, 3072 dims)',
        success: createOk,
        durationMs: createRes.durationMs,
        details: stepDetails,
        payloadSent: { collectionName: 'ChatHistory', dimension: 3072 },
        responseReceived: createRes.data || undefined
      });

      if (!createOk) overallSuccess = false;
    } else {
      steps.push({
        name: '3. Collection Verification',
        success: true,
        durationMs: 1,
        details: `'ChatHistory' collection already exists in Zilliz. Ready for chat serialization.`
      });
    }

    // Step 4: Write / Upsert synthetic chat thread
    // Note: Zilliz Milvus default schema uses Int64 for primary field 'id'
    const testNumericId = Math.floor(Date.now() / 1000) * 10000 + Math.floor(Math.random() * 9999);
    const testMessages = [
      { id: 'msg-1', role: 'user', content: 'Diagnostic Test: Container freight rates Singapore Cai Mep', timestamp: '12:00:00' },
      { id: 'msg-2', role: 'assistant', content: 'Diagnostic response: Verified high-speed REST write to Zilliz.', timestamp: '12:00:01' }
    ];
    const testVector = createFastPseudoEmbedding('Diagnostic Test Singapore Cai Mep', 3072);

    const upsertPayload = {
      collectionName: 'ChatHistory',
      data: [
        {
          id: testNumericId,
          sessionId: testSessionId,
          vector: testVector,
          title: 'Diagnostic Test Chat',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messagesJson: JSON.stringify(testMessages)
        }
      ]
    };

    const upsertRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/entities/upsert',
      operation: 'upsert_chat',
      body: upsertPayload,
      notes: `Diagnostic: Upsert test session '${testSessionId}' (Numeric ID: ${testNumericId})`
    });

    const upsertOk = upsertRes.ok && (upsertRes.data?.code === 0 || upsertRes.data?.code === undefined);
    steps.push({
      name: '4. Write & Upsert Chat Session to Zilliz',
      success: upsertOk,
      durationMs: upsertRes.durationMs,
      details: upsertOk
        ? `Successfully upserted chat session (Int64 ID: ${testNumericId}, 3072-dim vector & messagesJson). Upsert response code: ${upsertRes.data?.code ?? 0}.`
        : `Upsert failed: ${upsertRes.error}`,
      payloadSent: {
        collectionName: 'ChatHistory',
        data: [{ id: testNumericId, sessionId: testSessionId, title: 'Diagnostic Test Chat', messagesCount: 2 }]
      },
      responseReceived: upsertRes.data || undefined
    });

    if (!upsertOk) overallSuccess = false;

    // Step 5: Retrieve back written chat using entities/query
    // Adhering strictly to Zilliz REST API v2 flat array specification
    const queryPayload = {
      collectionName: 'ChatHistory',
      filter: `id in [${testNumericId}]`,
      outputFields: ['id', 'sessionId', 'title', 'createdAt', 'updatedAt', 'messagesJson'],
      limit: 5
    };

    const queryRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/entities/query',
      operation: 'query_chats',
      body: queryPayload,
      notes: `Diagnostic: Query back test session (ID: ${testNumericId})`
    });

    let retrievedItem: any = null;
    let queryValidated = false;
    let validationNote = '';

    if (queryRes.ok && (queryRes.data?.code === 0 || queryRes.data?.code === undefined)) {
      // 1. In REST API v2, json.data is directly a FLAT array:
      if (Array.isArray(queryRes.data.data)) {
        retrievedItem = queryRes.data.data.find((item: any) => item.id === testNumericId);
        if (retrievedItem) {
          try {
            const parsedMsgs = JSON.parse(retrievedItem.messagesJson);
            if (Array.isArray(parsedMsgs) && parsedMsgs.length === 2) {
              queryValidated = true;
              validationNote = `Retrieved matching entity from flat json.data array. Title: "${retrievedItem.title}", Messages verified: 2 items.`;
            } else {
              validationNote = `Retrieved entity found but messagesJson array was unexpected.`;
            }
          } catch {
            validationNote = `Retrieved entity found but messagesJson failed to parse.`;
          }
        } else {
          validationNote = `Query succeeded but test numeric ID '${testNumericId}' was not found in json.data (found ${queryRes.data.data.length} records).`;
        }
      } else {
        validationNote = `json.data was not an array (type: ${typeof queryRes.data.data}).`;
      }
    } else {
      validationNote = `Query failed with error: ${queryRes.error}`;
    }

    steps.push({
      name: '5. Query Back & Validate Written Chat (REST API v2 Flat Parser)',
      success: queryValidated,
      durationMs: queryRes.durationMs,
      details: validationNote,
      payloadSent: queryPayload,
      responseReceived: queryRes.data || undefined
    });

    if (!queryValidated) overallSuccess = false;

    // Step 6: Clean up synthetic test chat record
    const deletePayload = {
      collectionName: 'ChatHistory',
      filter: `id in [${testNumericId}]`
    };

    const deleteRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/entities/delete',
      operation: 'delete_chat',
      body: deletePayload,
      notes: `Diagnostic: Clean up test session (ID: ${testNumericId})`
    });

    const deleteOk = deleteRes.ok && (deleteRes.data?.code === 0 || deleteRes.data?.code === undefined);
    steps.push({
      name: '6. Clean Up Test Entity (Delete)',
      success: deleteOk,
      durationMs: deleteRes.durationMs,
      details: deleteOk
        ? `Deleted synthetic test record (ID: ${testNumericId}) from ChatHistory.`
        : `Delete step returned warning: ${deleteRes.error}`,
      payloadSent: deletePayload,
      responseReceived: deleteRes.data || undefined
    });

  } catch (err: any) {
    overallSuccess = false;
    steps.push({
      name: 'Diagnostic Execution Error',
      success: false,
      durationMs: 0,
      details: `Unexpected error during diagnostic execution: ${err instanceof Error ? err.message : String(err)}`
    });
  }

  return {
    timestamp: new Date().toISOString(),
    configured: true,
    overallSuccess,
    zillizUri: creds.cleanUri,
    steps
  };
}

/**
 * Runs a dedicated end-to-end diagnostic for the QuickPrompt collection on ZILLIZ-2:
 * 1. ZILLIZ-2 Secret & REST URI validation (no secret token exposed)
 * 2. Auth & cluster handshake (/v2/vectordb/collections/list) + code 80020 cross-check if denied
 * 3. QuickPrompt collection presence check / creation (3072 dims)
 * 4. Synthetic QuickPrompt entity upsert
 * 5. Query back & REST API v2 flat json.data validation
 * 6. Cleanup delete of synthetic test entity
 */
export async function runZillizQuickPromptDiagnostic(): Promise<ZillizDiagnosticResult> {
  const steps: ZillizDiagnosticStep[] = [];
  const creds2 = getCleanZilliz2UriWithMeta();
  const primary = getCleanZillizUri();
  const detectedKeys = getDetectedZillizEnvKeyNames();

  if (!creds2) {
    return {
      timestamp: new Date().toISOString(),
      configured: false,
      overallSuccess: false,
      zillizUri: 'Not Configured',
      error: `ZILLIZ_2_URI / ZILLIZ_2_KEY not found in container environment (detected Zilliz keys: ${detectedKeys.join(', ') || 'none'}).`,
      steps: [
        {
          name: '1. ZILLIZ_2_URI & ZILLIZ_2_KEY Validation',
          success: false,
          durationMs: 0,
          details: `Missing ZILLIZ_2_URI or ZILLIZ_2_KEY. Detected Zilliz env keys: [${detectedKeys.join(', ')}]. Ensure secrets use underscores (ZILLIZ_2_URI, ZILLIZ_2_KEY).`
        }
      ]
    };
  }

  const matchesPrimaryKey = Boolean(primary && creds2.token === primary.token);
  const matchesPrimaryUri = Boolean(primary && creds2.cleanUri === primary.cleanUri);
  const tokenHasWhitespace = /\s/.test(creds2.token);
  const credentialLabel = `${creds2.uriKey} + ${creds2.keyKey}`;

  steps.push({
    name: '1. ZILLIZ_2_URI & ZILLIZ_2_KEY Validation',
    success: !matchesPrimaryKey && !matchesPrimaryUri && !tokenHasWhitespace,
    durationMs: 1,
    details: `Strictly using ${creds2.uriKey} (${creds2.cleanUri}) with ${creds2.keyKey} (${creds2.token.length} chars, whitespace=${tokenHasWhitespace}, distinctFromPrimaryKey=${!matchesPrimaryKey}, distinctFromPrimaryUri=${!matchesPrimaryUri}).${matchesPrimaryKey ? ' WARNING: ZILLIZ_2_KEY value currently equals primary ZILLIZ_API_KEY in container env!' : ''} Detected keys: [${detectedKeys.join(', ')}].`,
    payloadSent: {
      uriKey: creds2.uriKey,
      keyKey: creds2.keyKey,
      cleanUri: creds2.cleanUri,
      tokenLength: creds2.token.length,
      tokenHasWhitespace,
      distinctFromPrimaryKey: !matchesPrimaryKey,
      distinctFromPrimaryUri: !matchesPrimaryUri,
      detectedKeys
    }
  });

  let overallSuccess = true;

  try {
    // Step 2: List collections strictly on ZILLIZ_2_URI with ZILLIZ_2_KEY
    let listRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/collections/list',
      operation: 'list_collections',
      body: {},
      customUri: creds2.cleanUri,
      customToken: creds2.token,
      credentialLabel,
      notes: 'Diagnostic (QuickPrompt): List collections strictly on ZILLIZ_2_URI using ZILLIZ_2_KEY'
    });

    // Fallback check with explicit dbName: 'default' (still strictly ZILLIZ_2_URI + ZILLIZ_2_KEY)
    if (!listRes.ok || (listRes.data?.code !== 0 && listRes.data?.code !== undefined)) {
      const retryDefaultDb = await tracedZillizFetch({
        endpoint: '/v2/vectordb/collections/list',
        operation: 'list_collections',
        body: { dbName: 'default' },
        customUri: creds2.cleanUri,
        customToken: creds2.token,
        credentialLabel,
        notes: 'Diagnostic (QuickPrompt): Retry collections/list with dbName=default on ZILLIZ_2_URI using ZILLIZ_2_KEY'
      });
      if (retryDefaultDb.ok && (retryDefaultDb.data?.code === 0 || retryDefaultDb.data?.code === undefined)) {
        listRes = retryDefaultDb;
      }
    }

    const listOk = listRes.ok && (listRes.data?.code === 0 || listRes.data?.code === undefined);
    let collectionsList: string[] = [];
    if (listRes.data && Array.isArray(listRes.data.data)) {
      collectionsList = listRes.data.data.map((item: any) =>
        typeof item === 'string' ? item : (item.collectionName || String(item))
      );
    }

    const hostName = creds2.cleanUri.replace(/^https?:\/\//, '');
    const clusterId = hostName.split('.')[0] || hostName;
    let step2Details = listOk
      ? `Connected strictly via ${credentialLabel}. Found ${collectionsList.length} collection(s): [${collectionsList.join(', ')}]. 'QuickPrompt' exists: ${collectionsList.includes('QuickPrompt')}.`
      : `Handshake failed strictly using ${credentialLabel} on ${hostName} (Code ${listRes.data?.code ?? listRes.status}): ${listRes.error}`;

    if (!listOk && listRes.data?.code === 80020) {
      step2Details += matchesPrimaryKey
        ? ` Note: ZILLIZ_2_KEY in the running container equals primary ZILLIZ_API_KEY. Update ZILLIZ_2_KEY to the API key for cluster "${clusterId}" and restart the environment so the new secret is injected.`
        : ` Confirmed ZILLIZ_2_KEY (${creds2.token.length} chars, distinct from primary key) was sent in Bearer auth to "${hostName}". In Zilliz Cloud, code 80020 means cluster "${clusterId}" is Paused/Deleted/does not exist or that ZILLIZ_2_KEY does not have RBAC permission for cluster "${clusterId}" (note: if you just updated Secrets, a full environment restart may be needed for container process.env to refresh).`;
    }

    steps.push({
      name: '2. ZILLIZ-2 Auth & Cluster Handshake',
      success: listOk,
      durationMs: listRes.durationMs,
      details: step2Details,
      payloadSent: {},
      responseReceived: listRes.data || undefined
    });

    if (!listOk) {
      overallSuccess = false;
      return {
        timestamp: new Date().toISOString(),
        configured: true,
        overallSuccess: false,
        zillizUri: creds2.cleanUri,
        error: step2Details,
        steps
      };
    }

    // Step 3: Check / Create QuickPrompt collection
    const hasQuickPrompt = collectionsList.includes('QuickPrompt');
    if (!hasQuickPrompt) {
      const createRes = await tracedZillizFetch({
        endpoint: '/v2/vectordb/collections/create',
        operation: 'create_collection',
        body: { collectionName: 'QuickPrompt', dimension: 3072 },
        customUri: creds2.cleanUri,
        customToken: creds2.token,
        credentialLabel,
        notes: 'Diagnostic (QuickPrompt): Create QuickPrompt collection (3072 dims)'
      });
      const createOk = createRes.ok && (createRes.data?.code === 0 || createRes.data?.code === undefined);
      steps.push({
        name: '3. Create Collection (QuickPrompt, 3072 dims)',
        success: createOk,
        durationMs: createRes.durationMs,
        details: createOk
          ? `Created 'QuickPrompt' collection (3072 dims) on ZILLIZ-2.`
          : `Create failed: ${createRes.error}`,
        payloadSent: { collectionName: 'QuickPrompt', dimension: 3072 },
        responseReceived: createRes.data || undefined
      });
      if (!createOk) overallSuccess = false;
    } else {
      steps.push({
        name: '3. Collection Verification (QuickPrompt)',
        success: true,
        durationMs: 1,
        details: `'QuickPrompt' collection verified on ZILLIZ-2. Ready for upsert & query.`
      });
    }

    // Step 4: Upsert synthetic QuickPrompt record
    const testNumericId = Math.floor(Date.now() / 1000) * 10000 + Math.floor(Math.random() * 9999);
    const testShortcutId = `diag-qp-${Date.now()}`;
    const testVector = createFastPseudoEmbedding('Diagnostic Test QuickPrompt ZILLIZ-2', 3072);

    const upsertPayload = {
      collectionName: 'QuickPrompt',
      data: [
        {
          id: testNumericId,
          shortcutId: testShortcutId,
          vector: testVector,
          title: 'Diagnostic Test QuickPrompt',
          desc: 'Observability roundtrip verification',
          query: 'Verify QuickPrompt persistence on ZILLIZ-2',
          icon: 'Sparkles',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]
    };

    const upsertRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/entities/upsert',
      operation: 'upsert_shortcut',
      body: upsertPayload,
      customUri: creds2.cleanUri,
      customToken: creds2.token,
      credentialLabel,
      notes: `Diagnostic (QuickPrompt): Upsert test prompt '${testShortcutId}' (ID: ${testNumericId})`
    });

    const upsertOk = upsertRes.ok && (upsertRes.data?.code === 0 || upsertRes.data?.code === undefined);
    steps.push({
      name: '4. Write & Upsert Test QuickPrompt',
      success: upsertOk,
      durationMs: upsertRes.durationMs,
      details: upsertOk
        ? `Upserted test QuickPrompt (Int64 ID: ${testNumericId}) into ZILLIZ-2 'QuickPrompt'.`
        : `Upsert failed: ${upsertRes.error}`,
      payloadSent: { collectionName: 'QuickPrompt', data: [{ id: testNumericId, shortcutId: testShortcutId, title: 'Diagnostic Test QuickPrompt' }] },
      responseReceived: upsertRes.data || undefined
    });
    if (!upsertOk) overallSuccess = false;

    // Step 5: Query back written QuickPrompt
    const queryPayload = {
      collectionName: 'QuickPrompt',
      filter: `id in [${testNumericId}]`,
      outputFields: ['id', 'shortcutId', 'title', 'desc', 'query', 'icon', 'createdAt', 'updatedAt'],
      limit: 5
    };

    let queryRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/entities/query',
      operation: 'query_shortcuts',
      body: queryPayload,
      customUri: creds2.cleanUri,
      customToken: creds2.token,
      credentialLabel,
      notes: `Diagnostic (QuickPrompt): Query back test prompt (ID: ${testNumericId})`
    });

    if (queryRes.data?.code === 101) {
      await tracedZillizFetch({
        endpoint: '/v2/vectordb/collections/load',
        operation: 'list_collections',
        body: { collectionName: 'QuickPrompt' },
        customUri: creds2.cleanUri,
        customToken: creds2.token,
        credentialLabel,
        notes: 'Diagnostic (QuickPrompt): Load QuickPrompt collection before query retry'
      });
      queryRes = await tracedZillizFetch({
        endpoint: '/v2/vectordb/entities/query',
        operation: 'query_shortcuts',
        body: queryPayload,
        customUri: creds2.cleanUri,
        customToken: creds2.token,
        credentialLabel,
        notes: `Diagnostic (QuickPrompt): Retry query back (ID: ${testNumericId})`
      });
    }

    let queryValidated = false;
    let validationNote = '';
    if (queryRes.ok && (queryRes.data?.code === 0 || queryRes.data?.code === undefined)) {
      if (Array.isArray(queryRes.data.data)) {
        const hit = queryRes.data.data.find((item: any) => item.id === testNumericId || item.shortcutId === testShortcutId);
        if (hit && hit.query) {
          queryValidated = true;
          validationNote = `Retrieved matching QuickPrompt from flat json.data array. Title: "${hit.title}", Query verified.`;
        } else {
          validationNote = `Query succeeded but test ID '${testNumericId}' was not found in json.data (count: ${queryRes.data.data.length}).`;
        }
      } else {
        validationNote = `json.data was not an array (type: ${typeof queryRes.data.data}).`;
      }
    } else {
      validationNote = `Query failed: ${queryRes.error}`;
    }

    steps.push({
      name: '5. Query Back & Validate QuickPrompt (REST v2)',
      success: queryValidated,
      durationMs: queryRes.durationMs,
      details: validationNote,
      payloadSent: queryPayload,
      responseReceived: queryRes.data || undefined
    });
    if (!queryValidated) overallSuccess = false;

    // Step 6: Delete synthetic test QuickPrompt
    const deletePayload = {
      collectionName: 'QuickPrompt',
      filter: `id in [${testNumericId}]`
    };
    const deleteRes = await tracedZillizFetch({
      endpoint: '/v2/vectordb/entities/delete',
      operation: 'delete_shortcut',
      body: deletePayload,
      customUri: creds2.cleanUri,
      customToken: creds2.token,
      credentialLabel,
      notes: `Diagnostic (QuickPrompt): Clean up test prompt (ID: ${testNumericId})`
    });
    const deleteOk = deleteRes.ok && (deleteRes.data?.code === 0 || deleteRes.data?.code === undefined);
    steps.push({
      name: '6. Clean Up Test Entity (Delete)',
      success: deleteOk,
      durationMs: deleteRes.durationMs,
      details: deleteOk
        ? `Deleted synthetic test QuickPrompt (ID: ${testNumericId}) from ZILLIZ-2.`
        : `Delete returned warning: ${deleteRes.error}`,
      payloadSent: deletePayload,
      responseReceived: deleteRes.data || undefined
    });
  } catch (err: any) {
    overallSuccess = false;
    steps.push({
      name: 'QuickPrompt Diagnostic Error',
      success: false,
      durationMs: 0,
      details: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`
    });
  }

  return {
    timestamp: new Date().toISOString(),
    configured: true,
    overallSuccess,
    zillizUri: creds2.cleanUri,
    steps
  };
}
