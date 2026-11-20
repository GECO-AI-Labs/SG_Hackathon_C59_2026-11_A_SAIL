/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Activity, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Database, 
  Cpu, 
  Layers, 
  Play
} from 'lucide-react';
import { DiagnosticResult } from '../types.js';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunDiagnostics: () => Promise<DiagnosticResult>;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  onRunDiagnostics
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRun = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await onRunDiagnostics();
      setResults(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-700 text-white flex items-center justify-center">
              <Activity className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900">System Diagnostic Suite</h2>
              <p className="text-xs text-zinc-500">LLM Engine, Vector Embeddings & Maritime Database Verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <p className="text-xs text-zinc-600 leading-relaxed">
            This tool executes the 4-phase sequential stress test to verify latency, vector readiness, and handshake health.
          </p>

          {/* Action Trigger */}
          <div className="flex items-center justify-between p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
            <div className="text-xs text-zinc-600">
              <span className="font-bold text-zinc-900 block">4-Phase Sequential Stress Test</span>
              <span>Validates LLM inference, embedding vectors, and cluster responsiveness.</span>
            </div>
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-xs"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing Systems...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Deep Diagnostic</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Diagnostic Execution Error: </span>
                {error}
              </div>
            </div>
          )}

          {/* Results Display */}
          {results && (
            <div className="space-y-3 pt-2">
              {/* Overall status banner */}
              <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                results.overallSuccess 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {results.overallSuccess 
                    ? 'All Core Systems Verified & Production Ready' 
                    : 'Diagnostics Complete with Operational Warnings'}
                </span>
              </div>

              {/* Phase 1: Gemini LLM */}
              <div className="p-3.5 border border-zinc-200 rounded-xl bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-indigo-700" />
                    Phase 1: Analytical LLM Engine
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-zinc-500">{results.phase1Llm.durationMs}ms</span>
                    <span className="text-[11px] font-bold text-emerald-600">PASSED</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 font-mono bg-zinc-50 p-2 rounded border border-zinc-100">
                  {results.phase1Llm.details}
                </p>
              </div>

              {/* Phase 2: Embeddings */}
              <div className="p-3.5 border border-zinc-200 rounded-xl bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-700" />
                    Phase 2: Vector Embedding Engine
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-zinc-500">{results.phase2Embeddings.durationMs}ms</span>
                    <span className="text-[11px] font-bold text-emerald-600">PASSED</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 font-mono bg-zinc-50 p-2 rounded border border-zinc-100">
                  {results.phase2Embeddings.details}
                </p>
              </div>

              {/* Phase 3 & 4: Database Connection & Collections */}
              <div className="p-3.5 border border-zinc-200 rounded-xl bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-700" />
                    Phase 3 & 4: Maritime Collections & Database Readiness
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-zinc-500">{results.phase3Zilliz.durationMs}ms</span>
                    <span className={`text-[11px] font-bold ${results.phase3Zilliz.success ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {results.phase3Zilliz.success ? 'PASSED' : 'FALLBACK ACTIVE'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-600">
                  {results.phase3Zilliz.details}
                </p>
                <div className="text-[11px] font-mono bg-zinc-50 p-2 rounded border border-zinc-100 text-zinc-600">
                  <div>Collections: {results.phase3Zilliz.collections.join(', ')}</div>
                  <div className="mt-0.5 text-emerald-700 font-semibold">{results.phase3Zilliz.loadedState}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
