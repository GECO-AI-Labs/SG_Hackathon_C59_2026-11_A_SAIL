/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header.js';
import { NewsTicker } from './components/NewsTicker.js';
import { Sidebar } from './components/Sidebar.js';
import { ChatArea } from './components/ChatArea.js';
import { DiagnosticsModal } from './components/DiagnosticsModal.js';
import { MLflowModal } from './components/MLflowModal.js';
import { Message, RSSFeedResult, SystemStatus, MLflowTrace, DiagnosticResult, AISVessel, ShippingLane, ThinkingLevel, SavedChatSummary, ShortcutPrompt, ShortcutIconName, ShortcutSyncStatus, ScenarioAssumption } from './types.js';
import { SOUTHEAST_ASIA_LANES } from './data/shippingLanes.js';
import { SEED_SCENARIOS } from './data/seedScenarios.js';

export default function App() {
  const [sessionId, setSessionId] = useState<string>(() => {
    const existing = sessionStorage.getItem('sail_session_id');
    if (existing) return existing;
    const newId = `sail-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('sail_session_id', newId);
    return newId;
  });

  const [savedChats, setSavedChats] = useState<SavedChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('Low');

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: 'I am the Maritime Intelligence Expert. I am connected to the News, AIS, Seaport, and Filling databases. How can I help you navigate shipping market complexities or fleet scenario planning in Southeast Asian and intra-Asian lanes?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'complete',
      confidenceScore: 98
    }
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sail_sidebar_width');
      if (saved) {
        const val = Number(saved);
        return Math.min(Math.floor(window.innerWidth * 0.5), Math.max(280, val));
      }
    }
    return 384;
  });
  const [activeSidebarTab, setActiveSidebarTab] = useState<'history' | 'rss' | 'vessels' | 'lanes' | 'scenarios' | 'fleet-planning' | 'scenario-strategy' | 'ref-fleet'>('history');

  // Shared Scenario Planning State between Sidebar and ScenarioPlanning workspace
  const [scenarioDataset, setScenarioDataset] = useState<ScenarioAssumption[]>(() => {
    try {
      const saved = localStorage.getItem('sail_saved_scenarios');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [...SEED_SCENARIOS, ...parsed];
        }
      }
    } catch {
      // fallback
    }
    return [...SEED_SCENARIOS];
  });

  const [activeScenario, setActiveScenario] = useState<ScenarioAssumption>(() => ({
    ...SEED_SCENARIOS[0]
  }));

  const [baselineScenario, setBaselineScenario] = useState<ScenarioAssumption>(() => ({
    ...SEED_SCENARIOS[0]
  }));

  const handleSelectScenario = useCallback((scenarioId: string) => {
    const found = scenarioDataset.find((s) => s.scenario_id === scenarioId) || scenarioDataset[0];
    const cloned = { ...found };
    setActiveScenario(cloned);
    setBaselineScenario(cloned);
  }, [scenarioDataset]);

  const handleScenarioSliderChange = useCallback((key: keyof ScenarioAssumption, val: number) => {
    setActiveScenario((prev) => ({
      ...prev,
      [key]: val
    }));
  }, []);

  const handleResetScenario = useCallback(() => {
    setActiveScenario({ ...baselineScenario });
  }, [baselineScenario]);

  const isHalfScreen = typeof window !== 'undefined' && sidebarWidth >= Math.floor(window.innerWidth * 0.48);

  const handleToggleHalfScreen = useCallback(() => {
    if (typeof window === 'undefined') return;
    const half = Math.floor(window.innerWidth * 0.5);
    if (sidebarWidth >= Math.floor(window.innerWidth * 0.48)) {
      setSidebarWidth(384);
      localStorage.setItem('sail_sidebar_width', '384');
    } else {
      setSidebarWidth(half);
      localStorage.setItem('sail_sidebar_width', String(half));
    }
  }, [sidebarWidth]);

  const handleWidthChange = useCallback((newWidth: number) => {
    if (typeof window === 'undefined') return;
    const half = Math.floor(window.innerWidth * 0.5);
    const clamped = Math.min(half, Math.max(280, newWidth));
    setSidebarWidth(clamped);
    localStorage.setItem('sail_sidebar_width', String(clamped));
  }, []);

  // Clamp sidebar width up to 50% screen width on window resize
  useEffect(() => {
    const handleResize = () => {
      const half = Math.floor(window.innerWidth * 0.5);
      setSidebarWidth((prev) => Math.min(half, Math.max(280, prev)));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Modals state
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [mlflowOpen, setMLflowOpen] = useState(false);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  // Data states
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [rssFeeds, setRssFeeds] = useState<RSSFeedResult[]>([]);
  const [vessels, setVessels] = useState<AISVessel[]>([]);
  const [lanes, setLanes] = useState<ShippingLane[]>(SOUTHEAST_ASIA_LANES);
  const [traces, setTraces] = useState<MLflowTrace[]>([]);
  const [shortcuts, setShortcuts] = useState<ShortcutPrompt[]>([]);
  const [shortcutSyncInfo, setShortcutSyncInfo] = useState<ShortcutSyncStatus | null>(null);

  // Fetch system status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setSystemStatus(data);
      }
    } catch (e) {
      console.warn('Failed to fetch status:', e);
    }
  }, []);

  // Fetch RSS feeds
  const fetchFeeds = useCallback(async () => {
    try {
      const res = await fetch('/api/rss');
      if (res.ok) {
        const data = await res.json();
        setRssFeeds(data.feeds || []);
      }
    } catch (e) {
      console.warn('Failed to fetch RSS feeds:', e);
    }
  }, []);

  // Fetch MLflow traces
  const fetchTraces = useCallback(async () => {
    try {
      const res = await fetch('/api/traces');
      if (res.ok) {
        const data = await res.json();
        setTraces(data.traces || []);
      }
    } catch (e) {
      console.warn('Failed to fetch traces:', e);
    }
  }, []);

  // Fetch AIS 199 Vessels
  const fetchVessels = useCallback(async () => {
    try {
      const res = await fetch('/api/vessels');
      if (res.ok) {
        const data = await res.json();
        setVessels(data.vessels || []);
      }
    } catch (e) {
      console.warn('Failed to fetch vessels:', e);
    }
  }, []);

  // Fetch Southeast Asia Shipping Lanes
  const fetchLanes = useCallback(async () => {
    try {
      const res = await fetch('/api/lanes');
      if (res.ok) {
        const data = await res.json();
        if (data.lanes && Array.isArray(data.lanes) && data.lanes.length > 0) {
          setLanes(data.lanes);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch shipping lanes:', e);
    }
  }, []);

  // Fetch saved chat sessions from Zilliz / backend
  const fetchSavedChats = useCallback(async (): Promise<SavedChatSummary[]> => {
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        const data = await res.json();
        const list: SavedChatSummary[] = data.chats || [];
        setSavedChats(list);
        return list;
      }
    } catch (e) {
      console.warn('Failed to fetch saved chats from Zilliz:', e);
    }
    return [];
  }, []);

  // On app startup, read Zilliz for saved chats and restore active session or latest saved chat
  useEffect(() => {
    const restoreInitialSession = async () => {
      const chatsList = await fetchSavedChats();
      const storedSessionId = sessionStorage.getItem('sail_session_id');

      let targetSessionId = storedSessionId;
      // If no session ID in storage, default to the most recent saved chat thread read from Zilliz
      if (!targetSessionId && chatsList.length > 0) {
        targetSessionId = chatsList[0].id;
      }

      if (targetSessionId) {
        try {
          const res = await fetch(`/api/chats/${targetSessionId}`);
          if (res.ok) {
            const chat = await res.json();
            if (chat && Array.isArray(chat.messages) && chat.messages.length > 0) {
              setMessages(chat.messages);
              setSessionId(chat.id);
              setActiveChatId(chat.id);
              sessionStorage.setItem('sail_session_id', chat.id);
              return;
            }
          }
        } catch (err) {
          console.warn('Failed to restore initial session:', err);
        }
      }

      // Fallback: If target session not found but other saved chats exist in Zilliz
      if (storedSessionId && chatsList.length > 0) {
        const fallbackId = chatsList[0].id;
        try {
          const res = await fetch(`/api/chats/${fallbackId}`);
          if (res.ok) {
            const chat = await res.json();
            if (chat && Array.isArray(chat.messages) && chat.messages.length > 0) {
              setMessages(chat.messages);
              setSessionId(chat.id);
              setActiveChatId(chat.id);
              sessionStorage.setItem('sail_session_id', chat.id);
            }
          }
        } catch (err) {
          console.warn('Failed to restore fallback Zilliz session:', err);
        }
      }
    };

    const fetchShortcuts = async () => {
      try {
        const res = await fetch('/api/shortcuts');
        if (res.ok) {
          const data = await res.json();
          setShortcuts(data.shortcuts || []);
          if (data.zillizStatus) {
            setShortcutSyncInfo(data.zillizStatus);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch quick prompt shortcuts:', err);
      }
    };

    const initAndCheckPendingBrief = async () => {
      await restoreInitialSession();
      try {
        const raw = localStorage.getItem('sail_pending_copilot_prompt');
        if (raw) {
          localStorage.removeItem('sail_pending_copilot_prompt');
          const parsed = JSON.parse(raw);
          if (
            parsed &&
            parsed.type === 'ASK_COPILOT_BRIEF' &&
            typeof parsed.prompt === 'string' &&
            parsed.prompt.trim().length > 0 &&
            (!parsed.timestamp || Date.now() - Number(parsed.timestamp) < 60000)
          ) {
            const reqId = parsed.requestId || `init-${Date.now()}`;
            if (!processedBriefIdsRef.current.has(reqId)) {
              processedBriefIdsRef.current.add(reqId);
              handleSendMessageRef.current(parsed.prompt);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to process pending Copilot brief prompt:', err);
      }
    };

    fetchStatus();
    fetchFeeds();
    fetchTraces();
    fetchVessels();
    fetchLanes();
    fetchShortcuts();
    initAndCheckPendingBrief();
  }, [fetchStatus, fetchFeeds, fetchTraces, fetchVessels, fetchLanes, fetchSavedChats]);

  // Keyboard trigger: Control-X (or Cmd-X) toggles the Execution Tracing & Observability modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+X or Cmd+X (case-insensitive)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        const activeEl = document.activeElement;
        const isInputOrTextarea =
          activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;

        // If the user is currently editing text inside an input or textarea and has selected text,
        // preserve standard clipboard cut behavior. Otherwise, toggle Execution Traces!
        if (isInputOrTextarea) {
          const hasSelection =
            activeEl.selectionStart !== null &&
            activeEl.selectionEnd !== null &&
            activeEl.selectionStart !== activeEl.selectionEnd;
          if (hasSelection) {
            return;
          }
        }

        e.preventDefault();
        setSelectedTraceId(null);
        setMLflowOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // New Chat Action
  const handleNewChat = useCallback(() => {
    const newId = `sail-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setSessionId(newId);
    sessionStorage.setItem('sail_session_id', newId);
    setActiveChatId(null);
    setMessages([
      {
        id: 'welcome-msg',
        role: 'assistant',
        content: 'I am the Maritime Intelligence Expert. I am connected to the News, AIS, Seaport, and Filling databases. How can I help you navigate shipping market complexities or fleet scenario planning in Southeast Asian and intra-Asian lanes?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'complete',
        confidenceScore: 98
      }
    ]);
  }, []);

  // Select a saved chat from sidebar
  const handleSelectChat = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}`);
      if (res.ok) {
        const chat = await res.json();
        if (chat && Array.isArray(chat.messages) && chat.messages.length > 0) {
          setMessages(chat.messages);
          setSessionId(chat.id);
          sessionStorage.setItem('sail_session_id', chat.id);
          setActiveChatId(chat.id);
        }
      }
    } catch (err) {
      console.warn('Failed to select chat:', err);
    }
  }, []);

  // Rename a saved chat
  const handleRenameChat = useCallback(async (chatId: string, newTitle: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      if (res.ok) {
        await fetchSavedChats();
      }
    } catch (err) {
      console.warn('Failed to rename chat:', err);
    }
  }, [fetchSavedChats]);

  // Delete a saved chat
  const handleDeleteChat = useCallback(async (chatId: string) => {
    // 1. Optimistic UI update: remove immediately from sidebar state so user sees instant response
    setSavedChats(prev => prev.filter(c => c.id !== chatId));

    // 2. If deleting the current active session, transition immediately to a fresh chat
    if (sessionId === chatId || activeChatId === chatId) {
      handleNewChat();
    }

    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        console.warn(`[chatStore] Server returned HTTP ${res.status} when deleting chat ${chatId}`);
      }
      // Re-fetch to synchronize state
      await fetchSavedChats();
    } catch (err) {
      console.warn('Failed to delete chat:', err);
      // Revert/refresh on failure
      await fetchSavedChats();
    }
  }, [sessionId, activeChatId, handleNewChat, fetchSavedChats]);

  // Quick Prompt Shortcuts CRUD handlers (persisted to Zilliz 'QuickPrompt' collection)
  const refreshShortcuts = useCallback(async (forceZillizSync = false) => {
    try {
      const url = forceZillizSync ? '/api/shortcuts/sync-zilliz' : '/api/shortcuts';
      const res = await fetch(url, forceZillizSync ? { method: 'POST' } : undefined);
      if (res.ok) {
        const data = await res.json();
        setShortcuts(data.shortcuts || []);
        if (data.zillizStatus) {
          setShortcutSyncInfo(data.zillizStatus);
        }
      }
    } catch (err) {
      console.warn('Failed to refresh quick prompts:', err);
    }
  }, []);

  const handleCreateShortcut = useCallback(async (input: { title: string; desc: string; query: string; icon: ShortcutIconName }) => {
    const res = await fetch('/api/shortcuts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.shortcut) {
        setShortcuts(prev => [...prev, data.shortcut]);
      }
      if (data.zillizStatus) {
        setShortcutSyncInfo(data.zillizStatus);
      } else {
        setShortcutSyncInfo({
          zillizAvailable: Boolean(data.zillizSynced),
          lastError: data.zillizError || null
        });
      }
    } else {
      await refreshShortcuts();
    }
  }, [refreshShortcuts]);

  const handleUpdateShortcut = useCallback(async (id: string, input: { title: string; desc: string; query: string; icon: ShortcutIconName }) => {
    const res = await fetch(`/api/shortcuts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.shortcut) {
        setShortcuts(prev => prev.map(s => (s.id === id ? data.shortcut : s)));
      }
      if (data.zillizStatus) {
        setShortcutSyncInfo(data.zillizStatus);
      } else {
        setShortcutSyncInfo({
          zillizAvailable: Boolean(data.zillizSynced),
          lastError: data.zillizError || null
        });
      }
    } else {
      await refreshShortcuts();
    }
  }, [refreshShortcuts]);

  const handleDeleteShortcut = useCallback(async (id: string) => {
    setShortcuts(prev => prev.filter(s => s.id !== id));
    try {
      const res = await fetch(`/api/shortcuts/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.zillizStatus) {
          setShortcutSyncInfo(data.zillizStatus);
        } else {
          setShortcutSyncInfo({
            zillizAvailable: Boolean(data.zillizSynced),
            lastError: data.zillizError || null
          });
        }
      }
      await refreshShortcuts();
    } catch (err) {
      console.warn('Failed to delete quick prompt:', err);
      await refreshShortcuts();
    }
  }, [refreshShortcuts]);

  const handleSyncShortcuts = useCallback(async () => {
    await refreshShortcuts(true);
  }, [refreshShortcuts]);

  // Subscribe to RSS feed
  const handleSubscribeFeed = async (url: string) => {
    const res = await fetch('/api/rss/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!res.ok) throw new Error('Failed to subscribe');
    await fetchFeeds();
  };

  // Unsubscribe from RSS feed
  const handleUnsubscribeFeed = async (url: string) => {
    const res = await fetch('/api/rss/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!res.ok) throw new Error('Failed to unsubscribe');
    await fetchFeeds();
  };

  // Run deep diagnostics
  const handleRunDiagnostics = async (): Promise<DiagnosticResult> => {
    const res = await fetch('/api/diagnostics', { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    await fetchStatus();
    return data;
  };

  // Clear conversation
  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-msg',
        role: 'assistant',
        content: 'I am the Maritime Intelligence Expert. I am connected to the News, AIS, Seaport, and Filling databases. How can I help you navigate shipping market complexities or fleet scenario planning in Southeast Asian and intra-Asian lanes?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'complete',
        confidenceScore: 98
      }
    ]);
  };

  // Open trace in modal
  const handleOpenTrace = (traceId: string) => {
    setSelectedTraceId(traceId);
    setMLflowOpen(true);
    fetchTraces();
  };

  // Streaming Chat Submission
  const handleSendMessage = async (userPrompt: string) => {
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage: Message = {
      id: userMsgId,
      role: 'user',
      content: userPrompt,
      timestamp: nowTime
    };

    const initialAssistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: nowTime,
      status: 'retrieving',
      statusMessage: 'AI Agent is planning'
    };

    let currentAssistantMessage: Message = { ...initialAssistantMessage };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt, sessionId, thinkingLevel })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No readable response body stream received.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.replace('data: ', '').trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'status') {
              currentAssistantMessage.status = event.stage;
              currentAssistantMessage.statusMessage = event.message;
            } else if (event.type === 'topics') {
              currentAssistantMessage.searchTopics = event.topics;
              currentAssistantMessage.statusMessage = event.message;
            } else if (event.type === 'retrievals') {
              currentAssistantMessage.retrievals = event.retrievals;
              currentAssistantMessage.statusMessage = event.message;
            } else if (event.type === 'chunk') {
              currentAssistantMessage.status = 'synthesizing';
              currentAssistantMessage.content += (event.chunk || '');
            } else if (event.type === 'done') {
              currentAssistantMessage.status = 'complete';
              currentAssistantMessage.traceId = event.traceId;
              currentAssistantMessage.confidenceScore = event.confidenceScore;
              currentAssistantMessage.durationMs = event.totalDurationMs;
            } else if (event.type === 'error') {
              currentAssistantMessage.status = 'error';
              currentAssistantMessage.content += `\n\n⚠️ Error during processing: ${event.message}`;
              currentAssistantMessage.traceId = event.traceId;
            }

            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;

                if (event.type === 'status') {
                  return {
                    ...m,
                    status: event.stage,
                    statusMessage: event.message
                  };
                }

                if (event.type === 'topics') {
                  return {
                    ...m,
                    searchTopics: event.topics,
                    statusMessage: event.message
                  };
                }

                if (event.type === 'retrievals') {
                  return {
                    ...m,
                    retrievals: event.retrievals,
                    statusMessage: event.message
                  };
                }

                if (event.type === 'chunk') {
                  return {
                    ...m,
                    status: 'synthesizing',
                    content: m.content + (event.chunk || '')
                  };
                }

                if (event.type === 'done') {
                  return {
                    ...m,
                    status: 'complete',
                    traceId: event.traceId,
                    confidenceScore: event.confidenceScore,
                    durationMs: event.totalDurationMs
                  };
                }

                if (event.type === 'error') {
                  return {
                    ...m,
                    status: 'error',
                    content: m.content + `\n\n⚠️ Error during processing: ${event.message}`,
                    traceId: event.traceId
                  };
                }

                return m;
              })
            );
          } catch (parseErr) {
            console.warn('Error parsing SSE event:', parseErr);
          }
        }
      }

      // Re-fetch traces on completion so count updates
      fetchTraces();
      fetchStatus();

      // Auto-serialize conversation history into chatStore & Zilliz ChatHistory collection
      try {
        const fullMessagesToSave = [...messages, userMessage, currentAssistantMessage];
        const saveRes = await fetch('/api/chats/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            messages: fullMessagesToSave
          })
        });
        if (saveRes.ok) {
          setActiveChatId(sessionId);
          await fetchSavedChats();
        }
      } catch (saveErr) {
        console.warn('Failed to auto-save chat session:', saveErr);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      currentAssistantMessage.status = 'error';
      currentAssistantMessage.content = `⚠️ Error communicating with SAIL backend: ${errorMsg}`;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                status: 'error',
                content: `⚠️ Error communicating with SAIL backend: ${errorMsg}`
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const processedBriefIdsRef = useRef<Set<string>>(new Set());
  const handleSendMessageRef = useRef(handleSendMessage);
  handleSendMessageRef.current = handleSendMessage;

  // Listen for "Ask Copilot" from the Scenario Planning HTML page (via 1s polling, SSE, BroadcastChannel, postMessage, or storage event)
  useEffect(() => {
    let channel: BroadcastChannel | null = null;

    const processBriefPayload = (data: unknown) => {
      if (!data || typeof data !== 'object') return;
      const payload = data as {
        type?: string;
        requestId?: string;
        prompt?: string;
        timestamp?: number;
      };
      if (payload.type !== 'ASK_COPILOT_BRIEF' || typeof payload.prompt !== 'string' || !payload.prompt.trim()) {
        return;
      }

      const reqId = payload.requestId || `msg-${payload.timestamp || Date.now()}`;
      if (processedBriefIdsRef.current.has(reqId)) {
        return;
      }

      processedBriefIdsRef.current.add(reqId);
      try {
        localStorage.removeItem('sail_pending_copilot_prompt');
      } catch {
        // ignore
      }

      // Acknowledge receipt to the backend so the Scenario Planning tab shows live confirmation
      fetch('/api/copilot/brief-ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: reqId })
      }).catch(() => {});

      if (channel) {
        try {
          channel.postMessage({ type: 'ASK_COPILOT_ACK', requestId: reqId });
        } catch {
          // ignore
        }
      }

      // Switch to Maritime Assistant view and immediately submit the brief as a user prompt
      setActiveSidebarTab('history');
      handleSendMessageRef.current(payload.prompt);
    };

    const checkPendingFromServer = async () => {
      try {
        const res = await fetch('/api/copilot/brief-pending', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.pending) {
            processBriefPayload(data.pending);
          }
        }
      } catch {
        // ignore network hiccups
      }
    };

    // Poll every 1000ms so even if Cloud Run buffers SSE or storage is partitioned across iframe/tab,
    // the original Maritime Assistant webapp picks up the Strategy Brief within <= 1 second.
    checkPendingFromServer();
    const pollInterval = setInterval(checkPendingFromServer, 1000);

    // 1. Server-Sent Events (SSE) relay from /api/copilot/brief-events
    let eventSource: EventSource | null = null;
    try {
      if (typeof EventSource !== 'undefined') {
        eventSource = new EventSource('/api/copilot/brief-events');
        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            processBriefPayload(parsed);
          } catch {
            // ignore
          }
        };
      }
    } catch (e) {
      console.warn('EventSource setup for copilot brief failed:', e);
    }

    // 2. BroadcastChannel for same-partition tabs
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('sail_copilot_channel');
        channel.onmessage = (event) => {
          processBriefPayload(event.data);
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel setup failed:', e);
    }

    const handleWindowMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      processBriefPayload(event.data);
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === 'sail_pending_copilot_prompt' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          processBriefPayload(parsed);
        } catch {
          // ignore
        }
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkPendingFromServer();
      }
    };

    window.addEventListener('message', handleWindowMessage);
    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('message', handleWindowMessage);
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      if (eventSource) {
        try {
          eventSource.close();
        } catch {
          // ignore
        }
      }
      if (channel) {
        try {
          channel.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return (
    <div className="h-screen bg-zinc-50 flex flex-col font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden">
      {/* Top Application Header */}
      <Header
        status={systemStatus}
        onOpenDiagnostics={() => setDiagnosticsOpen(true)}
        onOpenMLflow={() => {
          setSelectedTraceId(null);
          setMLflowOpen(true);
        }}
        onToggleSidebar={() => setSidebarMinimized(!sidebarMinimized)}
        sidebarMinimized={sidebarMinimized}
        activeTab={activeSidebarTab}
        onTabChange={setActiveSidebarTab}
      />

      {/* Live Breaking News Reader Ticker Bar */}
      <NewsTicker
        feeds={rssFeeds}
        onSelectHeadline={handleSendMessage}
      />

      {/* Main Work Surface */}
      <div className="flex-1 flex overflow-hidden">
        {/* Maritime Intelligence Sidebar with Minimize & Expand-to-Half-Screen capability */}
        <Sidebar
          isMinimized={sidebarMinimized}
          onToggleMinimize={() => setSidebarMinimized(!sidebarMinimized)}
          sidebarWidth={sidebarWidth}
          onWidthChange={handleWidthChange}
          isHalfScreen={isHalfScreen}
          onToggleHalfScreen={handleToggleHalfScreen}
          activeTab={activeSidebarTab}
          onTabChange={setActiveSidebarTab}
          savedChats={savedChats}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onRenameChat={handleRenameChat}
          onDeleteChat={handleDeleteChat}
          feeds={rssFeeds}
          vessels={vessels}
          lanes={lanes}
          onSubscribeFeed={handleSubscribeFeed}
          onUnsubscribeFeed={handleUnsubscribeFeed}
          onRefreshFeeds={fetchFeeds}
          onSelectPrompt={handleSendMessage}
          onUpdateVessels={setVessels}
          status={systemStatus}
          activeScenario={activeScenario}
          scenarioDataset={scenarioDataset}
          onScenarioSliderChange={handleScenarioSliderChange}
          onScenarioSelect={handleSelectScenario}
          onScenarioReset={handleResetScenario}
        />

        {/* Center Workspace: Copilot Chat Area */}
        <ChatArea
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          onClearChat={handleClearChat}
          onNewChat={handleNewChat}
          onOpenTrace={handleOpenTrace}
          thinkingLevel={thinkingLevel}
          onThinkingLevelChange={setThinkingLevel}
          shortcuts={shortcuts}
          shortcutSyncInfo={shortcutSyncInfo}
          onCreateShortcut={handleCreateShortcut}
          onUpdateShortcut={handleUpdateShortcut}
          onDeleteShortcut={handleDeleteShortcut}
          onSyncShortcuts={handleSyncShortcuts}
        />
      </div>

      {/* 4-Phase System Diagnostics Modal */}
      <DiagnosticsModal
        isOpen={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        onRunDiagnostics={handleRunDiagnostics}
      />

      {/* MLflow Traces & Spans Modal */}
      <MLflowModal
        isOpen={mlflowOpen}
        onClose={() => {
          setMLflowOpen(false);
          setSelectedTraceId(null);
        }}
        traces={traces}
        selectedTraceId={selectedTraceId}
      />
    </div>
  );
}
