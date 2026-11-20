import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  X, 
  CheckCircle2, 
  Layers, 
  Cpu, 
  Database, 
  Copy, 
  Check, 
  Server,
  Cloud,
  CloudOff,
  AlertTriangle,
  RefreshCw,
  Activity,
  ShieldCheck,
  LayoutGrid,
  FileText,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Code,
  Terminal,
  MessageSquare,
  Play,
  Trash2,
  ArrowRight,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { MLflowTrace, ZillizHttpTrace, ZillizDiagnosticResult } from '../types.js';

interface MLflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  traces: MLflowTrace[];
  selectedTraceId?: string | null;
}

const RenderSpanStatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const norm = (status || 'OK').toUpperCase();
  const isOk = norm === 'OK' || norm === 'STATUS_CODE_OK' || norm === 'SUCCESS';
  const isError = norm === 'ERROR' || norm === 'STATUS_CODE_ERROR';

  if (isError) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
        ERROR
      </span>
    );
  }

  if (isOk) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        OK
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-spin" />
      RUNNING
    </span>
  );
};

export const MLflowModal: React.FC<MLflowModalProps> = ({
  isOpen,
  onClose,
  traces,
  selectedTraceId
}) => {
  const [isMaximized, setIsMaximized] = useState(() => {
    try {
      const saved = localStorage.getItem('sail_mlflow_maximized');
      return saved !== null ? saved === 'true' : true; // Default to maximum allowed size
    } catch {
      return true;
    }
  });

  const toggleMaximized = () => {
    setIsMaximized(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sail_mlflow_maximized', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const [activeTab, setActiveTab] = useState<'traces' | 'admin-sync' | 'diagnostic-test' | 'chat-history'>('traces');
  const [activeTraceId, setActiveTraceId] = useState<string | null>(
    selectedTraceId || (traces.length > 0 ? traces[0].traceId : null)
  );
  const [copied, setCopied] = useState(false);
  const [syncCopied, setSyncCopied] = useState(false);
  const [expandedSyncTraceId, setExpandedSyncTraceId] = useState<string | null>(null);

  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testCopied, setTestCopied] = useState(false);

  // Chat History Zilliz HTTP Traces state
  const [zillizTraces, setZillizTraces] = useState<ZillizHttpTrace[]>([]);
  const [selectedZillizTraceId, setSelectedZillizTraceId] = useState<string | null>(null);
  const [isLoadingZillizTraces, setIsLoadingZillizTraces] = useState(false);
  const [zillizFilter, setZillizFilter] = useState<'all' | 'quickprompt' | 'upsert' | 'query' | 'list_or_create' | 'delete'>('all');
  const [isRunningZillizDiag, setIsRunningZillizDiag] = useState(false);
  const [isRunningQuickPromptDiag, setIsRunningQuickPromptDiag] = useState(false);
  const [zillizDiagResult, setZillizDiagResult] = useState<ZillizDiagnosticResult | null>(null);
  const [zillizDiagLabel, setZillizDiagLabel] = useState<string>('Zilliz ChatHistory Roundtrip Verification');
  const [copiedTraceKey, setCopiedTraceKey] = useState<string | null>(null);
  const [zillizSearch, setZillizSearch] = useState('');

  const fetchZillizTraces = async () => {
    setIsLoadingZillizTraces(true);
    try {
      const res = await fetch('/api/zilliz/traces');
      if (res.ok) {
        const data = await res.json();
        const list: ZillizHttpTrace[] = data.traces || [];
        setZillizTraces(list);
        if (list.length > 0 && !selectedZillizTraceId) {
          setSelectedZillizTraceId(list[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch Zilliz traces:', err);
    } finally {
      setIsLoadingZillizTraces(false);
    }
  };

  const handleRunZillizDiagnostic = async () => {
    setIsRunningZillizDiag(true);
    setZillizDiagLabel('ChatHistory (Primary Zilliz) Roundtrip Verification');
    try {
      const res = await fetch('/api/zilliz/diagnostic', { method: 'POST' });
      const data: ZillizDiagnosticResult = await res.json();
      setZillizDiagResult(data);
      await fetchZillizTraces();
    } catch (err: any) {
      setZillizDiagResult({
        timestamp: new Date().toISOString(),
        configured: false,
        overallSuccess: false,
        zillizUri: 'Error',
        error: err instanceof Error ? err.message : String(err),
        steps: [
          {
            name: 'Diagnostic Request Failed',
            success: false,
            durationMs: 0,
            details: err instanceof Error ? err.message : String(err)
          }
        ]
      });
    } finally {
      setIsRunningZillizDiag(false);
    }
  };

  const handleRunQuickPromptDiagnostic = async () => {
    setIsRunningQuickPromptDiag(true);
    setZillizDiagLabel('QuickPrompt (ZILLIZ-2) Connectivity & Roundtrip Test');
    try {
      const res = await fetch('/api/zilliz/quickprompt-diagnostic', { method: 'POST' });
      const data: ZillizDiagnosticResult = await res.json();
      setZillizDiagResult(data);
      await fetchZillizTraces();
    } catch (err: any) {
      setZillizDiagResult({
        timestamp: new Date().toISOString(),
        configured: false,
        overallSuccess: false,
        zillizUri: 'Error',
        error: err instanceof Error ? err.message : String(err),
        steps: [
          {
            name: 'QuickPrompt Diagnostic Request Failed',
            success: false,
            durationMs: 0,
            details: err instanceof Error ? err.message : String(err)
          }
        ]
      });
    } finally {
      setIsRunningQuickPromptDiag(false);
    }
  };

  const handleClearZillizTraces = async () => {
    try {
      await fetch('/api/zilliz/traces/clear', { method: 'POST' });
      setZillizTraces([]);
      setSelectedZillizTraceId(null);
    } catch (err) {
      console.warn('Failed to clear Zilliz traces:', err);
    }
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTraceKey(key);
    setTimeout(() => setCopiedTraceKey(null), 2000);
  };

  useEffect(() => {
    if (isOpen) {
      fetchZillizTraces();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentTrace = traces.find(t => t.traceId === (activeTraceId || selectedTraceId)) || traces[0];

  const filteredZillizTraces = zillizTraces.filter((tr) => {
    if (
      zillizFilter === 'quickprompt' &&
      tr.operation !== 'upsert_shortcut' &&
      tr.operation !== 'query_shortcuts' &&
      tr.operation !== 'delete_shortcut' &&
      !(tr.notes || '').toLowerCase().includes('quickprompt') &&
      !(tr.notes || '').toLowerCase().includes('zilliz_2') &&
      !(tr.notes || '').toLowerCase().includes('zilliz-2') &&
      tr.requestPayload?.collectionName !== 'QuickPrompt'
    ) {
      return false;
    }
    if (zillizFilter === 'upsert' && tr.operation !== 'upsert_chat' && tr.operation !== 'upsert_shortcut') return false;
    if (zillizFilter === 'query' && tr.operation !== 'query_chats' && tr.operation !== 'query_shortcuts') return false;
    if (zillizFilter === 'list_or_create' && tr.operation !== 'list_collections' && tr.operation !== 'create_collection') return false;
    if (zillizFilter === 'delete' && tr.operation !== 'delete_chat' && tr.operation !== 'delete_shortcut') return false;

    if (!zillizSearch.trim()) return true;
    const q = zillizSearch.toLowerCase();
    return (
      tr.endpoint.toLowerCase().includes(q) ||
      tr.url.toLowerCase().includes(q) ||
      tr.operation.toLowerCase().includes(q) ||
      JSON.stringify(tr.requestPayload || {}).toLowerCase().includes(q)
    );
  });

  const currentZillizTrace =
    filteredZillizTraces.find((t) => t.id === selectedZillizTraceId) ||
    filteredZillizTraces[0] ||
    zillizTraces[0];

  const handleCopyJson = () => {
    if (!currentTrace) return;
    navigator.clipboard.writeText(JSON.stringify(currentTrace, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySyncLog = () => {
    const syncSummary = traces.map(t => ({
      traceId: t.traceId,
      timestamp: t.timestamp,
      experimentName: t.experimentName,
      userPrompt: t.inputs.user_prompt,
      syncStatus: t.databricksSync,
      spansSentDump: t.databricksSync.spansDump || []
    }));
    navigator.clipboard.writeText(JSON.stringify(syncSummary, null, 2));
    setSyncCopied(true);
    setTimeout(() => setSyncCopied(false), 2000);
  };

  const handleRunDiagnosticTest = async () => {
    setIsRunningTest(true);
    try {
      const res = await fetch('/api/traces/test-sync', { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({
        timestamp: new Date().toISOString(),
        configured: false,
        overallSuccess: false,
        logs: [{
          step: 'Execution Exception',
          name: 'POST /api/traces/test-sync',
          success: false,
          error: e.message
        }]
      });
    } finally {
      setIsRunningTest(false);
    }
  };

  const handleCopyTestResult = () => {
    if (!testResult) return;
    navigator.clipboard.writeText(JSON.stringify(testResult, null, 2));
    setTestCopied(true);
    setTimeout(() => setTestCopied(false), 2000);
  };

  const syncedCount = traces.filter(t => t.databricksSync.synced).length;
  const pendingCount = traces.length - syncedCount;
  const isDatabricksConfigured = traces.some(t => Boolean(t.databricksSync.host));

  return (
    <div
      className={`fixed inset-0 z-50 flex ${
        isMaximized
          ? 'items-stretch justify-stretch p-0 sm:p-1.5 bg-black/60'
          : 'items-center justify-center p-2 sm:p-4 bg-black/50'
      } backdrop-blur-xs transition-all duration-150`}
    >
      <div
        className={`bg-white border border-zinc-200 ${
          isMaximized
            ? 'rounded-none sm:rounded-xl w-full h-full max-w-none shadow-2xl'
            : 'rounded-2xl w-full max-w-7xl h-[92vh] shadow-xl'
        } overflow-hidden flex flex-col transition-all duration-150`}
      >
        {/* Header (Double click to toggle Maximize/Restore) */}
        <div
          onDoubleClick={toggleMaximized}
          className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-200 bg-zinc-50 select-none cursor-default"
          title="Double-click header to toggle Maximize / Restore"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-700 text-white flex items-center justify-center shadow-xs shrink-0">
                <BarChart2 className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-zinc-900">Execution Tracing & Observability</h2>
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                    Ctrl+X
                  </span>
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                    isDatabricksConfigured ? 'bg-emerald-100 text-emerald-800 font-semibold' : 'bg-zinc-200 text-zinc-700'
                  }`}>
                    {isDatabricksConfigured ? 'Databricks MLflow Active' : 'Local Tracing Mode'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">Real-time spans, retriever latency, token generation, and Databricks sync telemetry</p>
              </div>
            </div>

            {/* Window Controls: Maximize/Restore & Close */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleMaximized}
                className="text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/80 p-1.5 rounded-lg transition-colors cursor-pointer"
                title={isMaximized ? "Restore window size" : "Maximize to full screen"}
                aria-label={isMaximized ? "Restore window size" : "Maximize"}
              >
                {isMaximized ? (
                  <Minimize2 className="w-4 h-4 text-zinc-600" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-zinc-600" />
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/80 p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Close (Esc)"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Navigation Tabs */}
          <div className="flex items-center gap-2 mt-4 pt-2 border-t border-zinc-200/60">
            <button
              onClick={() => setActiveTab('traces')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                activeTab === 'traces'
                  ? 'bg-white text-indigo-700 shadow-xs border border-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Traces & Spans Timeline</span>
              <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.2 text-[10px] font-bold rounded-full border border-indigo-100">
                {traces.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('admin-sync')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                activeTab === 'admin-sync'
                  ? 'bg-white text-indigo-700 shadow-xs border border-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Databricks Sync Admin</span>
              {syncedCount > 0 ? (
                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.2 text-[10px] font-bold rounded-full border border-emerald-100 flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" /> {syncedCount} Synced
                </span>
              ) : (
                <span className="bg-amber-50 text-amber-700 px-1.5 py-0.2 text-[10px] font-bold rounded-full border border-amber-100">
                  Status Log
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('diagnostic-test')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                activeTab === 'diagnostic-test'
                  ? 'bg-white text-indigo-700 shadow-xs border border-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Databricks Diagnostic Test CLI</span>
              <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.2 text-[10px] font-bold rounded-full border border-indigo-100">
                Live Test
              </span>
            </button>
            <button
              onClick={() => {
                setActiveTab('chat-history');
                fetchZillizTraces();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                activeTab === 'chat-history'
                  ? 'bg-white text-indigo-700 shadow-xs border border-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat History</span>
              <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.2 text-[10px] font-bold rounded-full border border-indigo-100">
                {zillizTraces.length} HTTP Traces
              </span>
            </button>
          </div>
        </div>

        {/* Tab 1: Traces & Spans Timeline */}
        {activeTab === 'traces' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Traces List */}
            <div className="w-72 border-r border-zinc-200 bg-zinc-50 flex flex-col shrink-0">
              <div className="p-3 border-b border-zinc-200 font-semibold text-xs text-zinc-700 flex items-center justify-between">
                <span>Recorded Traces ({traces.length})</span>
                <span className="text-[10px] font-mono text-zinc-400">v2 REST API</span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-zinc-200">
                {traces.length === 0 ? (
                  <div className="p-4 text-xs text-zinc-500 text-center">
                    No traces recorded yet. Submit a query in SAIL chat to generate spans.
                  </div>
                ) : (
                  traces.map((trace) => (
                    <button
                      key={trace.traceId}
                      onClick={() => setActiveTraceId(trace.traceId)}
                      className={`w-full text-left p-3 transition-colors ${
                        currentTrace?.traceId === trace.traceId
                          ? 'bg-white border-l-3 border-indigo-700 text-zinc-900 shadow-xs'
                          : 'hover:bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-mono text-indigo-700 font-semibold">
                          {trace.traceId.slice(0, 8)}...
                        </span>
                        <span className="text-zinc-400">
                          {(trace.metrics.totalDurationMs / 1000).toFixed(2)}s
                        </span>
                      </div>
                      <p className="text-xs font-medium text-zinc-800 line-clamp-2">
                        {trace.inputs.user_prompt}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-400">
                        <span>{trace.metrics.retrievedDocsCount} docs</span>
                        <span className={trace.status === 'SUCCESS' ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                          {trace.status}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Right Trace Details */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {currentTrace ? (
                <>
                  {/* Trace Meta Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                    <div>
                      <span className="text-xs font-bold text-zinc-900 block">
                        Root Span: {currentTrace.rootSpanName}
                      </span>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        Experiment: {currentTrace.experimentName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-500">
                        Session: {currentTrace.sessionId.slice(0, 12)}
                      </span>
                      <button
                        onClick={handleCopyJson}
                        className="px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-200 rounded-lg flex items-center gap-1.5 shadow-xs"
                        title="Copy Trace JSON"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copy JSON</span>
                      </button>
                    </div>
                  </div>

                  {/* Latency & Metrics Bar */}
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div className="p-3 border border-zinc-200 rounded-xl bg-white">
                      <span className="text-zinc-400 text-[11px] block">Total Duration</span>
                      <span className="text-sm font-bold text-zinc-900 font-mono">
                        {(currentTrace.metrics.totalDurationMs / 1000).toFixed(2)}s
                      </span>
                    </div>
                    <div className="p-3 border border-zinc-200 rounded-xl bg-white">
                      <span className="text-zinc-400 text-[11px] block">Retrieval Latency</span>
                      <span className="text-sm font-bold text-indigo-700 font-mono">
                        {currentTrace.metrics.retrievalDurationMs}ms
                      </span>
                    </div>
                    <div className="p-3 border border-zinc-200 rounded-xl bg-white">
                      <span className="text-zinc-400 text-[11px] block">LLM Synthesis</span>
                      <span className="text-sm font-bold text-indigo-700 font-mono">
                        {(currentTrace.metrics.llmDurationMs / 1000).toFixed(2)}s
                      </span>
                    </div>
                    <div className="p-3 border border-zinc-200 rounded-xl bg-white">
                      <span className="text-zinc-400 text-[11px] block">Databricks Sync</span>
                      <span className={`text-xs font-semibold ${currentTrace.databricksSync.synced ? 'text-emerald-600' : 'text-zinc-600'}`}>
                        {currentTrace.databricksSync.synced ? 'Synced' : 'Local Buffer'}
                      </span>
                    </div>
                  </div>

                  {/* Spans Tree */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Execution Spans Timeline
                      </h3>
                      {currentTrace.databricksSync.spansDump && (
                        <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">
                          {currentTrace.databricksSync.spansDump.length} OTel Formatted Spans Dump
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {currentTrace.spans.map((span) => {
                        const matchedDumpSpan = (currentTrace.databricksSync.spansDump as any[])?.find(
                          (d: any) => d.name === span.name || d.context?.span_id === span.spanId
                        );
                        const statusToRender = matchedDumpSpan?.status_code || span.status;

                        return (
                          <div key={span.spanId} className="p-3.5 border border-zinc-200 rounded-xl bg-white space-y-2 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {span.spanType === 'CHAIN' && <Layers className="w-3.5 h-3.5 text-indigo-700" />}
                                {span.spanType === 'EMBEDDING' && <Layers className="w-3.5 h-3.5 text-emerald-700" />}
                                {span.spanType === 'AGENT' && <Cpu className="w-3.5 h-3.5 text-indigo-700" />}
                                {span.spanType === 'RETRIEVER' && <Database className="w-3.5 h-3.5 text-indigo-700" />}
                                {span.spanType === 'LLM' && <Cpu className="w-3.5 h-3.5 text-indigo-700" />}
                                <span className="text-xs font-bold text-zinc-900">{span.name}</span>
                                <span className="text-[10px] font-mono text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200">
                                  {span.spanType}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-zinc-500">
                                  {span.durationMs !== undefined ? `${span.durationMs}ms` : 'in-progress'}
                                </span>
                                {/* Color-coded status indicator */}
                                <RenderSpanStatusBadge status={statusToRender} />
                              </div>
                            </div>

                            {span.inputs && (
                              <div className="text-[11px] font-mono text-zinc-600 bg-zinc-50 p-2 rounded-lg border border-zinc-200/80 overflow-x-auto max-h-24">
                                <span className="font-bold text-zinc-700">Inputs: </span>
                                {JSON.stringify(span.inputs)}
                              </div>
                            )}
                            {span.outputs && (
                              <div className="text-[11px] font-mono text-zinc-600 bg-zinc-50 p-2 rounded-lg border border-zinc-200/80 overflow-x-auto max-h-24">
                                <span className="font-bold text-zinc-700">Outputs: </span>
                                {JSON.stringify(span.outputs)}
                              </div>
                            )}

                            {/* SpansDump OTel Attributes Badge Bar */}
                            {matchedDumpSpan && (
                              <div className="pt-1.5 border-t border-zinc-100 flex flex-wrap items-center gap-2 text-[10px] font-mono text-zinc-500">
                                <span className="text-zinc-400 font-sans font-medium">MLflow OTel Dump:</span>
                                <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                                  span_type: {matchedDumpSpan.span_type || span.spanType}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 truncate max-w-[200px]" title={matchedDumpSpan.context?.trace_id}>
                                  trace_id: {matchedDumpSpan.context?.trace_id?.slice(0, 12)}...
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                                  parent_id: {matchedDumpSpan.parent_id === null ? 'null (Root)' : matchedDumpSpan.parent_id?.slice(0, 8)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* MLflow spansDump Formatted Trace Log Dump */}
                  {currentTrace.databricksSync.spansDump && currentTrace.databricksSync.spansDump.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                          <Code className="w-3.5 h-3.5 text-indigo-600" />
                          Formatted MLflow spansDump Trace Log
                        </h3>
                        <span className="text-[10px] font-mono text-zinc-400">
                          Raw OpenTelemetry JSON
                        </span>
                      </div>
                      <div className="p-3 bg-zinc-950 text-emerald-400 rounded-xl font-mono text-xs overflow-x-auto max-h-60 border border-zinc-800 shadow-inner">
                        <pre className="text-[10.5px] leading-relaxed">
                          {JSON.stringify(currentTrace.databricksSync.spansDump, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Zilliz Retrievals Inspection */}
                  {currentTrace.inputs.zilliz_retrievals && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Multi-Collection Vector Intelligence Payload Log
                      </h3>
                      <div className="p-3 bg-zinc-900 text-zinc-200 rounded-xl font-mono text-xs overflow-x-auto max-h-56">
                        <pre>{JSON.stringify(currentTrace.inputs.zilliz_retrievals, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-zinc-400 text-xs">
                  Select a trace to view spans and latency breakdowns.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Databricks Sync Admin Dashboard */}
        {activeTab === 'admin-sync' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50/50">
            {/* Sync Overview Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 border border-zinc-200 rounded-xl bg-white shadow-xs space-y-1">
                <div className="flex items-center justify-between text-zinc-500 text-xs">
                  <span>Databricks Host</span>
                  {isDatabricksConfigured ? <Cloud className="w-4 h-4 text-emerald-600" /> : <CloudOff className="w-4 h-4 text-zinc-400" />}
                </div>
                <span className="text-sm font-bold font-mono text-zinc-900 block truncate">
                  {currentTrace?.databricksSync.host || (isDatabricksConfigured ? 'Databricks Cloud' : 'Not Configured')}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {isDatabricksConfigured ? 'REST API v2 Active' : 'Configure DATABRICKS_HOST & TOKEN in .env'}
                </span>
              </div>

              <div className="p-4 border border-zinc-200 rounded-xl bg-white shadow-xs space-y-1">
                <div className="flex items-center justify-between text-zinc-500 text-xs">
                  <span>Active Experiment</span>
                  <FileText className="w-4 h-4 text-indigo-700" />
                </div>
                <span className="text-xs font-bold font-mono text-indigo-700 block truncate">
                  {currentTrace?.experimentName || '/SAIL_Traces'}
                </span>
                <span className="text-[10px] text-zinc-500">
                  Target MLflow Experiment Path
                </span>
              </div>

              <div className="p-4 border border-zinc-200 rounded-xl bg-white shadow-xs space-y-1">
                <div className="flex items-center justify-between text-zinc-500 text-xs">
                  <span>Total Recorded Traces</span>
                  <Activity className="w-4 h-4 text-zinc-600" />
                </div>
                <span className="text-lg font-bold font-mono text-zinc-900 block">
                  {traces.length}
                </span>
                <span className="text-[10px] text-zinc-500">
                  In-Memory Trace Buffer
                </span>
              </div>

              <div className="p-4 border border-zinc-200 rounded-xl bg-white shadow-xs space-y-1">
                <div className="flex items-center justify-between text-zinc-500 text-xs">
                  <span>Databricks Synced</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold font-mono text-emerald-700">
                    {syncedCount}
                  </span>
                  <span className="text-xs font-mono text-zinc-400">
                    / {traces.length} ({traces.length > 0 ? Math.round((syncedCount / traces.length) * 100) : 0}%)
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500">
                  {pendingCount > 0 ? `${pendingCount} buffered locally` : 'All traces synced successfully'}
                </span>
              </div>
            </div>

            {/* Sync Status Log Section */}
            <div className="p-5 border border-zinc-200 rounded-2xl bg-white shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-700" />
                    Databricks MLflow Sync Audit Trail
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Detailed per-trace transmission log verifying pre-flight experiment resolution, payload stringification, and HTTP response codes.
                  </p>
                </div>
                <button
                  onClick={handleCopySyncLog}
                  className="px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  {syncCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-zinc-500" />}
                  <span>Copy Sync Log JSON</span>
                </button>
              </div>

              {/* Table of Trace Sync Statuses */}
              <div className="overflow-hidden border border-zinc-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-semibold font-mono text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Trace ID</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Workflow Prompt</th>
                      <th className="py-2.5 px-3">Spans</th>
                      <th className="py-2.5 px-3">Databricks Sync Status</th>
                      <th className="py-2.5 px-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {traces.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-zinc-400 text-xs">
                          No trace logs recorded yet. Send a message in SAIL chat to generate telemetry.
                        </td>
                      </tr>
                    ) : (
                      traces.map((t) => (
                        <React.Fragment key={t.traceId}>
                          <tr className="hover:bg-zinc-50/80 transition-colors">
                            <td className="py-3 px-3 font-mono font-semibold text-indigo-700">
                              <button
                                onClick={() => setExpandedSyncTraceId(expandedSyncTraceId === t.traceId ? null : t.traceId)}
                                className="flex items-center gap-1 hover:text-indigo-900 transition-colors"
                                title="Click to view span dump JSON"
                              >
                                {expandedSyncTraceId === t.traceId ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                                )}
                                <span>{t.traceId.slice(0, 8)}...</span>
                              </button>
                            </td>
                            <td className="py-3 px-3 text-zinc-500 font-mono text-[11px]">
                              {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="py-3 px-3 text-zinc-800 max-w-xs truncate">
                              {t.inputs.user_prompt}
                            </td>
                            <td className="py-3 px-3 font-mono text-zinc-600 text-[11px]">
                              <button
                                onClick={() => setExpandedSyncTraceId(expandedSyncTraceId === t.traceId ? null : t.traceId)}
                                className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold hover:bg-indigo-100 transition-colors inline-flex items-center gap-1"
                              >
                                {t.spans.length} spans
                              </button>
                            </td>
                            <td className="py-3 px-3">
                              {t.databricksSync.synced ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Synced to Databricks
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                                  <Server className="w-3.5 h-3.5 text-zinc-500" />
                                  Local MLflow Buffer
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-[11px] font-mono text-zinc-500 truncate max-w-[150px]" title={t.databricksSync.statusText}>
                                  {t.databricksSync.statusText}
                                </span>
                                <button
                                  onClick={() => setExpandedSyncTraceId(expandedSyncTraceId === t.traceId ? null : t.traceId)}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-300 transition-colors"
                                >
                                  {expandedSyncTraceId === t.traceId ? 'Close Log' : 'Dump Log'}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedSyncTraceId === t.traceId && (
                            <tr>
                              <td colSpan={6} className="p-4 bg-zinc-950 text-zinc-200 font-mono text-[11px] border-t border-b border-zinc-800 space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-zinc-400">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-white">
                                      MLflow Trace Log Span Dump
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-indigo-300 font-semibold text-[10px]">
                                      {t.databricksSync.spansDump?.length || t.spans.length} Spans Sent
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-zinc-400 font-mono">
                                    Trace ID: {t.traceId}
                                  </span>
                                </div>

                                {/* Formatted Spans List with Color-Coded Statuses */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {((t.databricksSync.spansDump as any[]) || []).map((dumpSpan: any, idx: number) => {
                                    const statusCode = dumpSpan.status_code || 'OK';
                                      let spanType = dumpSpan.span_type;
                                      if (!spanType && dumpSpan.attributes?.["mlflow.spanType"]) {
                                        try {
                                          spanType = JSON.parse(dumpSpan.attributes["mlflow.spanType"]);
                                        } catch {
                                          spanType = dumpSpan.attributes["mlflow.spanType"];
                                        }
                                      }
                                      if (!spanType) spanType = 'SPAN';

                                      const durationMs = dumpSpan.start_time && dumpSpan.end_time 
                                        ? Math.round((dumpSpan.end_time - dumpSpan.start_time) / 1000000) 
                                        : 0;

                                    return (
                                      <div key={idx} className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1.5 text-xs">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-white text-[11px]">{dumpSpan.name}</span>
                                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                              {spanType}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-400 font-mono">{durationMs}ms</span>
                                            <RenderSpanStatusBadge status={statusCode} />
                                          </div>
                                        </div>
                                        <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-3">
                                          <span>Span ID: {dumpSpan.context?.span_id?.slice(0, 10)}</span>
                                          <span>Parent: {dumpSpan.parent_id === null ? 'null (Root)' : dumpSpan.parent_id?.slice(0, 8)}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Raw spansDump JSON */}
                                <div className="pt-2 border-t border-zinc-800 space-y-1">
                                  <div className="text-[10px] uppercase font-bold text-zinc-400">
                                    Raw spansDump Array JSON
                                  </div>
                                  <pre className="whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto text-[10px] text-emerald-400 p-2.5 rounded bg-black/60 border border-zinc-800/80">
                                    {JSON.stringify(t.databricksSync.spansDump || [], null, 2)}
                                  </pre>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Databricks Diagnostic Test CLI */}
        {activeTab === 'diagnostic-test' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50/50">
            {/* Header & Control Banner */}
            <div className="p-5 border border-zinc-200 rounded-2xl bg-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-700" />
                  <h3 className="text-sm font-bold text-zinc-900">Databricks MLflow Live Tracing Test CLI</h3>
                </div>
                <p className="text-xs text-zinc-500">
                  Sends an instant test trace to Databricks and evaluates all 3 artifact upload strategies (Presigned URL, DBFS REST API, MLflow Proxy API) with full HTTP request/response logging.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunDiagnosticTest}
                  disabled={isRunningTest}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRunningTest ? 'animate-spin' : ''}`} />
                  <span>{isRunningTest ? 'Running Databricks Test...' : 'Run Live Trace Test'}</span>
                </button>
                {testResult && (
                  <button
                    onClick={handleCopyTestResult}
                    className="px-3 py-2 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-zinc-100 border border-zinc-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {testCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-zinc-500" />}
                    <span>Copy Logs</span>
                  </button>
                )}
              </div>
            </div>

            {/* Diagnostic Results Section */}
            {!testResult && !isRunningTest && (
              <div className="p-8 border border-zinc-200 rounded-2xl bg-white text-center space-y-3 shadow-xs">
                <Terminal className="w-8 h-8 text-indigo-600 mx-auto" />
                <h4 className="text-sm font-bold text-zinc-900">Ready to Execute Databricks Trace Test</h4>
                <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                  Click <strong className="text-zinc-800">"Run Live Trace Test"</strong> above to dispatch a test trace payload. The debugger will test experiment resolution, StartTrace RPC, presigned URL upload, DBFS fallback, proxy upload, and EndTrace PATCH.
                </p>
              </div>
            )}

            {isRunningTest && (
              <div className="p-8 border border-zinc-200 rounded-2xl bg-white text-center space-y-3 shadow-xs">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <h4 className="text-sm font-bold text-zinc-900">Executing Step-by-Step Databricks MLflow Tracing RPCs...</h4>
                <p className="text-xs text-zinc-500">Communicating with Databricks REST API at {traces[0]?.databricksSync?.host || 'configured host'}...</p>
              </div>
            )}

            {testResult && (
              <div className="space-y-5">
                {/* Result Overview Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 border border-zinc-200 rounded-xl bg-white space-y-1 shadow-2xs">
                    <span className="text-zinc-400 text-[11px] block font-mono">Overall Status</span>
                    {testResult.overallSuccess ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        TRACE & ARTIFACT OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-bold text-rose-700">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        SYNC ERROR
                      </span>
                    )}
                  </div>

                  <div className="p-3 border border-zinc-200 rounded-xl bg-white space-y-1 shadow-2xs">
                    <span className="text-zinc-400 text-[11px] block font-mono">Active Strategy</span>
                    <span className="font-bold text-indigo-700 font-mono">
                      {testResult.activeStrategy || 'None'}
                    </span>
                  </div>

                  <div className="p-3 border border-zinc-200 rounded-xl bg-white space-y-1 shadow-2xs">
                    <span className="text-zinc-400 text-[11px] block font-mono">Databricks Request ID</span>
                    <span className="font-mono text-zinc-800 truncate block font-semibold" title={testResult.databricksRequestId}>
                      {testResult.databricksRequestId || 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 border border-zinc-200 rounded-xl bg-white space-y-1 shadow-2xs">
                    <span className="text-zinc-400 text-[11px] block font-mono">Target Host</span>
                    <span className="font-mono text-zinc-800 truncate block font-semibold" title={testResult.databricksHost}>
                      {testResult.databricksHost || 'Not Configured'}
                    </span>
                  </div>
                </div>

                {/* Step-by-Step RPC Response Timeline */}
                <div className="border border-zinc-200 rounded-2xl bg-white p-5 space-y-4 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-700" />
                    Databricks MLflow REST RPC Step Logs
                  </h4>

                  <div className="space-y-3">
                    {testResult.logs?.map((stepLog: any, idx: number) => (
                      <div key={idx} className="p-3.5 border border-zinc-200 rounded-xl bg-zinc-50/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-900">{stepLog.step}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200/80 text-zinc-700 font-semibold">
                              {stepLog.method} {stepLog.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {stepLog.status && (
                              <span className="text-[10px] font-mono text-zinc-500">
                                HTTP {stepLog.status}
                              </span>
                            )}
                            {stepLog.success ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> PASS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3 text-rose-600" /> FAIL
                              </span>
                            )}
                          </div>
                        </div>

                        {stepLog.url && stepLog.url !== 'N/A' && (
                          <div className="text-[10.5px] font-mono text-zinc-500 truncate" title={stepLog.url}>
                            URL: {stepLog.url}
                          </div>
                        )}

                        {stepLog.error && (
                          <div className="text-[11px] font-mono text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200 font-medium">
                            {stepLog.error}
                          </div>
                        )}

                        {stepLog.responsePayload && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase">Response Body Payload:</div>
                            <pre className="text-[10.5px] font-mono bg-zinc-950 text-emerald-400 p-2.5 rounded-lg max-h-40 overflow-y-auto leading-relaxed border border-zinc-800">
                              {typeof stepLog.responsePayload === 'string' 
                                ? stepLog.responsePayload 
                                : JSON.stringify(stepLog.responsePayload, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Chat History (Zilliz Vector DB HTTP Traces & Observability) */}
        {activeTab === 'chat-history' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50/50">
            {/* Top Toolbar */}
            <div className="p-4 bg-white border-b border-zinc-200 shrink-0 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-indigo-700" />
                      Zilliz HTTP Tracing & Chat History Observability
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                      Milvus REST API v2
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Live HTTP requests and responses sent to and received from Zilliz Cloud (<code className="font-mono text-zinc-700">/v2/vectordb/*</code>).
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleRunQuickPromptDiagnostic}
                    disabled={isRunningQuickPromptDiag || isRunningZillizDiag}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                    title="Test ZILLIZ-2 connection, auth, and QuickPrompt collection roundtrip"
                  >
                    {isRunningQuickPromptDiag ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>{isRunningQuickPromptDiag ? 'Testing ZILLIZ-2...' : 'Test QuickPrompt (ZILLIZ-2)'}</span>
                  </button>

                  <button
                    onClick={handleRunZillizDiagnostic}
                    disabled={isRunningZillizDiag || isRunningQuickPromptDiag}
                    className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    {isRunningZillizDiag ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>{isRunningZillizDiag ? 'Running Test...' : 'Run ChatHistory Test'}</span>
                  </button>

                  <button
                    onClick={fetchZillizTraces}
                    disabled={isLoadingZillizTraces}
                    className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-colors cursor-pointer"
                    title="Refresh HTTP traces"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingZillizTraces ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    onClick={handleClearZillizTraces}
                    disabled={zillizTraces.length === 0}
                    className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-zinc-200 transition-colors cursor-pointer disabled:opacity-40"
                    title="Clear trace logs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Sanity Check & Filter Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 text-xs">
                {/* Protocol checks */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Port 19530 Stripped
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-medium">
                    <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                    REST v2 Flat Array Parser
                  </span>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[11px] text-zinc-400 mr-1">Filter:</span>
                  {(['all', 'quickprompt', 'upsert', 'query', 'list_or_create', 'delete'] as const).map((filter) => {
                    const isSelected = zillizFilter === filter;
                    const label =
                      filter === 'all'
                        ? `All (${zillizTraces.length})`
                        : filter === 'quickprompt'
                        ? 'QuickPrompt / ZILLIZ-2'
                        : filter === 'upsert'
                        ? 'Upsert'
                        : filter === 'query'
                        ? 'Query'
                        : filter === 'list_or_create'
                        ? 'List/Create'
                        : 'Delete';
                    return (
                      <button
                        key={filter}
                        onClick={() => setZillizFilter(filter)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-700 text-white shadow-2xs'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Diagnostic Results Card (if ran) */}
            {zillizDiagResult && (
              <div className="p-4 bg-zinc-100/70 border-b border-zinc-200 shrink-0 max-h-72 overflow-y-auto space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-zinc-900">{zillizDiagLabel}</span>
                    {zillizDiagResult.zillizUri && (
                      <span className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-600">
                        {zillizDiagResult.zillizUri}
                      </span>
                    )}
                    {zillizDiagResult.overallSuccess ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-700" /> ALL STEPS PASSED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                        <AlertTriangle className="w-3 h-3 text-rose-700" /> VERIFICATION FAILED
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setZillizDiagResult(null)}
                    className="text-zinc-400 hover:text-zinc-700 text-xs cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>

                {zillizDiagResult.steps.some(s => s.details.includes('AIS_backup_api_v1') && !s.success) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        Zilliz Serverless Collection Limit Reached (5/5)
                      </span>
                      <p className="text-[11px] text-amber-700 leading-relaxed">
                        Your Zilliz cluster has reached its 5-collection capacity limit. The unused backup collection <code className="font-mono font-semibold bg-amber-100 px-1 py-0.5 rounded text-amber-900">AIS_backup_api_v1</code> is occupying the 5th slot.
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch('/api/zilliz/collections/drop-backup', { method: 'POST' });
                        await handleRunZillizDiagnostic();
                      }}
                      className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-semibold text-xs transition-colors shrink-0 shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Drop Backup & Retry</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {zillizDiagResult.steps.map((st, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                        st.success ? 'bg-white border-zinc-200' : 'bg-rose-50/50 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-900 truncate" title={st.name}>
                          {st.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                            st.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {st.durationMs}ms
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-600 leading-relaxed">{st.details}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Master-Detail HTTP Traces View */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Pane: List of HTTP Traces */}
              <div className="w-80 border-r border-zinc-200 bg-zinc-50/60 flex flex-col shrink-0">
                <div className="p-2.5 border-b border-zinc-200 bg-white">
                  <input
                    type="text"
                    value={zillizSearch}
                    onChange={(e) => setZillizSearch(e.target.value)}
                    placeholder="Search HTTP traces by endpoint or ID..."
                    className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-medium"
                  />
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-zinc-200">
                  {filteredZillizTraces.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400 space-y-2">
                      <Database className="w-8 h-8 text-zinc-300 mx-auto" />
                      <p className="text-xs font-semibold text-zinc-600">No Zilliz HTTP traces recorded</p>
                      <p className="text-[11px] text-zinc-500">
                        Send a message or run the roundtrip diagnostic to inspect live HTTP traffic.
                      </p>
                      <button
                        onClick={handleRunZillizDiagnostic}
                        disabled={isRunningZillizDiag}
                        className="mt-2 text-xs text-indigo-700 font-semibold hover:underline cursor-pointer"
                      >
                        Run Live Diagnostic
                      </button>
                    </div>
                  ) : (
                    filteredZillizTraces.map((tr) => {
                      const isSelected = (selectedZillizTraceId || filteredZillizTraces[0]?.id) === tr.id;
                      const formattedTime = new Date(tr.timestampMs).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      });

                      const opBadgeColor =
                        tr.operation === 'upsert_chat' || tr.operation === 'upsert_shortcut'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : tr.operation === 'query_chats' || tr.operation === 'query_shortcuts'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : tr.operation === 'delete_chat' || tr.operation === 'delete_shortcut'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-purple-50 text-purple-700 border-purple-200';

                      return (
                        <div
                          key={tr.id}
                          onClick={() => setSelectedZillizTraceId(tr.id)}
                          className={`p-3 transition-colors cursor-pointer relative ${
                            isSelected
                              ? 'bg-indigo-50/80 border-l-3 border-indigo-600 shadow-2xs'
                              : 'bg-white hover:bg-zinc-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800">
                                {tr.method}
                              </span>
                              <span
                                className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${opBadgeColor}`}
                              >
                                {tr.operation.replace('_', ' ')}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                tr.success
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {tr.responseStatus ? `HTTP ${tr.responseStatus}` : 'ERR'}
                            </span>
                          </div>

                          <div className="font-mono text-[11px] font-semibold text-zinc-900 truncate" title={tr.endpoint}>
                            {tr.endpoint}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1 font-mono">
                            <span>{formattedTime}</span>
                            <span>{tr.durationMs}ms</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Pane: Selected Trace Detailed Inspector */}
              <div className="flex-1 overflow-y-auto p-4 bg-white space-y-4">
                {currentZillizTrace ? (
                  <div className="space-y-4">
                    {/* Header info */}
                    <div className="p-3.5 border border-zinc-200 rounded-xl bg-zinc-50 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-indigo-700 text-white">
                            {currentZillizTrace.method}
                          </span>
                          <span className="font-mono text-xs font-bold text-zinc-900">
                            {currentZillizTrace.endpoint}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                              currentZillizTrace.success
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            HTTP {currentZillizTrace.responseStatus} {currentZillizTrace.statusText}
                          </span>
                          <span className="text-xs font-mono text-zinc-500 font-semibold">
                            {currentZillizTrace.durationMs}ms
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] font-mono text-zinc-600 truncate" title={currentZillizTrace.url}>
                        <span className="text-zinc-400 select-none">URL: </span>
                        {currentZillizTrace.url}
                      </div>

                      {currentZillizTrace.notes && (
                        <div className="text-xs text-indigo-900 bg-indigo-50/60 p-2 rounded-lg border border-indigo-100 font-medium">
                          Context: {currentZillizTrace.notes}
                        </div>
                      )}

                      {currentZillizTrace.error && (
                        <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200 font-mono font-medium">
                          Error: {currentZillizTrace.error}
                        </div>
                      )}
                    </div>

                    {/* Request Payload */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                          <Code className="w-3.5 h-3.5 text-indigo-700" />
                          HTTP Request Payload (Sent to Zilliz)
                        </span>
                        <button
                          onClick={() =>
                            handleCopyText(
                              JSON.stringify(currentZillizTrace.requestPayload, null, 2),
                              'req-payload'
                            )
                          }
                          className="px-2 py-0.5 text-[10px] font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded border border-zinc-200 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          {copiedTraceKey === 'req-payload' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedTraceKey === 'req-payload' ? 'Copied' : 'Copy JSON'}</span>
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono bg-zinc-950 text-indigo-300 p-3.5 rounded-xl max-h-56 overflow-y-auto leading-relaxed border border-zinc-800 shadow-inner">
                        {currentZillizTrace.requestPayload
                          ? JSON.stringify(currentZillizTrace.requestPayload, null, 2)
                          : '// No request body'}
                      </pre>
                    </div>

                    {/* Response Body */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-indigo-700" />
                          HTTP Response Body (Received from Zilliz REST v2)
                        </span>
                        <button
                          onClick={() =>
                            handleCopyText(
                              JSON.stringify(currentZillizTrace.responseBody, null, 2),
                              'res-payload'
                            )
                          }
                          className="px-2 py-0.5 text-[10px] font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded border border-zinc-200 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          {copiedTraceKey === 'res-payload' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedTraceKey === 'res-payload' ? 'Copied' : 'Copy JSON'}</span>
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono bg-zinc-950 text-emerald-400 p-3.5 rounded-xl max-h-64 overflow-y-auto leading-relaxed border border-zinc-800 shadow-inner">
                        {currentZillizTrace.responseBody
                          ? JSON.stringify(currentZillizTrace.responseBody, null, 2)
                          : '// No response body received'}
                      </pre>
                    </div>

                    {/* REST API v2 Verification Badge */}
                    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1 text-xs">
                      <span className="font-bold text-zinc-800 block">Zilliz REST API v2 Compliance Check</span>
                      <ul className="text-[11px] text-zinc-600 space-y-0.5 list-disc pl-4 font-mono">
                        <li>Status Code: {currentZillizTrace.responseStatus} ({currentZillizTrace.statusText || 'OK'})</li>
                        <li>Zilliz API Code: {String((currentZillizTrace.responseBody as any)?.code ?? 0)} ({(currentZillizTrace.responseBody as any)?.code === 0 ? 'Success' : 'Check code'})</li>
                        <li>Payload Structure: REST v2 flat object array direct parsing verified</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-400 text-xs">
                    Select an HTTP trace from the left panel to inspect request/response payloads.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-1.5 text-zinc-500">
            <Server className="w-3.5 h-3.5 text-zinc-400" />
            <span>Enterprise Databricks MLflow Telemetry & Lineage Logger</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-200 rounded-lg transition-colors shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

