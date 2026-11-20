/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * mlflow_tracer.ts
 * Enterprise MLflow Tracing and Telemetry Engine.
 * Faithfully mirrors the Python MLflow Tracing implementation in SAIL.py:
 * - mlflow.start_span(name="SAIL_Workflow", span_type="CHAIN")
 * - @mlflow.trace(span_type="RETRIEVER") for News, AIS, Seaport, Filling
 * - Span attributes: session_id, user_prompt, zilliz_retrievals, llm_input_prompt
 * - Span outputs: llm_response, confidence rating
 * - Databricks & MLflow Remote Tracking Server Sync
 */

import { randomUUID } from 'crypto';

export interface MLflowSpan {
  spanId: string;
  name: string;
  spanType: 'CHAIN' | 'RETRIEVER' | 'LLM' | 'AGENT' | 'EMBEDDING';
  startTimeMs: number;
  endTimeMs?: number;
  durationMs?: number;
  status: 'OK' | 'ERROR' | 'RUNNING';
  attributes?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}

export interface MLflowTrace {
  traceId: string;
  sessionId: string;
  timestamp: string;
  experimentName: string;
  rootSpanName: string;
  status: 'SUCCESS' | 'ERROR' | 'IN_PROGRESS';
  spans: MLflowSpan[];
  inputs: {
    user_prompt: string;
    search_topics?: string[];
    zilliz_retrievals?: {
      News_Collection: string[];
      AIS_Collection: string[];
      Seaport_Collection: string[];
      Filling_Collection: string[];
    };
    llm_input_prompt?: string;
  };
  outputs: {
    llm_response?: string;
    confidence_score?: string | number;
  };
  metrics: {
    totalDurationMs: number;
    retrievalDurationMs: number;
    llmDurationMs: number;
    retrievedDocsCount: number;
  };
  databricksSync: {
    synced: boolean;
    host?: string;
    statusText: string;
    timestamp?: string;
    spansDump?: Array<Record<string, unknown>>;
  };
}

// In-memory trace buffer (retains last 50 traces)
const traceStore: MLflowTrace[] = [];

/**
 * Creates and starts a new SAIL MLflow trace session
 */
