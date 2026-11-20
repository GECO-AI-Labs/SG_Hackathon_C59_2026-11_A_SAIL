/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * test_databricks_trace.ts
 * Standalone Node.js / TypeScript Test Script for Databricks MLflow Tracing.
 * 
 * Can be run from CLI:
 *   npx tsx server/test_databricks_trace.ts
 * 
 * Or imported and executed programmatically by the server API:
 *   POST /api/traces/test-sync
 */

import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

export interface StepLog {
  step: string;
  name: string;
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  success: boolean;
  requestPayload?: unknown;
  responsePayload?: unknown;
  error?: string;
}

export interface DiagnosticResult {
  timestamp: string;
  configured: boolean;
  databricksHost: string;
  experimentName: string;
  traceId: string;
  databricksRequestId?: string;
  overallSuccess: boolean;
  activeStrategy?: string;
  logs: StepLog[];
}

export async function runDatabricksTraceDiagnostic(): Promise<DiagnosticResult> {
  const hostRaw = process.env.DATABRICKS_HOST?.trim() || '';
  const token = process.env.DATABRICKS_TOKEN?.trim() || '';
  const expRaw = process.env.MLFLOW_EXPERIMENT_NAME?.trim() || '/Users/gckwang03@gmail.com/SAIL_Traces';

  const traceId = randomUUID().replace(/-/g, '');
  const rootSpanId = randomUUID().replace(/-/g, '').substring(0, 16);
  const childSpanId = randomUUID().replace(/-/g, '').substring(0, 16);
  const now = Date.now();

  const logs: StepLog[] = [];
  let overallSuccess = false;
  let activeStrategy = 'None';
  let databricksRequestId: string | undefined = undefined;

  if (!hostRaw || !token) {
    return {
      timestamp: new Date().toISOString(),
      configured: false,
      databricksHost: hostRaw || 'Not Set',
      experimentName: expRaw,
      traceId,
      overallSuccess: false,
      logs: [{
        step: 'Step 0: Credentials Check',
        name: 'Environment Check',
        url: 'N/A',
        method: 'N/A',
        success: false,
        error: 'DATABRICKS_HOST or DATABRICKS_TOKEN is missing in environment variables (.env).'
      }]
    };
  }

  let host = hostRaw.startsWith('http') ? hostRaw : `https://${hostRaw}`;
  host = host.replace(/\/+$/, '');
  const cleanExpName = expRaw.replace(/\/+$/, '');

  let experimentId: string | number = '';

  // STEP 1: Resolve experiment_name into numeric experiment_id
  const expUrl = `${host}/api/2.0/mlflow/experiments/get-by-name?experiment_name=${encodeURIComponent(cleanExpName)}`;
  try {
    const expRes = await fetch(expUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    const expBody = await expRes.json().catch(() => null);

    if (expRes.ok && expBody?.experiment?.experiment_id) {
      experimentId = expBody.experiment.experiment_id;
      logs.push({
        step: 'Step 1: Resolve Experiment ID',
        name: 'GET get-by-name',
        url: expUrl,
        method: 'GET',
        status: expRes.status,
        statusText: expRes.statusText,
        success: true,
        responsePayload: expBody
      });
    } else {
      logs.push({
        step: 'Step 1: Resolve Experiment ID',
        name: 'GET get-by-name',
        url: expUrl,
        method: 'GET',
        status: expRes.status,
        statusText: expRes.statusText,
        success: false,
        responsePayload: expBody,
        error: `HTTP ${expRes.status}: Failed to resolve experiment_id for "${cleanExpName}"`
      });
      return { timestamp: new Date().toISOString(), configured: true, databricksHost: host, experimentName: cleanExpName, traceId, overallSuccess: false, logs };
    }
  } catch (e: any) {
    logs.push({
      step: 'Step 1: Resolve Experiment ID',
      name: 'GET get-by-name',
      url: expUrl,
      method: 'GET',
      success: false,
      error: `Network Exception: ${e.message}`
    });
    return { timestamp: new Date().toISOString(), configured: true, databricksHost: host, experimentName: cleanExpName, traceId, overallSuccess: false, logs };
  }

  // STEP 2: StartTrace (POST /api/2.0/mlflow/traces)
  const startUrl = `${host}/api/2.0/mlflow/traces`;
  const startPayload = {
    experiment_id: String(experimentId),
    timestamp_ms: now,
    request_metadata: [
      { key: "mlflow.traceInputs", value: JSON.stringify({ user_prompt: "Diagnostic Test Prompt for Databricks MLflow" }) },
      { key: "mlflow.traceOutputs", value: JSON.stringify({ llm_response: "Diagnostic Test Response - SUCCESS" }) }
    ],
    tags: [
      { key: "mlflow.traceName", value: "SAIL_Workflow_Diagnostic" },
      { key: "session_id", value: "diag-session-001" }
    ]
  };

  let traceInfoTagLocation = '';

  try {
    const startRes = await fetch(startUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(startPayload)
    });
    const startBody = await startRes.json().catch(() => null);

    if (startRes.ok && (startBody?.trace_info?.request_id || startBody?.request_id)) {
      const info = startBody.trace_info || startBody;
      databricksRequestId = info.request_id;
      const tags = info.tags || [];
      const locTag = tags.find((t: any) => t.key === "mlflow.artifactLocation");
      if (locTag) traceInfoTagLocation = locTag.value || '';

      logs.push({
        step: 'Step 2: StartTrace RPC',
        name: 'POST /api/2.0/mlflow/traces',
        url: startUrl,
        method: 'POST',
        status: startRes.status,
        statusText: startRes.statusText,
        success: true,
        requestPayload: startPayload,
        responsePayload: startBody
      });
    } else {
      logs.push({
        step: 'Step 2: StartTrace RPC',
        name: 'POST /api/2.0/mlflow/traces',
        url: startUrl,
        method: 'POST',
        status: startRes.status,
        statusText: startRes.statusText,
        success: false,
        requestPayload: startPayload,
        responsePayload: startBody,
        error: `HTTP ${startRes.status}: StartTrace failed.`
      });
      return { timestamp: new Date().toISOString(), configured: true, databricksHost: host, experimentName: cleanExpName, traceId, overallSuccess: false, logs };
    }
  } catch (e: any) {
    logs.push({
      step: 'Step 2: StartTrace RPC',
      name: 'POST /api/2.0/mlflow/traces',
      url: startUrl,
      method: 'POST',
      success: false,
      error: `Network Exception: ${e.message}`
    });
    return { timestamp: new Date().toISOString(), configured: true, databricksHost: host, experimentName: cleanExpName, traceId, overallSuccess: false, logs };
  }

  // Build test traces.json payload
  const reqId = databricksRequestId || traceId;
  const testSpans = [
    {
      name: "SAIL_Workflow",
      context: { trace_id: traceId, span_id: rootSpanId },
      parent_id: null,
      start_time: Math.floor(now) * 1000000,
      end_time: Math.floor(now + 250) * 1000000,
      status_code: "OK",
      status_message: "",
      attributes: {
        "mlflow.traceRequestId": JSON.stringify(reqId),
        "mlflow.spanType": JSON.stringify("CHAIN"),
        "mlflow.spanInputs": JSON.stringify({ user_prompt: "Diagnostic Test Prompt" }),
        "mlflow.spanOutputs": JSON.stringify({ llm_response: "Diagnostic Output OK" })
      },
      events: []
    },
    {
      name: "News_Retriever",
      context: { trace_id: traceId, span_id: childSpanId },
      parent_id: rootSpanId,
      start_time: Math.floor(now + 10) * 1000000,
      end_time: Math.floor(now + 120) * 1000000,
      status_code: "OK",
      status_message: "",
      attributes: {
        "mlflow.traceRequestId": JSON.stringify(reqId),
        "mlflow.spanType": JSON.stringify("RETRIEVER"),
        "mlflow.spanInputs": JSON.stringify({ collection: "News_Collection" }),
        "mlflow.spanOutputs": JSON.stringify({ retrieved_count: 5 })
      },
      events: []
    }
  ];

  const traceJsonPayload = JSON.stringify({
    request: JSON.stringify({ user_prompt: "Diagnostic Test Prompt" }),
    response: JSON.stringify({ llm_response: "Diagnostic Output OK" }),
    spans: testSpans
  });

  let artifactUploaded = false;

  // STEP 3: Presigned URL Credentials API (/credentials-for-data-upload)
  const credUrl = `${host}/api/2.0/mlflow/traces/${encodeURIComponent(reqId)}/credentials-for-data-upload`;
  try {
    const credRes = await fetch(credUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    const credBody = await credRes.json().catch(() => null);

    if (credRes.ok) {
      const uploadUrl = credBody?.credential_info?.signed_uri || 
                        credBody?.signed_uri ||
                        (credBody?.credential_info?.signed_uris && credBody?.credential_info?.signed_uris[0]);
      const headersList = credBody?.credential_info?.headers || credBody?.headers || [];
      const extraHeaders: Record<string, string> = {};
      for (const h of headersList) {
        if (h.name && h.value) extraHeaders[h.name] = h.value;
      }

      if (uploadUrl) {
        const s3Res = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...extraHeaders
          },
          body: traceJsonPayload
        });

        if (s3Res.ok) {
          artifactUploaded = true;
          activeStrategy = 'Presigned URL (/credentials-for-data-upload)';
          logs.push({
            step: 'Step 3: Presigned URL Upload',
            name: 'PUT signed_uri',
            url: uploadUrl.slice(0, 80) + '...',
            method: 'PUT',
            status: s3Res.status,
            statusText: s3Res.statusText,
            success: true,
            responsePayload: 'Uploaded successfully via presigned URI'
          });
        } else {
          const s3Err = await s3Res.text();
          logs.push({
            step: 'Step 3: Presigned URL Upload',
            name: 'PUT signed_uri',
            url: uploadUrl.slice(0, 80) + '...',
            method: 'PUT',
            status: s3Res.status,
            statusText: s3Res.statusText,
            success: false,
            error: `Presigned PUT HTTP ${s3Res.status}: ${s3Err.slice(0, 200)}`
          });
        }
      } else {
        logs.push({
          step: 'Step 3: Presigned URL Credentials',
          name: 'GET credentials-for-data-upload',
          url: credUrl,
          method: 'GET',
          status: credRes.status,
          success: false,
          responsePayload: credBody,
          error: 'Credentials API returned 200 but signed_uri was missing.'
        });
      }
    } else {
      logs.push({
        step: 'Step 3: Presigned URL Credentials',
        name: 'GET credentials-for-data-upload',
        url: credUrl,
        method: 'GET',
        status: credRes.status,
        statusText: credRes.statusText,
        success: false,
        responsePayload: credBody,
        error: `Credentials API HTTP ${credRes.status}`
      });
    }
  } catch (e: any) {
    logs.push({
      step: 'Step 3: Presigned URL Credentials',
      name: 'GET credentials-for-data-upload',
      url: credUrl,
      method: 'GET',
      success: false,
      error: `Network Exception: ${e.message}`
    });
  }

  // STEP 4: EndTrace (PATCH /api/2.0/mlflow/traces/{request_id})
  const endUrl = `${host}/api/2.0/mlflow/traces/${encodeURIComponent(reqId)}`;
  const endPayload = {
    request_id: reqId,
    timestamp_ms: now + 250,
    status: 'OK'
  };

  try {
    const endRes = await fetch(endUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(endPayload)
    });
    const endBody = await endRes.json().catch(() => null);

    if (endRes.ok) {
      overallSuccess = artifactUploaded;
      logs.push({
        step: 'Step 4: EndTrace PATCH',
        name: 'PATCH /api/2.0/mlflow/traces/{req_id}',
        url: endUrl,
        method: 'PATCH',
        status: endRes.status,
        statusText: endRes.statusText,
        success: true,
        requestPayload: endPayload,
        responsePayload: endBody
      });
    } else {
      logs.push({
        step: 'Step 4: EndTrace PATCH',
        name: 'PATCH /api/2.0/mlflow/traces/{req_id}',
        url: endUrl,
        method: 'PATCH',
        status: endRes.status,
        statusText: endRes.statusText,
        success: false,
        requestPayload: endPayload,
        responsePayload: endBody,
        error: `EndTrace HTTP ${endRes.status}`
      });
    }
  } catch (e: any) {
    logs.push({
      step: 'Step 4: EndTrace PATCH',
      name: 'PATCH /api/2.0/mlflow/traces/{req_id}',
      url: endUrl,
      method: 'PATCH',
      success: false,
      error: `EndTrace Exception: ${e.message}`
    });
  }

  return {
    timestamp: new Date().toISOString(),
    configured: true,
    databricksHost: host,
    experimentName: cleanExpName,
    traceId,
    databricksRequestId: reqId,
    overallSuccess,
    activeStrategy,
    logs
  };
}

// Allow CLI execution if executed directly with `npx tsx`
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("=== Databricks MLflow Trace Standalone Diagnostic Test ===");
  runDatabricksTraceDiagnostic().then((res) => {
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.overallSuccess ? 0 : 1);
  }).catch((err) => {
    console.error("Diagnostic execution error:", err);
    process.exit(1);
  });
}
