/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Send, 
  Sparkles, 
  RotateCcw, 
  Ship, 
  TrendingUp, 
  Anchor, 
  ArrowRight,
  Database,
  Layers,
  Compass,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle
} from 'lucide-react';
import { Message, ThinkingLevel, ShortcutPrompt, ShortcutIconName, ShortcutSyncStatus } from '../types.js';
import { ChatMessage } from './ChatMessage.js';

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  onClearChat: () => void;
  onNewChat: () => void;
  onOpenTrace: (traceId: string) => void;
  thinkingLevel: ThinkingLevel;
  onThinkingLevelChange: (level: ThinkingLevel) => void;
  shortcuts: ShortcutPrompt[];
  shortcutSyncInfo?: ShortcutSyncStatus | null;
  onCreateShortcut: (data: { title: string; desc: string; query: string; icon: ShortcutIconName }) => Promise<void>;
  onUpdateShortcut: (id: string, data: { title: string; desc: string; query: string; icon: ShortcutIconName }) => Promise<void>;
  onDeleteShortcut: (id: string) => Promise<void>;
  onSyncShortcuts?: () => Promise<void>;
}

const ICON_OPTIONS: Array<{ name: ShortcutIconName; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { name: 'TrendingUp', label: 'Market', Icon: TrendingUp },
  { name: 'Ship', label: 'Vessel', Icon: Ship },
  { name: 'Anchor', label: 'Charter', Icon: Anchor },
  { name: 'Layers', label: 'Index', Icon: Layers },
  { name: 'Compass', label: 'Route', Icon: Compass },
  { name: 'Database', label: 'Data', Icon: Database },
  { name: 'Sparkles', label: 'Custom', Icon: Sparkles }
];