export function startSailWorkflowSpan(sessionId: string, userPrompt: string): MLflowTrace {
  const traceId = randomUUID().replace(/-/g, ''); // 32 hex chars for OTel trace_id
  const rootSpanId = randomUUID().replace(/-/g, '').substring(0, 16); // 16 hex chars for OTel span_id
  const now = Date.now();
  
  const experiment = process.env.MLFLOW_EXPERIMENT_NAME || "/Users/gckwang03@gmail.com/SAIL_Traces";
  const databricksHost = process.env.DATABRICKS_HOST?.trim() || "";

  const rootSpan: MLflowSpan = {
    spanId: rootSpanId,
    name: "SAIL_Workflow",
    spanType: "CHAIN",
    startTimeMs: now,
    status: "RUNNING",
    attributes: {
      session_id: sessionId,
      agent_scope: "Southeast Asian and intra-Asian shipping lanes",
      framework: "SAIL Agentic RAG"
    },
    inputs: {
      user_prompt: userPrompt
    }
  };

  const newTrace: MLflowTrace = {
    traceId,
    sessionId,
    timestamp: new Date().toISOString(),
    experimentName: experiment,
    rootSpanName: "SAIL_Workflow",
    status: "IN_PROGRESS",
    spans: [rootSpan],
    inputs: {
      user_prompt: userPrompt
    },
    outputs: {},
    metrics: {
      totalDurationMs: 0,
      retrievalDurationMs: 0,
      llmDurationMs: 0,
      retrievedDocsCount: 0
    },
    databricksSync: {
      synced: false,
      host: databricksHost ? databricksHost.replace(/https?:\/\//, '').split('/')[0] : undefined,
      statusText: databricksHost ? "Ready to sync with Databricks" : "Buffered locally in MLflow Tracing UI"
    }
  };

  traceStore.unshift(newTrace);
  if (traceStore.length > 50) traceStore.pop();

  return newTrace;
}

/**
 * Adds an individual span (e.g. Planning, Retriever, LLM) to a trace
 */
export function addSpanToTrace(
  traceId: string,
  name: string,
  spanType: MLflowSpan['spanType'],
  startTimeMs: number,
  endTimeMs: number,
  status: 'OK' | 'ERROR' = 'OK',
  inputs?: Record<string, unknown>,
  outputs?: Record<string, unknown>,
  attributes?: Record<string, unknown>
): void {
  const trace = traceStore.find(t => t.traceId === traceId);
  if (!trace) return;

  const span: MLflowSpan = {
    spanId: randomUUID().replace(/-/g, '').substring(0, 16), // 16 hex chars
    name,
    spanType,
    startTimeMs,
    endTimeMs,
    durationMs: endTimeMs - startTimeMs,
    status,
    inputs,
    outputs,
    attributes
  };

  trace.spans.push(span);
}

/**
 * Helper to build a dump of trace logs sent for each span in MLflow format.
 * Transforms our internal span representation into the strict OpenTelemetry-like 
 * schema expected by the Databricks MLflow `traces.json` parser.
 * 
 * @param trace - The full trace object containing all recorded spans
 * @param databricksRequestId - The Databricks-generated trace ID (required for parent linking)
 * @returns Array of formatted span objects ready for JSON serialization
 */
export function buildSpansDump(trace: MLflowTrace, databricksRequestId?: string): Array<Record<string, unknown>> {
  const rootSpan = trace.spans.find(s => s.name === "SAIL_Workflow");
  const rootSpanId = rootSpan ? rootSpan.spanId : (trace.spans[0]?.spanId || trace.traceId);
  const reqId = databricksRequestId || trace.traceId;
  const now = Date.now();

  return trace.spans.map(s => {
    // Clone inputs to avoid mutating the original trace state
    const cleanInputs = { ...(s.inputs || {}) };
    
    // Strip massive vector arrays to prevent traces.json payload bloat
    if ('query_vector' in cleanInputs && Array.isArray(cleanInputs.query_vector)) {
      cleanInputs.query_vector = `[FloatVector: ${cleanInputs.query_vector.length} dims]`;
    }

    // Databricks MLflow strictly requires all attribute values in traces.json 
    // to be JSON-stringified strings. Nested objects will cause parsing failures.
    const serializedAttributes: Record<string, string> = {
      "mlflow.traceRequestId": JSON.stringify(reqId),
      "mlflow.spanType": JSON.stringify(s.spanType),
      "mlflow.spanInputs": JSON.stringify(cleanInputs),
      "mlflow.spanOutputs": JSON.stringify(s.outputs || {})
    };

    // Append any custom attributes added during span execution
    if (s.attributes) {
      for (const [k, v] of Object.entries(s.attributes)) {
        serializedAttributes[k] = JSON.stringify(v);
      }
    }

    return {
      name: s.name,
      context: {
        trace_id: trace.traceId,
        span_id: s.spanId
      },
      // Root span must have a null parent_id according to MLflow spec
      parent_id: s.name === "SAIL_Workflow" ? null : rootSpanId,
      // Convert milliseconds to nanoseconds. Note: Math.floor(ms) * 1000000 
      // loses exact nanosecond precision in JS, but Databricks accepts it natively.
      start_time: Math.floor(s.startTimeMs) * 1000000,
      end_time: Math.floor(s.endTimeMs || now) * 1000000,
      status_code: s.status === 'ERROR' ? 'ERROR' : 'OK',
      status_message: "",
      attributes: serializedAttributes,
      events: []
    };
  });
}

/**
 * Closes the SAIL Workflow trace and dispatches it to the Databricks MLflow backend.
 * Replicates the Python SDK's undocumented 4-step REST API sequence.
 * 
 * @param traceId - The internal trace ID to finish
 * @param data - The final payload containing prompts, responses, and metrics
 * @returns The updated trace object with Databricks sync status
 */
export async function finishSailWorkflowTrace(
  traceId: string,
  data: {
    searchTopics?: string[];
    zillizRetrievals?: {
      News_Collection: string[];
      AIS_Collection: string[];
      Seaport_Collection: string[];
      Filling_Collection: string[];
    };
    llmInputPrompt?: string;
    llmResponse?: string;
    confidenceScore?: string | number;
    retrievalDurationMs?: number;
    llmDurationMs?: number;
    status?: 'SUCCESS' | 'ERROR';
    [key: string]: any;
  }
): Promise<MLflowTrace | undefined> {
  const trace = traceStore.find(t => t.traceId === traceId);
  if (!trace) return undefined;

  const now = Date.now();
  const rootSpan = trace.spans.find(s => s.name === "SAIL_Workflow");
  
  // Finalize local span data
  if (rootSpan) {
    rootSpan.endTimeMs = now;
    rootSpan.durationMs = now - rootSpan.startTimeMs;
    rootSpan.status = data.status === 'ERROR' ? 'ERROR' : 'OK';
    rootSpan.inputs = { 
      user_prompt: trace.inputs.user_prompt, 
      zilliz_retrievals: data.zillizRetrievals, 
      llm_input_prompt: data.llmInputPrompt 
    };
    rootSpan.outputs = { 
      llm_response: data.llmResponse, 
      confidence_score: data.confidenceScore 
    };
  }

  trace.status = data.status || 'SUCCESS';
  if (data.searchTopics) trace.inputs.search_topics = data.searchTopics;
  if (data.zillizRetrievals) trace.inputs.zilliz_retrievals = data.zillizRetrievals;
  if (data.llmInputPrompt) trace.inputs.llm_input_prompt = data.llmInputPrompt;
  trace.outputs.llm_response = data.llmResponse;
  trace.outputs.confidence_score = data.confidenceScore;

  if (data.zillizRetrievals) {
    const totalDocs = 
      (data.zillizRetrievals.News_Collection?.length || 0) +
      (data.zillizRetrievals.AIS_Collection?.length || 0) +
      (data.zillizRetrievals.Seaport_Collection?.length || 0) +
      (data.zillizRetrievals.Filling_Collection?.length || 0);

    trace.metrics = {
      totalDurationMs: rootSpan ? (rootSpan.durationMs || (now - rootSpan.startTimeMs)) : 0,
      retrievalDurationMs: data.retrievalDurationMs || 0,
      llmDurationMs: data.llmDurationMs || 0,
      retrievedDocsCount: totalDocs
    };
  }

  const databricksHost = process.env.DATABRICKS_HOST?.trim();
  const databricksToken = process.env.DATABRICKS_TOKEN?.trim();

  // Abort remote sync if credentials are missing
  if (!databricksHost || !databricksToken) {
    trace.databricksSync = { 
      synced: false, 
      statusText: "Buffered locally", 
      timestamp: new Date().toISOString(),
      spansDump: buildSpansDump(trace, trace.traceId)
    };
    return trace;
  }

  try {
    // Sanitize host URL
    let host = databricksHost.startsWith('http') ? databricksHost : `https://${databricksHost}`;
    host = host.replace(/\/+$/, '');
    const cleanExpName = trace.experimentName.replace(/\/+$/, '');

    // STEP 1: Get numeric Experiment ID required by the traces API
    const expRes = await fetch(`${host}/api/2.0/mlflow/experiments/get-by-name?experiment_name=${encodeURIComponent(cleanExpName)}`, {
      headers: { Authorization: `Bearer ${databricksToken}` }
    });
    if (!expRes.ok) throw new Error(`Exp API Error: ${expRes.status}`);
    const experimentId = (await expRes.json()).experiment.experiment_id;

    const startTimeMs = Math.floor(trace.spans[0]?.startTimeMs || now);
    
    // STEP 2: StartTrace 
    // request_metadata creates the preview in the Databricks UI table.
    // It strictly enforces a 250 character limit per value. We slice safely 
    // at 245 chars to ensure we don't exceed the boundary.
    const startRes = await fetch(`${host}/api/2.0/mlflow/traces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${databricksToken}` },
      body: JSON.stringify({
        experiment_id: String(experimentId),
        timestamp_ms: startTimeMs,
        request_metadata: [
          { key: "mlflow.traceInputs", value: JSON.stringify({ user_prompt: trace.inputs.user_prompt || "" }).slice(0, 245) },
          { key: "mlflow.traceOutputs", value: JSON.stringify({ llm_response: trace.outputs.llm_response || "" }).slice(0, 245) }
        ],
        tags: [
          { key: "mlflow.traceName", value: "SAIL_Workflow" },
          { key: "session_id", value: trace.sessionId }
        ]
      })
    });
    if (!startRes.ok) throw new Error(`StartTrace Error: ${startRes.status}`);
    const databricksRequestId = (await startRes.json()).trace_info.request_id;

    const formattedSpans = buildSpansDump(trace, databricksRequestId);

    // STEP 3: Upload full traces.json payload to Databricks Cloud Storage
    // This holds the actual untruncated span tree data.
    const traceJsonPayload = JSON.stringify({
      request: JSON.stringify(trace.inputs),
      response: JSON.stringify(trace.outputs),
      spans: formattedSpans
    });

    let artifactUploaded = false;
    let uploadDiag = "Upload failed";

    // Request a presigned cloud storage URL (S3/Azure Blob) for direct artifact upload
    const credRes = await fetch(`${host}/api/2.0/mlflow/traces/${encodeURIComponent(databricksRequestId)}/credentials-for-data-upload`, {
      headers: { Authorization: `Bearer ${databricksToken}` }
    });

    if (credRes.ok) {
      const credData = await credRes.json();
      // Handle different Databricks cloud backends (AWS vs Azure)
      const uploadUrl = credData.credential_info?.signed_uri || credData.signed_uri || (credData.credential_info?.signed_uris && credData.credential_info.signed_uris[0]);
      
      if (uploadUrl) {
        const s3Res = await fetch(uploadUrl, { 
          method: 'PUT', 
          headers: { 'Content-Type': 'application/json' }, 
          body: traceJsonPayload 
        });
        artifactUploaded = s3Res.ok;
        uploadDiag = s3Res.ok ? "Uploaded successfully" : `Cloud PUT Error: ${s3Res.status}`;
      } else {
        uploadDiag = "No signed_uri returned in credentials payload";
      }
    } else {
      uploadDiag = `Cred API Error: ${credRes.status}`;
    }

    // STEP 4: EndTrace
    // CRITICAL: We MUST NOT send `request_metadata` in the PATCH request. 
    // Databricks treats it as immutable and will return HTTP 400 if we try to update it.
    const endRes = await fetch(`${host}/api/2.0/mlflow/traces/${encodeURIComponent(databricksRequestId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${databricksToken}` },
      body: JSON.stringify({ 
        request_id: databricksRequestId, 
        timestamp_ms: Date.now(), 
        status: trace.status === 'SUCCESS' ? 'OK' : 'ERROR' 
      })
    });

    trace.databricksSync = {
      synced: artifactUploaded,
      host: host.split('//')[1],
      statusText: endRes.ok ? `Synced (${uploadDiag})` : `EndTrace Error: ${endRes.status} (${uploadDiag})`,
      timestamp: new Date().toISOString(),
      spansDump: formattedSpans
    };

  } catch (e: any) {
    trace.databricksSync = { 
      synced: false, 
      statusText: `Sync Error: ${e.message}`, 
      timestamp: new Date().toISOString(),
      spansDump: buildSpansDump(trace, trace.traceId)
    };
  }

  return trace;
}

/**
 * Returns all active traces in memory
 */
export function getRecentTraces(): MLflowTrace[] {
  return traceStore;
}

/**
 * Returns a specific trace by ID
 */
export function getTraceById(traceId: string): MLflowTrace | undefined {
  return traceStore.find(t => t.traceId === traceId);
}

/**
 * Returns current MLflow tracking status
 */
export function getMLflowStatus() {
  const host = process.env.DATABRICKS_HOST?.trim();
  const token = process.env.DATABRICKS_TOKEN?.trim();
  const experiment = process.env.MLFLOW_EXPERIMENT_NAME || "/Users/gckwang03@gmail.com/SAIL_Traces";

  return {
    isConfigured: Boolean(host && token),
    trackingUri: host ? "databricks" : "local-inspector",
    experimentName: experiment,
    databricksHost: host ? host.replace(/https?:\/\//, '').split('/')[0] : "Local In-Memory MLflow Traces",
    totalRecordedTraces: traceStore.length,
    activeSpansCount: traceStore.reduce((acc, t) => acc + t.spans.length, 0)
  };
}