function getShortcutIcon(name?: ShortcutIconName) {
  const found = ICON_OPTIONS.find((opt) => opt.name === name);
  return found ? found.Icon : Sparkles;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onClearChat,
  onNewChat,
  onOpenTrace,
  thinkingLevel,
  onThinkingLevelChange,
  shortcuts,
  shortcutSyncInfo,
  onCreateShortcut,
  onUpdateShortcut,
  onDeleteShortcut,
  onSyncShortcuts
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Quick Prompt Customize / Create / Delete state
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<ShortcutPrompt | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formQuery, setFormQuery] = useState('');
  const [formIcon, setFormIcon] = useState<ShortcutIconName>('Sparkles');
  const [isSavingShortcut, setIsSavingShortcut] = useState(false);
  const [shortcutFormError, setShortcutFormError] = useState<string | null>(null);
  const [isSyncingZilliz, setIsSyncingZilliz] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 130)}px`;
  };

  const openCreateModal = () => {
    setEditingShortcut(null);
    setFormTitle('');
    setFormDesc('');
    setFormQuery(input.trim() || '');
    setFormIcon('Sparkles');
    setShortcutFormError(null);
    setIsShortcutModalOpen(true);
  };

  const openEditModal = (shortcut: ShortcutPrompt) => {
    setEditingShortcut(shortcut);
    setFormTitle(shortcut.title);
    setFormDesc(shortcut.desc || '');
    setFormQuery(shortcut.query);
    setFormIcon(shortcut.icon || 'Sparkles');
    setShortcutFormError(null);
    setIsShortcutModalOpen(true);
  };

  const handleSaveShortcutForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formQuery.trim()) return;
    setIsSavingShortcut(true);
    setShortcutFormError(null);
    try {
      const payload = {
        title: formTitle.trim(),
        desc: formDesc.trim(),
        query: formQuery.trim(),
        icon: formIcon
      };
      if (editingShortcut) {
        await onUpdateShortcut(editingShortcut.id, payload);
      } else {
        await onCreateShortcut(payload);
      }
      setIsShortcutModalOpen(false);
    } catch (err) {
      setShortcutFormError(err instanceof Error ? err.message : 'Failed to save quick prompt.');
    } finally {
      setIsSavingShortcut(false);
    }
  };

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteShortcut(id);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 overflow-hidden relative">
      {/* Scrollable Conversation Surface */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-6">
            {/* Copilot Hero Header */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-700 text-white flex items-center justify-center shadow-xs">
                  <Ship className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-zinc-950 tracking-tight">SAIL Maritime Copilot</h1>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold">
                      Agentic RAG
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 font-medium">
                    Southeast Asian shipping lanes · Maritime multi-collection databases · Multi-agent intelligence
                  </p>
                </div>
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed">
                SAIL delivers data-driven market intelligence for smaller container carriers, fleet scenario planning, and feeder operations. Connected directly to live Hellenic RSS news, AIS vessel positions, seaport TEU indices, and corporate charter filings.
              </p>

              {/* Copilot Capability Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 text-[11px] text-zinc-600">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-md">
                  <Database className="w-3 h-3 text-indigo-700" />
                  <span>4 Vector Collections</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-md">
                  <Sparkles className="w-3 h-3 text-indigo-700" />
                  <span>Mandatory Bold Citations</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-md">
                  <Ship className="w-3 h-3 text-indigo-700" />
                  <span>Real-time AIS Telemetry</span>
                </div>
              </div>
            </div>

            {/* Suggested / Custom Scenario Prompts */}
            <div>
              <div className="flex items-center justify-between mb-2.5 px-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Quick Prompts & Shortcuts
                  </h2>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      shortcutSyncInfo?.storageMode === 'QuickPrompt'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : shortcutSyncInfo?.zillizAvailable
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                    }`}
                    title={shortcutSyncInfo?.lastError || 'Synced with Zilliz QuickPrompt collection (ZILLIZ-2)'}
                  >
                    {shortcutSyncInfo?.storageMode === 'ChatHistoryFallback'
                      ? 'Zilliz: QuickPrompt (Fallback)'
                      : 'Zilliz: QuickPrompt'}
                  </span>
                </div>
              </div>

              {shortcuts.length === 0 ? (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="w-full p-6 bg-white border border-dashed border-zinc-300 hover:border-indigo-400 rounded-xl text-center space-y-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-5 h-5 text-indigo-600 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-700">Custom</p>
                  <p className="text-[11px] text-zinc-500">Click to create your first custom prompt shortcut</p>
                </button>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Custom Quick Prompt Box (First Box) */}
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="text-left p-3.5 bg-indigo-50/40 border border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50/80 rounded-xl transition-all group flex items-start gap-3 shadow-2xs cursor-pointer"
                    title="Create a new custom prompt in Zilliz QuickPrompt collection"
                  >
                    <div className="p-2 rounded-lg bg-indigo-100/80 border border-indigo-200 text-indigo-700 group-hover:bg-indigo-700 group-hover:text-white group-hover:border-indigo-700 transition-colors shrink-0 mt-0.5">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-bold text-indigo-800 group-hover:text-indigo-900">
                          Custom
                        </h3>
                        <ArrowRight className="w-3 h-3 text-indigo-400 group-hover:text-indigo-700 shrink-0" />
                      </div>
                      <p className="text-[11px] text-indigo-700/75 line-clamp-2 mt-0.5 leading-relaxed">
                        Create and save a custom quick prompt to Zilliz QuickPrompt collection
                      </p>
                    </div>
                  </button>

                  {shortcuts.map((item) => {
                    const Icon = getShortcutIcon(item.icon);
                    const isConfirming = confirmDeleteId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!isConfirming) onSendMessage(item.query);
                        }}
                        className="text-left p-3.5 bg-white border border-zinc-200 hover:border-indigo-400 hover:bg-zinc-50/60 rounded-xl transition-all group flex items-start gap-3 shadow-2xs cursor-pointer relative"
                      >
                        <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200 text-indigo-700 group-hover:bg-indigo-50 group-hover:border-indigo-200 transition-colors shrink-0 mt-0.5">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-xs font-bold text-zinc-900 group-hover:text-indigo-700 line-clamp-1">
                              {item.title}
                            </h3>

                            {/* Customize / Delete actions */}
                            {isConfirming ? (
                              <div
                                className="flex items-center gap-1 shrink-0 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded z-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[10px] text-rose-700 font-bold">Delete?</span>
                                <button
                                  type="button"
                                  disabled={deletingId === item.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirmDelete(item.id);
                                  }}
                                  className="px-1.5 py-0.5 text-[10px] bg-rose-600 hover:bg-rose-700 text-white rounded font-bold cursor-pointer"
                                >
                                  {deletingId === item.id ? '...' : 'Yes'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(null);
                                  }}
                                  className="p-0.5 text-zinc-400 hover:text-zinc-700 rounded cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div
                                className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditModal(item);
                                  }}
                                  className="p-1 text-zinc-400 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                                  title="Customize prompt"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(item.id);
                                  }}
                                  className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="Delete prompt"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                                <ArrowRight className="w-3 h-3 text-zinc-400 ml-0.5" />
                              </div>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5 leading-relaxed">
                            {item.desc || item.query}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200/80">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} onOpenTrace={onOpenTrace} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating Quick Prompts Boxes Bar (when conversation ongoing) */}
      {messages.length > 0 && !isLoading && (
        <div className="px-4 py-1.5 bg-white/95 backdrop-blur-xs border-t border-zinc-200 overflow-x-auto flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 shrink-0 mr-1">
            Quick Prompts:
          </span>

          {/* Custom Quick Prompt Box (First Box) */}
          <button
            type="button"
            onClick={openCreateModal}
            className="text-[11px] font-semibold text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-700 px-2.5 py-1 rounded-md border border-indigo-200 hover:border-indigo-700 shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
            title="Create new custom quick prompt (stored in Zilliz QuickPrompt)"
          >
            <Plus className="w-3 h-3" />
            <span>Custom</span>
          </button>

          {shortcuts.map((q) => {
            const isConfirming = confirmDeleteId === q.id;
            const Icon = getShortcutIcon(q.icon);
            return (
              <div
                key={q.id}
                className="group/chip flex items-center bg-zinc-50 hover:bg-indigo-50/70 border border-zinc-200 hover:border-indigo-300 rounded-md shrink-0 transition-colors overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => onSendMessage(q.query)}
                  className="text-[11px] text-zinc-700 hover:text-indigo-700 font-medium px-2 py-1 flex items-center gap-1.5 cursor-pointer"
                  title={q.query}
                >
                  <Icon className="w-3 h-3 text-indigo-600 shrink-0" />
                  <span>{q.title}</span>
                </button>

                {isConfirming ? (
                  <div className="flex items-center gap-0.5 pr-1 border-l border-rose-200 bg-rose-50 pl-1 py-0.5">
                    <button
                      type="button"
                      disabled={deletingId === q.id}
                      onClick={() => handleConfirmDelete(q.id)}
                      className="px-1.5 py-0.5 text-[9.5px] bg-rose-600 hover:bg-rose-700 text-white rounded font-bold cursor-pointer"
                      title="Confirm delete"
                    >
                      {deletingId === q.id ? '...' : 'Del'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="p-0.5 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center pr-1 gap-0.5 opacity-0 group-hover/chip:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(q);
                      }}
                      className="p-0.5 text-zinc-400 hover:text-indigo-700 rounded cursor-pointer"
                      title="Customize prompt"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(q.id);
                      }}
                      className="p-0.5 text-zinc-400 hover:text-rose-600 rounded cursor-pointer"
                      title="Delete prompt"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Copilot Style Floating Input Bar */}
      <div className="p-3 sm:p-4 bg-white border-t border-zinc-200 shrink-0">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative bg-zinc-50/80 border border-zinc-300 rounded-xl p-2.5 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-600/10 transition-all shadow-xs flex flex-col justify-between">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Ask SAIL about feeder chartering, AIS traffic, WCI rates, or port throughput..."
              className="w-full bg-transparent border-0 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none resize-none max-h-32 py-0.5 px-1 leading-relaxed"
            />
            
            {/* Copilot Input Toolbar */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-200/60 mt-1 gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                  <span className="font-semibold text-zinc-700 select-none text-[11px] flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-600 inline" />
                    Thinking Level
                  </span>
                  <div className="inline-flex items-center p-0.5 bg-zinc-100/90 border border-zinc-200/90 rounded-lg gap-0.5">
                    {(['Low', 'Medium', 'High'] as const).map((level) => {
                      const isSelected = thinkingLevel === level;
                      const modelName =
                        level === 'Low'
                          ? 'gemini-3.1-flash-lite'
                          : level === 'Medium'
                          ? 'gemini-3.5-flash'
                          : 'gemini-3.8-flash';
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => onThinkingLevelChange(level)}
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-semibold shadow-2xs ring-1 ring-indigo-700'
                              : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/80'
                          }`}
                          title={`${level} Thinking: Uses ${modelName}`}
                        >
                          {level}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* New Chat Button directly to the right of thinking level High, using the chat history new chat box style */}
                {onNewChat && (
                  <button
                    type="button"
                    onClick={onNewChat}
                    disabled={isLoading}
                    className="py-1 px-3 bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50 shrink-0"
                    title="Start a new chat session"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Chat</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearChat}
                    disabled={isLoading}
                    className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors"
                    title="Clear conversation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}

                <span className="hidden sm:inline text-[10px] text-zinc-400 font-mono mr-1">
                  Enter ↵
                </span>

                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="w-7 h-7 rounded-lg bg-indigo-700 hover:bg-indigo-800 disabled:opacity-30 text-white flex items-center justify-center transition-colors shadow-2xs"
                  title="Send message"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Create / Customize Quick Prompt Modal (rendered via portal; closes only on explicit Cancel / Close / Submit) */}
      {isShortcutModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-prompt-modal-title"
          >
            <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-700 text-white flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 id="quick-prompt-modal-title" className="text-sm font-bold text-zinc-900">
                      {editingShortcut ? 'Customize Quick Prompt' : 'Create New Quick Prompt'}
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Persisted in Zilliz collection <code className="font-mono font-semibold text-indigo-700">QuickPrompt</code>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShortcutModalOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-700 rounded-md cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveShortcutForm} className="p-5 space-y-4 overflow-y-auto">
                {shortcutFormError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-[11px] text-rose-800">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{shortcutFormError}</span>
                  </div>
                )}

                {shortcutSyncInfo && shortcutSyncInfo.lastError && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start justify-between gap-2 text-[11px] text-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Zilliz QuickPrompt Notice:</span>{' '}
                        {shortcutSyncInfo.lastError}
                      </div>
                    </div>
                    {onSyncShortcuts && (
                      <button
                        type="button"
                        disabled={isSyncingZilliz}
                        onClick={async () => {
                          setIsSyncingZilliz(true);
                          try {
                            await onSyncShortcuts();
                          } finally {
                            setIsSyncingZilliz(false);
                          }
                        }}
                        className="px-2 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded text-[10px] font-semibold shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        {isSyncingZilliz ? 'Checking...' : 'Retry QuickPrompt'}
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-zinc-800 mb-1">
                    Prompt Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault();
                    }}
                    placeholder="e.g., Singapore Bunkering Rate Watch"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-800 mb-1">
                    Short Description
                  </label>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault();
                    }}
                    placeholder="Optional brief summary displayed on scenario cards"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-800 mb-1">
                    Prompt Query Text <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formQuery}
                    onChange={(e) => setFormQuery(e.target.value)}
                    placeholder="Enter the exact prompt sent to SAIL when this quick prompt is clicked..."
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-indigo-600 focus:bg-white resize-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-800 mb-1.5">
                    Icon Badge
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ICON_OPTIONS.map(({ name, label, Icon }) => {
                      const selected = formIcon === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setFormIcon(name)}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                            selected
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-800'
                              : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setIsShortcutModalOpen(false)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingShortcut || !formTitle.trim() || !formQuery.trim()}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSavingShortcut ? 'Saving...' : editingShortcut ? 'Save Changes' : 'Create Prompt'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
