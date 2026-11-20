/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Newspaper, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Ship, 
  Send, 
  RefreshCw, 
  PanelLeftClose, 
  PanelLeftOpen,
  ChevronRight,
  Search,
  Route,
  MapPin,
  AlertTriangle,
  Anchor,
  Gauge,
  ChevronDown,
  SlidersHorizontal,
  Sliders,
  RotateCcw,
  ArrowUpRight,
  Layers,
  Sparkles,
  Calculator,
  Maximize2,
  Minimize2,
  MessageSquare,
  Pencil,
  Check,
  X,
  Compass
} from 'lucide-react';
import { RSSFeedResult, SystemStatus, AISVessel, ShippingLane, SavedChatSummary, ScenarioAssumption } from '../types.js';
import { SOUTHEAST_ASIA_LANES } from '../data/shippingLanes.js';
import { SEED_SCENARIOS, SLIDER_SPECS, calculateScenario, formatNumber, formatMoney, num } from '../data/seedScenarios.js';

interface SidebarProps {
  isMinimized: boolean;
  onToggleMinimize: () => void;
  sidebarWidth?: number;
  onWidthChange?: (width: number) => void;
  isHalfScreen?: boolean;
  onToggleHalfScreen?: () => void;
  activeTab: 'history' | 'rss' | 'vessels' | 'lanes' | 'scenarios' | 'fleet-planning' | 'scenario-strategy' | 'ref-fleet';
  onTabChange: (tab: 'history' | 'rss' | 'vessels' | 'lanes' | 'scenarios' | 'fleet-planning' | 'scenario-strategy' | 'ref-fleet') => void;
  savedChats?: SavedChatSummary[];
  activeChatId?: string | null;
  onSelectChat?: (chatId: string) => void;
  onNewChat?: () => void;
  onRenameChat?: (chatId: string, newTitle: string) => Promise<void>;
  onDeleteChat?: (chatId: string) => Promise<void>;
  feeds: RSSFeedResult[];
  vessels: AISVessel[];
  lanes?: ShippingLane[];
  onSubscribeFeed: (url: string) => Promise<void>;
  onUnsubscribeFeed: (url: string) => Promise<void>;
  onRefreshFeeds: () => Promise<void>;
  onSelectPrompt: (prompt: string) => void;
  onUpdateVessels?: (newVessels: AISVessel[]) => void;
  status: SystemStatus | null;
  // Shared Scenario Planning Props
  activeScenario?: ScenarioAssumption;
  onScenarioSliderChange?: (key: keyof ScenarioAssumption, val: number) => void;
  onScenarioSelect?: (id: string) => void;
  onScenarioReset?: () => void;
  scenarioDataset?: ScenarioAssumption[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isMinimized,
  onToggleMinimize,
  sidebarWidth = 384,
  onWidthChange,
  isHalfScreen = false,
  onToggleHalfScreen,
  activeTab,
  onTabChange,
  savedChats = [],
  activeChatId = null,
  onSelectChat,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  feeds,
  vessels,
  lanes = SOUTHEAST_ASIA_LANES,
  onSubscribeFeed,
  onUnsubscribeFeed,
  onRefreshFeeds,
  onSelectPrompt,
  onUpdateVessels,
  activeScenario,
  onScenarioSliderChange,
  onScenarioSelect,
  onScenarioReset,
  scenarioDataset
}) => {
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedMessage, setFeedMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Vessel search and filter state
  const [vesselSearch, setVesselSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'stopped' | '0-5kn' | '5.1-10kn' | '10.1-20kn' | '20.1-50kn'>('all');

  // Chat History state
  const [chatSearch, setChatSearch] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [confirmDeleteChatId, setConfirmDeleteChatId] = useState<string | null>(null);

  // Filter saved chats by title, preview, or previous user queries
  const filteredChats = useMemo(() => {
    if (!chatSearch.trim()) return savedChats;
    const q = chatSearch.toLowerCase().trim();
    return savedChats.filter(c => {
      const titleMatch = c.title.toLowerCase().includes(q);
      const previewMatch = c.preview?.toLowerCase().includes(q);
      const queryMatch = c.userQueries?.some(query => query.toLowerCase().includes(q));
      return Boolean(titleMatch || previewMatch || queryMatch);
    });
  }, [savedChats, chatSearch]);

  // Shipping Lane search and filter state
  const [laneSearch, setLaneSearch] = useState('');
  const [laneTypeFilter, setLaneTypeFilter] = useState<string>('all');
  const [expandedLaneId, setExpandedLaneId] = useState<string | null>('sea-malacca-singapore');

  // Scenario Assumptions: Connected to active scenario in Scenario Planning window
  const effectiveScenario = activeScenario || SEED_SCENARIOS[0];
  const scenariosList = scenarioDataset && scenarioDataset.length > 0 ? scenarioDataset : SEED_SCENARIOS;

  const handleSidebarSelectScenario = (id: string) => {
    if (onScenarioSelect) {
      onScenarioSelect(id);
    }
  };

  const handleSidebarSliderChange = (key: keyof ScenarioAssumption, val: number) => {
    if (onScenarioSliderChange) {
      onScenarioSliderChange(key, val);
    }
  };

  const handleSidebarReset = () => {
    if (onScenarioReset) {
      onScenarioReset();
    }
  };

  // Sidebar drag-to-resize state (up to half screen)
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!onWidthChange) return;
    setIsResizing(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const halfScreen = Math.floor(window.innerWidth * 0.5);
      const newWidth = Math.min(halfScreen, Math.max(280, moveEvent.clientX));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Fleet Planning & Scenario Strategy embedded viewer toggles
  const [showEmbeddedViewer, setShowEmbeddedViewer] = useState(false);
  const [showStrategyEmbeddedViewer, setShowStrategyEmbeddedViewer] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedUrl.trim()) return;
    setIsSubscribing(true);
    setFeedMessage(null);
    try {
      await onSubscribeFeed(newFeedUrl.trim());
      setFeedMessage({ text: 'Feed subscribed successfully!', type: 'success' });
      setNewFeedUrl('');
    } catch {
      setFeedMessage({ text: 'Failed to subscribe to feed.', type: 'error' });
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshFeeds();
    setIsRefreshing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateVessels) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      try {
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 2) return;
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const newVessels: AISVessel[] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(val => val.trim().replace(/^"|"$/g, ''));
          const vessel: Record<string, any> = {};
          headers.forEach((h, idx) => {
            vessel[h] = row[idx] ?? '';
          });
          if (vessel.MMSI || vessel.VesselName) {
            newVessels.push({
              MMSI: vessel.MMSI || `MMSI-${i}`,
              VesselName: vessel.VesselName || vessel.Name || `Vessel ${i}`,
              LAT: vessel.LAT || vessel.Latitude || '1.29',
              LON: vessel.LON || vessel.Longitude || '103.85',
              SOG: vessel.SOG || vessel.Speed || '12.0',
              COG: vessel.COG || '180',
              Heading: vessel.Heading || '180',
              Status: vessel.Status || 'Underway',
              Speed_Category: vessel.Speed_Category || 'Underway',
              Length: vessel.Length || '180',
              Width: vessel.Width || '30',
              Draft: vessel.Draft || '10.5',
              Cargo: vessel.Cargo || 'Container',
              ...vessel
            } as AISVessel);
          }
        }
        if (newVessels.length > 0) {
          onUpdateVessels(newVessels);
        }
      } catch (err) {
        console.warn('Failed to parse uploaded fleet CSV:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filter 199 vessels in real-time
  const filteredVessels = useMemo(() => {
    return vessels.filter((vessel) => {
      // Status / Speed range filter
      if (statusFilter !== 'all') {
        const sog = Number(vessel.SOG ?? (vessel as any).Speed ?? 0);
        const cat = (vessel.Speed_Category || '').toLowerCase();
        if (statusFilter === 'stopped') {
          if (sog > 0.5 && !cat.includes('stopped')) return false;
        } else if (statusFilter === '0-5kn') {
          if (sog < 0 || sog > 5.0) return false;
        } else if (statusFilter === '5.1-10kn') {
          if (sog < 5.1 || sog > 10.0) return false;
        } else if (statusFilter === '10.1-20kn') {
          if (sog < 10.1 || sog > 20.0) return false;
        } else if (statusFilter === '20.1-50kn') {
          if (sog < 20.1 || sog > 50.0) return false;
        }
      }

      // Search query
      if (!vesselSearch.trim()) return true;
      const q = vesselSearch.toLowerCase().trim();
      const name = (vessel.VesselName || '').toLowerCase();
      const mmsi = String(vessel.MMSI || '').toLowerCase();
      const speedCat = (vessel.Speed_Category || '').toLowerCase();
      const cargo = String(vessel.Cargo || '').toLowerCase();
      const callSign = (vessel.CallSign || '').toLowerCase();

      return name.includes(q) || mmsi.includes(q) || speedCat.includes(q) || cargo.includes(q) || callSign.includes(q);
    });
  }, [vessels, vesselSearch, statusFilter]);

  // Filter Southeast Asian Shipping Lanes
  const filteredLanes = useMemo(() => {
    return lanes.filter((lane) => {
      // Type filter
      if (laneTypeFilter !== 'all' && lane.type !== laneTypeFilter) {
        return false;
      }

      // Search filter
      if (!laneSearch.trim()) return true;
      const q = laneSearch.toLowerCase().trim();
      const name = lane.name.toLowerCase();
      const code = lane.code.toLowerCase();
      const ports = lane.primaryPorts.join(' ').toLowerCase();
      const desc = lane.description.toLowerCase();
      const vessels = lane.dominantVessels.toLowerCase();
      const hazards = lane.keyHazards.toLowerCase();

      return name.includes(q) || code.includes(q) || ports.includes(q) || desc.includes(q) || vessels.includes(q) || hazards.includes(q);
    });
  }, [lanes, laneSearch, laneTypeFilter]);

  // If sidebar is in MINIMIZED rail mode
  if (isMinimized) {
    return (
      <aside className="w-14 bg-white border-r border-zinc-200 flex flex-col items-center py-3 h-full shrink-0 z-20 shadow-2xs select-none">
        {/* Expand Trigger */}
        <button
          onClick={onToggleMinimize}
          className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors mb-4 cursor-pointer"
          title="Expand Maritime Sidebar"
        >
          <PanelLeftOpen className="w-5 h-5 text-indigo-700" />
        </button>

        {/* Rail Vertical Icons */}
        <div className="flex flex-col gap-3 flex-1">
          {/* 0. Chat History Tab */}
          <button
            onClick={() => {
              onTabChange('history');
              onToggleMinimize();
            }}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center relative cursor-pointer ${
              activeTab === 'history'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
            title={`Chat History (${savedChats.length} saved chats)`}
          >
            <MessageSquare className="w-4.5 h-4.5" />
            {savedChats.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-700 text-white text-[9px] font-bold flex items-center justify-center">
                {savedChats.length}
              </span>
            )}
          </button>

          {/* 1. RSS Feeds Tab */}
          <button
            onClick={() => {
              onTabChange('rss');
              onToggleMinimize();
            }}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center relative cursor-pointer ${
              activeTab === 'rss'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
            title="Maritime RSS News Feeds"
          >
            <Newspaper className="w-4.5 h-4.5" />
            {feeds.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-700 text-white text-[9px] font-bold flex items-center justify-center">
                {feeds.length}
              </span>
            )}
          </button>

          {/* 2. AIS Monitored Fleet Tab */}
          <button
            onClick={() => {
              onTabChange('vessels');
              onToggleMinimize();
            }}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center relative cursor-pointer ${
              activeTab === 'vessels'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
            title={`AIS Monitored Fleet (${vessels.length || 199} Vessels)`}
          >
            <Ship className="w-4.5 h-4.5" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-700 text-white text-[9px] font-bold flex items-center justify-center">
              {vessels.length || 199}
            </span>
          </button>

          {/* 3. Southeast Asia Shipping Lanes Tab */}
          <button
            onClick={() => {
              onTabChange('lanes');
              onToggleMinimize();
            }}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center relative cursor-pointer ${
              activeTab === 'lanes'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
            title={`Southeast Asia Shipping Lanes (${lanes.length} Corridors)`}
          >
            <Route className="w-4.5 h-4.5" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-700 text-white text-[9px] font-bold flex items-center justify-center">
              {lanes.length}
            </span>
          </button>

          {/* 4. Fleet Planning Suite (fleetplanning.ai.studio) */}
          <button
            onClick={() => {
              onTabChange('fleet-planning');
              onToggleMinimize();
            }}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center relative cursor-pointer ${
              activeTab === 'fleet-planning'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
            title="Fleet Dashboard"
          >
            <SlidersHorizontal className="w-4.5 h-4.5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
          </button>

          {/* 5. Scenario Strategy Category (SAIL Scenario Planning Web App) */}
          <button
            onClick={() => {
              onTabChange('scenario-strategy');
              onToggleMinimize();
            }}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center relative cursor-pointer ${
              activeTab === 'scenario-strategy'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
            title="Scenario Planning · SAIL Scenario Planning"
          >
            <Layers className="w-4.5 h-4.5 text-indigo-700" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
          </button>

          {/* 6. Ref Fleet Category */}
          <button
            onClick={() => {
              onTabChange('ref-fleet');
              onToggleMinimize();
            }}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center relative cursor-pointer ${
              activeTab === 'ref-fleet'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
            title="Ref Fleet · External Reference Fleet Dashboards"
          >
            <Anchor className="w-4.5 h-4.5 text-indigo-700" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-700 text-white text-[9px] font-bold flex items-center justify-center">
              2
            </span>
          </button>
        </div>

        {/* Bottom Expand Arrow */}
        <button
          onClick={onToggleMinimize}
          className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
          title="Expand Sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  // EXPANDED SIDEBAR MODE
  return (
    <aside
      style={{
        width: isMinimized ? undefined : `${sidebarWidth}px`,
        maxWidth: '50vw'
      }}
      className={`relative bg-white border-r border-zinc-200 flex flex-col h-full shrink-0 z-20 overflow-hidden shadow-2xs ${
        isResizing ? 'select-none transition-none' : 'transition-all duration-150'
      }`}
    >
      {/* Draggable Resizer Handle on right border (expand up to half screen) */}
      <div
        onMouseDown={startResizing}
        onDoubleClick={onToggleHalfScreen}
        className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-indigo-500/30 active:bg-indigo-600 transition-colors select-none z-30 group flex items-center justify-center"
        title="Drag to resize sidebar (expand up to half screen) · Double-click to toggle half screen"
      >
        <div className="w-0.5 h-10 bg-zinc-300 group-hover:bg-indigo-600 rounded-full transition-colors opacity-0 group-hover:opacity-100" />
      </div>

      {/* Top Controls: 7 Categories (Chats, RSS, Fleet, Lanes, Dashboard, Scenario Planning, Scenario Strategy) + Expand/Minimize Buttons */}
      <div className="p-2 border-b border-zinc-200 bg-zinc-50 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-1">
          <div className="grid grid-cols-4 gap-1 flex-1 min-w-0">
            <button
              onClick={() => onTabChange('history')}
              className={`py-1 px-1.5 rounded-lg text-[10.5px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer truncate ${
                activeTab === 'history'
                  ? 'bg-white text-zinc-900 border border-zinc-200 shadow-2xs font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title={`Chat History (${savedChats.length} saved chats)`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
              <span className="truncate">Chats</span>
            </button>

            <button
              onClick={() => onTabChange('rss')}
              className={`py-1 px-1.5 rounded-lg text-[10.5px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer truncate ${
                activeTab === 'rss'
                  ? 'bg-white text-zinc-900 border border-zinc-200 shadow-2xs font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Maritime RSS News Feeds"
            >
              <Newspaper className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
              <span className="truncate">RSS</span>
            </button>

            <button
              onClick={() => onTabChange('vessels')}
              className={`py-1 px-1.5 rounded-lg text-[10.5px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer truncate ${
                activeTab === 'vessels'
                  ? 'bg-white text-zinc-900 border border-zinc-200 shadow-2xs font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="AIS Monitored Fleet (199 Vessels)"
            >
              <Ship className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
              <span className="truncate">Fleet</span>
            </button>

            <button
              onClick={() => onTabChange('lanes')}
              className={`py-1 px-1.5 rounded-lg text-[10.5px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer truncate ${
                activeTab === 'lanes'
                  ? 'bg-white text-zinc-900 border border-zinc-200 shadow-2xs font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Southeast Asia Shipping Lanes"
            >
              <Route className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
              <span className="truncate">Lanes</span>
            </button>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {/* Expand to Half Screen / Restore Width Toggle */}
            {onToggleHalfScreen && (
              <button
                onClick={onToggleHalfScreen}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isHalfScreen
                    ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200'
                }`}
                title={isHalfScreen ? "Restore standard width (384px)" : "Expand sidebar to half screen (50%)"}
                aria-label={isHalfScreen ? "Restore standard width" : "Expand to half screen"}
              >
                {isHalfScreen ? (
                  <Minimize2 className="w-4 h-4 text-indigo-700" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-zinc-600" />
                )}
              </button>
            )}

            {/* Minimize Button */}
            <button
              onClick={onToggleMinimize}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
              title="Minimize sidebar to icon rail"
              aria-label="Minimize sidebar"
            >
              <PanelLeftClose className="w-4 h-4 text-zinc-600" />
            </button>
          </div>
        </div>

        {/* Row 2: Planning, Strategy & Reference Fleet Suites (Dashboard, Scenario Strategy, Ref Fleet) */}
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => onTabChange('fleet-planning')}
            className={`py-1 px-1.5 rounded-lg text-[10.5px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer truncate ${
              activeTab === 'fleet-planning'
                ? 'bg-white text-indigo-700 border border-indigo-200 shadow-2xs font-bold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
            title="Fleet Dashboard"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
            <span className="truncate">Dashboard</span>
          </button>

          <button
            onClick={() => onTabChange('scenario-strategy')}
            className={`py-1 px-1.5 rounded-lg text-[10.5px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer truncate ${
              activeTab === 'scenario-strategy'
                ? 'bg-white text-indigo-950 border border-indigo-200 shadow-2xs font-bold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
            title="Scenario Planning · SAIL Scenario Planning Web App"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
            <span className="truncate">Scenario Planning</span>
          </button>

          <button
            onClick={() => onTabChange('ref-fleet')}
            className={`py-1 px-1.5 rounded-lg text-[10.5px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer truncate ${
              activeTab === 'ref-fleet'
                ? 'bg-white text-indigo-950 border border-indigo-200 shadow-2xs font-bold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
            title="Ref Fleet · Reference Fleet Dashboards"
          >
            <Anchor className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
            <span className="truncate">Ref Fleet</span>
          </button>
        </div>
      </div>

      {/* Tab 0: Chat History Category */}
      {activeTab === 'history' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Header & New Chat button */}
          <div className="p-3 border-b border-zinc-200 bg-zinc-50 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-indigo-700" />
                  Chat History
                </h2>
                <p className="text-[11px] text-zinc-500">
                  {savedChats.length} saved conversation thread{savedChats.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {/* + New Chat CTA */}
            {onNewChat && (
              <button
                onClick={onNewChat}
                className="w-full py-1.5 px-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>
            )}

            {/* Search History Feature */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Search History
                </label>
                {chatSearch && (
                  <span className="text-[10px] font-medium text-indigo-600">
                    {filteredChats.length} found
                  </span>
                )}
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Search previous queries & chats..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-medium"
                />
                {chatSearch && (
                  <button
                    onClick={() => setChatSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-xs cursor-pointer p-0.5 rounded"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable Chat Threads List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredChats.length === 0 ? (
              <div className="text-center py-10 px-4 space-y-2.5 text-zinc-400">
                <div className="w-9 h-9 rounded-full bg-zinc-100 text-zinc-400 mx-auto flex items-center justify-center">
                  <MessageSquare className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-700">
                    {chatSearch ? 'No matching queries or chats found' : 'No saved conversations'}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                    {chatSearch 
                      ? `No previous queries or chat threads matched "${chatSearch}".` 
                      : 'Conversations are automatically summarized and persisted to Zilliz ChatHistory.'}
                  </p>
                </div>
                {chatSearch ? (
                  <button
                    onClick={() => setChatSearch('')}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-700 font-semibold hover:underline cursor-pointer"
                  >
                    Clear search filter
                  </button>
                ) : (
                  onNewChat && (
                    <button
                      onClick={onNewChat}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-700 font-semibold hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Start conversation
                    </button>
                  )
                )}
              </div>
            ) : (
              filteredChats.map((chat) => {
                const isSelected = activeChatId === chat.id;
                const isEditing = editingChatId === chat.id;

                const formattedDate = new Date(chat.updatedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                const searchTrim = chatSearch.toLowerCase().trim();
                const matchedQuery = searchTrim && chat.userQueries
                  ? chat.userQueries.find(q => q.toLowerCase().includes(searchTrim))
                  : null;

                return (
                  <div
                    key={chat.id}
                    onClick={() => {
                      if (!isEditing && onSelectChat) {
                        onSelectChat(chat.id);
                      }
                    }}
                    className={`p-2.5 border rounded-xl transition-all cursor-pointer group relative ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-500/20 shadow-2xs'
                        : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/60 shadow-2xs'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (onRenameChat && editTitle.trim()) {
                                setIsRenaming(true);
                                await onRenameChat(chat.id, editTitle.trim());
                                setIsRenaming(false);
                                setEditingChatId(null);
                              }
                            } else if (e.key === 'Escape') {
                              setEditingChatId(null);
                            }
                          }}
                          autoFocus
                          disabled={isRenaming}
                          className="w-full px-2 py-1 text-xs bg-white border border-indigo-500 rounded-lg text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-semibold"
                        />
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingChatId(null)}
                            disabled={isRenaming}
                            className="px-2 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-800 rounded hover:bg-zinc-100 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isRenaming || !editTitle.trim()}
                            onClick={async () => {
                              if (onRenameChat && editTitle.trim()) {
                                setIsRenaming(true);
                                await onRenameChat(chat.id, editTitle.trim());
                                setIsRenaming(false);
                                setEditingChatId(null);
                              }
                            }}
                            className="px-2.5 py-0.5 text-[10px] bg-indigo-700 text-white rounded font-semibold hover:bg-indigo-800 cursor-pointer disabled:opacity-50 flex items-center gap-0.5"
                          >
                            <Check className="w-2.5 h-2.5" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {/* Title and Action Buttons */}
                        <div className="flex items-start justify-between gap-1.5">
                          <h3
                            className={`text-xs font-bold leading-snug line-clamp-2 ${
                              isSelected ? 'text-indigo-950 font-extrabold' : 'text-zinc-900 group-hover:text-indigo-700'
                            }`}
                            title={chat.title}
                          >
                            {chat.title}
                          </h3>

                          {/* Quick Rename & Delete Actions */}
                          {confirmDeleteChatId === chat.id ? (
                            <div 
                              className="flex items-center gap-1 shrink-0 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded shadow-2xs z-10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-[10px] text-rose-700 font-bold select-none">Delete?</span>
                              <button
                                type="button"
                                disabled={deletingChatId === chat.id}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setDeletingChatId(chat.id);
                                  try {
                                    if (onDeleteChat) {
                                      await onDeleteChat(chat.id);
                                    }
                                  } finally {
                                    setDeletingChatId(null);
                                    setConfirmDeleteChatId(null);
                                  }
                                }}
                                className="px-1.5 py-0.5 text-[10px] bg-rose-600 hover:bg-rose-700 text-white rounded font-bold cursor-pointer disabled:opacity-50 transition-colors"
                                title="Confirm Delete"
                              >
                                {deletingChatId === chat.id ? '...' : 'Yes'}
                              </button>
                              <button
                                type="button"
                                disabled={deletingChatId === chat.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteChatId(null);
                                }}
                                className="p-0.5 text-zinc-400 hover:text-zinc-700 rounded cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              {onRenameChat && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingChatId(chat.id);
                                    setEditTitle(chat.title);
                                    setConfirmDeleteChatId(null);
                                  }}
                                  className="p-1 text-zinc-400 hover:text-indigo-700 hover:bg-zinc-100 rounded transition-colors cursor-pointer"
                                  title="Rename Chat"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}

                              {onDeleteChat && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteChatId(chat.id);
                                  }}
                                  className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="Delete Chat"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Preview */}
                        {chat.preview && (
                          <p className="text-[11px] text-zinc-500 line-clamp-1 leading-normal">
                            {chat.preview}
                          </p>
                        )}

                        {/* Matched Previous Query Snippet */}
                        {matchedQuery && (
                          <div className="mt-1 flex items-start gap-1.5 text-[11px] text-indigo-700 bg-indigo-50/80 px-2 py-1 rounded-md border border-indigo-100/80">
                            <Search className="w-3 h-3 text-indigo-600 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">
                              <span className="font-semibold text-indigo-900">Query match: </span>
                              "{matchedQuery}"
                            </span>
                          </div>
                        )}

                        {/* Metadata: Date and Message Count */}
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                          <span>{formattedDate}</span>
                          <span className="font-mono text-zinc-400">
                            {chat.messageCount} msg{chat.messageCount === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 1: Maritime RSS News */}
      {activeTab === 'rss' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Maritime Intelligence Feeds</h2>
              <p className="text-xs text-zinc-500">Live shipping trade feeds & Hellenic News</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
              title="Refresh Feeds"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Add feed form */}
          <form onSubmit={handleSubscribe} className="space-y-2">
            <div className="flex gap-1.5">
              <input
                type="url"
                value={newFeedUrl}
                onChange={(e) => setNewFeedUrl(e.target.value)}
                placeholder="https://example.com/feed..."
                className="flex-1 px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono text-[11px]"
              />
              <button
                type="submit"
                disabled={isSubscribing}
                className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
            {feedMessage && (
              <p className={`text-xs ${feedMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {feedMessage.text}
              </p>
            )}
          </form>

          {/* Feeds List */}
          <div className="space-y-3">
            {feeds.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">Loading feed subscriptions...</p>
            ) : (
              feeds.map((feed, idx) => (
                <div key={idx} className="border border-zinc-200 rounded-xl p-3 bg-white space-y-2 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-zinc-900 leading-snug">{feed.title}</h3>
                      <p className="text-[11px] text-zinc-400 truncate max-w-[200px] font-mono">{feed.url}</p>
                    </div>
                    <button
                      onClick={() => onUnsubscribeFeed(feed.url)}
                      className="text-zinc-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                      title="Unsubscribe"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Articles */}
                  <div className="space-y-1.5 pt-1 border-t border-zinc-100">
                    {feed.entries.map((entry, eIdx) => (
                      <div key={eIdx} className="group p-1.5 rounded-lg hover:bg-zinc-50 transition-colors">
                        <div className="flex items-start justify-between gap-1.5">
                          <a
                            href={entry.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-zinc-800 hover:text-indigo-700 leading-snug line-clamp-2"
                          >
                            {entry.title}
                          </a>
                          <button
                            onClick={() => onSelectPrompt(`Analyze market implications of this recent intelligence report: "${entry.title}". Context: ${entry.summary || ''}`)}
                            className="shrink-0 text-zinc-400 hover:text-indigo-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Query Maritime Intelligence Expert on this article"
                          >
                            <Send className="w-3 h-3" />
                          </button>
                        </div>
                        {entry.summary && (
                          <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">{entry.summary}</p>
                        )}
                        <div className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1.5">
                          <span>{entry.pubDate || 'Recently published'}</span>
                          <span aria-hidden="true">·</span>
                          <a href={entry.link} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-0.5">
                            Source <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: 199 AIS Vessels with Search Box and Full Scrollable List */}
      {activeTab === 'vessels' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search Header & Input Box */}
          <div className="p-3 border-b border-zinc-200 bg-zinc-50 space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                  <Ship className="w-4 h-4 text-indigo-700" />
                  AIS Monitored Vessels
                </h2>
                <p className="text-[11px] text-zinc-500">
                  Showing {filteredVessels.length} of {vessels.length} tracked vessels
                </p>
              </div>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-200/70 font-semibold text-zinc-700">
                199 ROWS
              </span>
            </div>

            {/* Search Text Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={vesselSearch}
                onChange={(e) => setVesselSearch(e.target.value)}
                placeholder="Search by vessel name, MMSI, status..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-medium"
              />
              {vesselSearch && (
                <button
                  onClick={() => setVesselSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Speed Range Filters */}
            <div className="flex items-center gap-1 pt-0.5 flex-wrap">
              {(['all', 'stopped', '0-5kn', '5.1-10kn', '10.1-20kn', '20.1-50kn'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setStatusFilter(cat)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition-colors cursor-pointer ${
                    statusFilter === cat
                      ? 'bg-zinc-900 text-white'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Upload New Fleet CSV Button */}
            <div className="pt-1">
              <label className="w-full py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs">
                <Plus className="w-3.5 h-3.5" />
                <span>Update Fleet via CSV Upload</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Scrollable Vessels List (All 199 vessels) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredVessels.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-xs space-y-1">
                <p className="font-semibold text-zinc-600">No vessels found</p>
                <p>No monitored vessels matching "{vesselSearch}".</p>
              </div>
            ) : (
              filteredVessels.map((vessel, vIdx) => {
                const isUnderway = (vessel.Speed_Category || '').toLowerCase().includes('underway');
                const isStopped = (vessel.Speed_Category || '').toLowerCase().includes('stopped');
                const speedKn = vessel.SOG || (vessel.SOG_kmh ? (Number(vessel.SOG_kmh) / 1.852).toFixed(1) : '0.0');

                return (
                  <div
                    key={vIdx}
                    onClick={() =>
                      onSelectPrompt(
                        `${vessel.VesselName || 'Unknown Vessel'} (MMSI: ${vessel.MMSI})`
                      )
                    }
                    className="p-2.5 border border-zinc-200 rounded-xl bg-white hover:border-indigo-400 hover:shadow-xs transition-all cursor-pointer group space-y-1.5"
                    title={`Click to track ${vessel.VesselName || 'vessel'} (MMSI: ${vessel.MMSI})`}
                  >
                    {/* Top Row: Vessel Name & Status Badge */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-zinc-900 group-hover:text-indigo-700 block truncate">
                          {vessel.VesselName || 'Unnamed Vessel'}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400">
                          MMSI: {vessel.MMSI}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 border ${
                          isUnderway
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : isStopped
                            ? 'bg-zinc-100 text-zinc-700 border-zinc-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {vessel.Speed_Category || 'Underway'}
                      </span>
                    </div>

                    {/* Middle Row: Speed, Dimensions, Coordinates */}
                    <div className="grid grid-cols-2 gap-1 text-[10px] text-zinc-500 font-mono bg-zinc-50 p-1.5 rounded-lg border border-zinc-100">
                      <div>
                        <span className="text-zinc-400">Speed: </span>
                        <span className="font-semibold text-zinc-700">{speedKn} kn</span>
                      </div>
                      <div>
                        <span className="text-zinc-400">Dimensions: </span>
                        <span className="text-zinc-700">{vessel.Length || 0}m × {vessel.Width || 0}m</span>
                      </div>
                      {vessel.LAT && vessel.LON && (
                        <div className="col-span-2 truncate">
                          <span className="text-zinc-400">Coords: </span>
                          <span className="text-zinc-600">
                            {Number(vessel.LAT).toFixed(2)}°N, {Number(vessel.LON).toFixed(2)}°E
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Cluster & Action */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                      <span>Dest Cluster: {vessel.dest_cluster || 'N/A'} · ETA: {vessel.ETA_hours || 'N/A'}h</span>
                      <span className="text-indigo-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                        Ask SAIL <Send className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Southeast Asia Shipping Lanes Category */}
      {activeTab === 'lanes' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Lanes Header & Search Input */}
          <div className="p-3 border-b border-zinc-200 bg-zinc-50 space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                  <Route className="w-4 h-4 text-indigo-700" />
                  Southeast Asia Shipping Lanes
                </h2>
                <p className="text-[11px] text-zinc-500">
                  {filteredLanes.length} of {lanes.length} strategic SEA corridors
                </p>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 font-bold text-indigo-700">
                SEA LANES
              </span>
            </div>

            {/* Lane Search Text Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={laneSearch}
                onChange={(e) => setLaneSearch(e.target.value)}
                placeholder="Search lanes, ports (Singapore, Malacca, Cai Mep)..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-medium"
              />
              {laneSearch && (
                <button
                  onClick={() => setLaneSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Lane Type Filters */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
              {[
                { id: 'all', label: 'All Lanes' },
                { id: 'Strait Chokepoint', label: 'Chokepoints' },
                { id: 'Trunk Lane', label: 'Trunk Lanes' },
                { id: 'Feeder Corridor', label: 'Feeder Routes' },
                { id: 'Archipelagic Route', label: 'Archipelagic' }
              ].map((typeItem) => (
                <button
                  key={typeItem.id}
                  onClick={() => setLaneTypeFilter(typeItem.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                    laneTypeFilter === typeItem.id
                      ? 'bg-zinc-900 text-white'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {typeItem.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Southeast Asia Lanes List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {filteredLanes.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-xs space-y-1">
                <p className="font-semibold text-zinc-600">No shipping lanes found</p>
                <p>No Southeast Asian corridors matching "{laneSearch}".</p>
              </div>
            ) : (
              filteredLanes.map((lane) => {
                const isExpanded = expandedLaneId === lane.id;
                const isHeavy = lane.congestionStatus === 'Heavy Congestion';
                const isModerate = lane.congestionStatus === 'Moderate';

                return (
                  <div
                    key={lane.id}
                    className="border border-zinc-200 rounded-xl bg-white hover:border-indigo-400 transition-all shadow-2xs overflow-hidden"
                  >
                    {/* Lane Header Banner */}
                    <div 
                      onClick={() => setExpandedLaneId(isExpanded ? null : lane.id)}
                      className="p-3 bg-zinc-50/70 hover:bg-zinc-100/70 transition-colors cursor-pointer flex items-start justify-between gap-2 border-b border-zinc-100"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">
                            {lane.code}
                          </span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-zinc-200/80 text-zinc-700">
                            {lane.type}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-medium">
                            {lane.region}
                          </span>
                        </div>

                        <h3 className="text-xs font-bold text-zinc-950 mt-1 leading-snug">
                          {lane.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isHeavy
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : isModerate
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          }`}
                        >
                          {lane.congestionStatus}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {/* Lane Main Body */}
                    <div className="p-3 space-y-2.5">
                      {/* Port Sequence Timeline */}
                      <div>
                        <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-semibold mb-1">
                          <MapPin className="w-3 h-3 text-indigo-700" />
                          <span>Primary Gateways & Transshipment Terminals:</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {lane.primaryPorts.map((port, pIdx) => (
                            <React.Fragment key={pIdx}>
                              <span className="text-[11px] font-medium text-zinc-800 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">
                                {port}
                              </span>
                              {pIdx < lane.primaryPorts.length - 1 && (
                                <span className="text-zinc-300 text-[10px]">→</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      {/* Corridor Specs Grid */}
                      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono bg-zinc-50 p-2 rounded-lg border border-zinc-200/80">
                        <div>
                          <span className="text-zinc-400 block text-[9px] uppercase font-sans">Transit Distance</span>
                          <span className="font-semibold text-zinc-900">{lane.transitDistanceNm} Nautical Miles</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block text-[9px] uppercase font-sans">Avg Transit Time</span>
                          <span className="font-semibold text-zinc-900">{lane.avgTransitDays} Days</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block text-[9px] uppercase font-sans">Commercial Density</span>
                          <span className="font-semibold text-zinc-900">{lane.dailyDensity}+ vessels/day</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block text-[9px] uppercase font-sans">Max Draft Allowed</span>
                          <span className="font-semibold text-zinc-900">{lane.draftLimitMeters}m Draft</span>
                        </div>
                      </div>

                      {/* Dominant Vessels & Benchmark Rates */}
                      <div className="text-[11px] text-zinc-600 space-y-1">
                        <div className="flex items-start gap-1">
                          <Anchor className="w-3 h-3 text-indigo-700 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-zinc-800">Dominant Fleet: </span>
                            <span>{lane.dominantVessels}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-1">
                          <Gauge className="w-3 h-3 text-indigo-700 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-zinc-800">Spot Rate Benchmark: </span>
                            <span className="font-mono font-semibold text-indigo-700">{lane.currentRatesEstimate}</span>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details: Hazards, Description & Feeder Loops */}
                      {isExpanded && (
                        <div className="pt-2 border-t border-zinc-100 space-y-2 text-xs">
                          <p className="text-[11px] text-zinc-600 leading-relaxed">
                            {lane.description}
                          </p>

                          {/* Key Hazards & Chokepoint Alerts */}
                          <div className="p-2 bg-amber-50/80 border border-amber-200 rounded-lg text-amber-950 flex items-start gap-1.5 text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="leading-snug">
                              <span className="font-bold text-amber-900">Hazards & Bottlenecks: </span>
                              {lane.keyHazards}
                            </div>
                          </div>

                          {/* Active Feeder Loops */}
                          <div>
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide block mb-1">
                              Active Feeder Loops on this Corridor:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {lane.activeFeederLoops.map((loop, lIdx) => (
                                <span
                                  key={lIdx}
                                  className="text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded"
                                >
                                  {loop}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Button: Ask Maritime Intelligence Expert about this lane */}
                      <div className="pt-1 flex items-center justify-between border-t border-zinc-100">
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {isExpanded ? 'Click header to collapse' : 'Click header for full hazards & loops'}
                        </span>
                        <button
                          onClick={() =>
                            onSelectPrompt(
                              `Evaluate maritime market dynamics, carrier feeder capacity, and congestion risks for the Southeast Asian shipping lane: "${lane.name}" (${lane.code}). Key ports: ${lane.primaryPorts.join(', ')}.`
                            )
                          }
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          title="Ask SAIL to analyze this lane"
                        >
                          <span>Analyze Lane</span>
                          <Send className="w-3 h-3 text-indigo-700" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Fleet Planning Category (Call out to fleetplanning.ai.studio) */}
      {activeTab === 'fleet-planning' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">
          {/* Main Callout Banner */}
          <div className="border border-indigo-200 rounded-2xl p-4 bg-gradient-to-br from-indigo-50/80 via-white to-zinc-50 space-y-3 shadow-2xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-700 text-white flex items-center justify-center shadow-xs shrink-0">
                  <SlidersHorizontal className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-zinc-950 flex items-center gap-1.5">
                    <span>Fleet Dashboard</span>
                    <span className="font-mono text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-300">
                      LIVE APP
                    </span>
                  </h2>
                  <p className="font-mono text-[10px] text-indigo-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    fleetplanning.ai.studio
                  </p>
                </div>
              </div>

              <a
                href="https://fleetplanning.ai.studio"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 hover:border-indigo-300 rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
                title="Open fleetplanning.ai.studio in new tab"
              >
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Dedicated maritime fleet dashboard for smaller container carriers. Features interactive scenario forecasting, feeder charter fixture vs newbuild CAPEX simulators, and TEU capacity allocation across Southeast Asian trade lanes.
            </p>

            {/* Launch Callout Button */}
            <div className="space-y-1.5 pt-1">
              <a
                href="https://fleetplanning.ai.studio"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer group"
              >
                <span>Launch Fleet Dashboard</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>

              <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1">
                <span>Hosted at: fleetplanning.ai.studio</span>
                <button
                  onClick={() => setShowEmbeddedViewer(!showEmbeddedViewer)}
                  className="text-indigo-600 hover:underline font-medium cursor-pointer"
                >
                  {showEmbeddedViewer ? 'Hide Embedded Console' : 'Toggle In-App Console'}
                </button>
              </div>
            </div>
          </div>

          {/* Embedded WebApp Viewer Console (Toggleable) */}
          {showEmbeddedViewer && (
            <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-2xs space-y-2 p-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-zinc-700 flex items-center gap-1">
                  <Maximize2 className="w-3 h-3 text-indigo-700" />
                  Embedded Console: Fleet Dashboard
                </span>
                <a
                  href="https://fleetplanning.ai.studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5"
                >
                  Full Window <ArrowUpRight className="w-2.5 h-2.5" />
                </a>
              </div>
              <div className="relative rounded-lg overflow-hidden border border-zinc-200 bg-zinc-50 h-72">
                <iframe
                  src="https://fleetplanning.ai.studio"
                  title="Fleet Dashboard"
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </div>
              <p className="text-[10px] text-zinc-400 px-1 text-center">
                Connected to fleetplanning.ai.studio secure container cluster.
              </p>
            </div>
          )}

          {/* Connected Intelligence Modules from fleetplanning.ai.studio */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1">
              Fleet Dashboard Capabilities & Scenarios
            </h3>

            {/* Scenario Card 1: Bangkokmax Feeder Charter Optimizer */}
            <div className="border border-zinc-200 rounded-xl p-3 bg-white hover:border-indigo-300 transition-colors shadow-2xs space-y-2">
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                  <h4 className="text-xs font-bold text-zinc-900">1,200–2,800 TEU Feeder Allocation</h4>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 font-semibold border border-zinc-200">
                  OPTIMIZER
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-snug">
                Simulate vessel deployment, bunker burn profiles, and port rotation economics across Singapore, Port Klang, and Cai Mep corridors.
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-[10px]">
                <span className="text-zinc-400 font-mono">Loop: SIN-PKG-PEN</span>
                <button
                  onClick={() =>
                    onSelectPrompt(
                      "Execute a fleet capacity planning scenario based on the fleetplanning.ai.studio engine for 4 Bangkokmax (1,800 TEU) feeder vessels on the Straits of Malacca corridor. Calculate optimal weekly TEU allocation and charter rate break-evens."
                    )
                  }
                  className="text-indigo-700 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  Ask SAIL <Send className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            {/* Scenario Card 2: Charter vs Newbuild Financial Payback */}
            <div className="border border-zinc-200 rounded-xl p-3 bg-white hover:border-indigo-300 transition-colors shadow-2xs space-y-2">
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                  <h4 className="text-xs font-bold text-zinc-900">Charter Fixture vs Newbuild CAPEX</h4>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 font-semibold border border-zinc-200">
                  CAPEX / OPEX
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-snug">
                Model financial trade-offs between 12-month period time charters vs 2026-2027 shipyard deliveries (from new_ship.json specifications).
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-[10px]">
                <span className="text-zinc-400 font-mono">Horizon: 2026-2027</span>
                <button
                  onClick={() =>
                    onSelectPrompt(
                      "Compare charter fixture economics versus newbuild acquisition capital commitments for small carriers, referencing financial modeling methodology from fleetplanning.ai.studio and current Drewry container indices."
                    )
                  }
                  className="text-indigo-700 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  Analyze Fixtures <Send className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            {/* Scenario Card 3: Green Corridor & IMO CII Emission Projection */}
            <div className="border border-zinc-200 rounded-xl p-3 bg-white hover:border-indigo-300 transition-colors shadow-2xs space-y-2">
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                  <h4 className="text-xs font-bold text-zinc-900">IMO CII Rating & Eco-Speed Profiling</h4>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                  GREEN CII
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-snug">
                Forecast vessel Carbon Intensity Indicator (CII Grade A–E) scores under slow steaming (12-14 kn) and bio-bunker fuel blends on archipelagic routes.
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-[10px]">
                <span className="text-zinc-400 font-mono">Target: CII Grade B</span>
                <button
                  onClick={() =>
                    onSelectPrompt(
                      "Calculate IMO Carbon Intensity Indicator (CII) compliance trajectories and eco-speed savings for Southeast Asian feeder vessels using the fleetplanning.ai.studio green corridor framework."
                    )
                  }
                  className="text-indigo-700 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  Model CII Ratings <Send className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Sync Monitored Fleet Baseline */}
          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <Ship className="w-3.5 h-3.5 text-indigo-700" />
                Live Fleet Sync
              </span>
              <span className="font-mono text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                199 AIS VESSELS SYNCED
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              The 199 AIS tracked vessels monitored in SAIL are pre-mapped for import into the fleetplanning.ai.studio fleet allocation workspace.
            </p>
            <a
              href="https://fleetplanning.ai.studio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              Fleet Dashboard <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Tab 5: Scenario Strategy Category (SAIL Scenario Planning Web App) */}
      {activeTab === 'scenario-strategy' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">
          {/* Main Callout Banner: Click on Scenario Planning opens attached web app in a new tab */}
          <div className="border border-indigo-200 rounded-2xl p-4 bg-gradient-to-br from-indigo-50/80 via-white to-zinc-50 space-y-3 shadow-2xs">
            <div className="flex items-start justify-between gap-2">
              <a
                href="/assets/aistudio/index_23d044a4.html?v=20261114-5"
                target="_blank"
                className="flex items-center gap-2.5 group cursor-pointer"
                title="Click to open SAIL Scenario Planning web app in a new tab"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-700 group-hover:bg-indigo-800 text-white flex items-center justify-center shadow-xs shrink-0 font-black text-base transition-colors">
                  S
                </div>
                <div>
                  <h2 className="text-xs font-bold text-zinc-950 group-hover:text-indigo-700 flex items-center gap-1.5 transition-colors">
                    <span>SAIL Scenario Planning</span>
                    <span className="font-mono text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-300">
                      WEB APP
                    </span>
                  </h2>
                  <p className="font-mono text-[10px] text-indigo-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Scenario & Intelligence for Liners · v1.2
                  </p>
                </div>
              </a>

              <a
                href="/assets/aistudio/index_23d044a4.html?v=20261114-5"
                target="_blank"
                className="p-1.5 text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 hover:border-indigo-300 rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
                title="Open Scenario Planning web app in new tab"
              >
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Executive strategic fleet planning web application connecting market signals, strategic posture, capacity requirements, vessel benchmark selection, three-layer capacity commitment strategy (Locked, Flexible, Watch Zone), Gantt investment roadmap, and strategy brief generation.
            </p>

            {/* Primary CTA: Click Scenario Planning to open in a new tab */}
            <div className="space-y-1.5 pt-1">
              <a
                href="/assets/aistudio/index_23d044a4.html?v=20261114-5"
                target="_blank"
                className="w-full py-2.5 px-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer group"
              >
                <span>Scenario Planning (Open in New Tab)</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>

              <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1 pt-0.5">
                <span>Deterministic Engine · 3-Layer Commitment</span>
                <button
                  type="button"
                  onClick={() => setShowStrategyEmbeddedViewer(!showStrategyEmbeddedViewer)}
                  className="text-indigo-600 hover:underline font-medium cursor-pointer"
                >
                  {showStrategyEmbeddedViewer ? 'Hide Sidebar Preview' : 'Toggle Sidebar Preview'}
                </button>
              </div>
            </div>
          </div>

          {/* Optional Embedded Preview inside Sidebar */}
          {showStrategyEmbeddedViewer && (
            <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-2xs space-y-2 p-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-zinc-700 flex items-center gap-1">
                  <Maximize2 className="w-3 h-3 text-indigo-700" />
                  Preview: SAIL Scenario Planning
                </span>
                <a
                  href="/assets/aistudio/index_23d044a4.html?v=20261114-5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5 font-semibold"
                >
                  Open Full Tab <ArrowUpRight className="w-2.5 h-2.5" />
                </a>
              </div>
              <div className="relative rounded-lg overflow-hidden border border-zinc-200 bg-zinc-50 h-80">
                <iframe
                  src="/assets/aistudio/index_23d044a4.html?v=20261114-5"
                  title="SAIL Scenario Planning Preview"
                  className="w-full h-full border-0"
                />
              </div>
            </div>
          )}

          {/* 4 Predefined Strategic Scenarios from SAIL Scenario Planning */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Strategic Scenarios & 3-Layer Architecture
              </h3>
              <a
                href="/assets/aistudio/index_23d044a4.html?v=20261114-5"
                target="_blank"
                className="text-[10px] font-semibold text-indigo-700 hover:underline flex items-center gap-0.5"
              >
                Scenario Planning <ArrowUpRight className="w-2.5 h-2.5" />
              </a>
            </div>

            {/* Scenario A */}
            <div className="border border-zinc-200 rounded-xl p-3 bg-white hover:border-indigo-300 transition-colors shadow-2xs space-y-1.5">
              <div className="flex items-start justify-between gap-1.5">
                <a
                  href="/assets/aistudio/index_23d044a4.html?v=20261114-5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-zinc-900 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                >
                  <span>Scenario A: Grow Ahead of Market</span>
                  <ArrowUpRight className="w-3 h-3 text-indigo-600 shrink-0" />
                </a>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shrink-0">
                  AGGRESSIVE
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-snug">
                Demand +14.0% p.a. · Ambition +18.0% p.a. · Competitor growth +2.0% p.a. Lock in next year&apos;s capacity early and prioritise early vessel acquisition.
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-[10px]">
                <a
                  href="/assets/aistudio/index_23d044a4.html?v=20261114-5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 font-semibold hover:underline flex items-center gap-0.5"
                >
                  Open Scenario Planning <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <button
                  type="button"
                  onClick={() =>
                    onSelectPrompt(
                      'Evaluate Scenario A (Grow Ahead of the Market: +14% demand growth, +18% ambition, +2% competitor capacity additions) using the SAIL 3-Layer Capacity Commitment Strategy (Locked, Flexible, Watch Zone).'
                    )
                  }
                  className="text-zinc-600 hover:text-indigo-700 font-semibold flex items-center gap-0.5 cursor-pointer"
                >
                  Ask SAIL <Send className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            {/* Scenario B */}
            <div className="border border-zinc-200 rounded-xl p-3 bg-white hover:border-indigo-300 transition-colors shadow-2xs space-y-1.5">
              <div className="flex items-start justify-between gap-1.5">
                <a
                  href="/assets/aistudio/index_23d044a4.html?v=20261114-5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-zinc-900 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                >
                  <span>Scenario B: Defend Market Position</span>
                  <ArrowUpRight className="w-3 h-3 text-indigo-600 shrink-0" />
                </a>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shrink-0">
                  DEFENSIVE
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-snug">
                Demand +5.0% p.a. · Ambition +8.0% p.a. · Competitor growth +12.0% p.a. Protect slot share on core corridors using short/medium-term flexible charters.
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-[10px]">
                <a
                  href="/assets/aistudio/index_23d044a4.html?v=20261114-5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 font-semibold hover:underline flex items-center gap-0.5"
                >
                  Open Scenario Planning <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <button
                  type="button"
                  onClick={() =>
                    onSelectPrompt(
                      'Evaluate Scenario B (Defend Market Position: +5% demand growth, +8% ambition, +12% aggressive competitor expansion) and recommend Locked vs Flexible charter ratios.'
                    )
                  }
                  className="text-zinc-600 hover:text-indigo-700 font-semibold flex items-center gap-0.5 cursor-pointer"
                >
                  Ask SAIL <Send className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            {/* Scenario C */}
            <div className="border border-zinc-200 rounded-xl p-3 bg-white hover:border-indigo-300 transition-colors shadow-2xs space-y-1.5">
              <div className="flex items-start justify-between gap-1.5">
                <a
                  href="/assets/aistudio/index_23d044a4.html?v=20261114-5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-zinc-900 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                >
                  <span>Scenario C: Preserve Flexibility</span>
                  <ArrowUpRight className="w-3 h-3 text-indigo-600 shrink-0" />
                </a>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200 shrink-0">
                  FLEXIBLE
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-snug">
                Demand +2.5% p.a. · Ambition +4.0% p.a. · Competitor growth +3.5% p.a. Prioritise index-linked and option-laden charters while delaying irreversible capex.
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-[10px]">
                <a
                  href="/assets/aistudio/index_23d044a4.html?v=20261114-5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 font-semibold hover:underline flex items-center gap-0.5"
                >
                  Open Scenario Planning <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <button
                  type="button"
                  onClick={() =>
                    onSelectPrompt(
                      'Evaluate Scenario C (Preserve Flexibility under uncertain +2.5% demand growth) and outline Watch Zone trigger gates and charter option structures.'
                    )
                  }
                  className="text-zinc-600 hover:text-indigo-700 font-semibold flex items-center gap-0.5 cursor-pointer"
                >
                  Ask SAIL <Send className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            {/* Scenario D */}
            <div className="border border-zinc-200 rounded-xl p-3 bg-white hover:border-indigo-300 transition-colors shadow-2xs space-y-1.5">
              <div className="flex items-start justify-between gap-1.5">
                <a
                  href="/assets/aistudio/index_23d044a4.html?v=20261114-5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-zinc-900 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                >
                  <span>Scenario D: Protect Cash & Capacity</span>
                  <ArrowUpRight className="w-3 h-3 text-indigo-600 shrink-0" />
                </a>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200 shrink-0">
                  PRESERVATION
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-snug">
                Demand -2.0% p.a. · Ambition 0.0% p.a. · Industry overhang +7.5% p.a. Freeze discretionary capex, slow-steam rotations, and redeliver expiring charters.
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-[10px]">
                <a
                  href="/assets/aistudio/index_23d044a4.html?v=20261114-5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 font-semibold hover:underline flex items-center gap-0.5"
                >
                  Open Scenario Planning <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <button
                  type="button"
                  onClick={() =>
                    onSelectPrompt(
                      'Evaluate Scenario D (Protect Cash and Capacity: -2.0% demand contraction and +7.5% market capacity overhang) and recommend fleet rationalisation steps.'
                    )
                  }
                  className="text-zinc-600 hover:text-indigo-700 font-semibold flex items-center gap-0.5 cursor-pointer"
                >
                  Ask SAIL <Send className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Ref Fleet Category (External Streamlit Reference Fleet Dashboards) */}
      {activeTab === 'ref-fleet' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4 bg-zinc-50">
          <div className="space-y-1 px-0.5">
            <h2 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
              <Anchor className="w-4 h-4 text-indigo-700" />
              <span>Ref Fleet Dashboards</span>
            </h2>
            <p className="text-[11px] text-zinc-500 leading-snug">
              Select a reference fleet dashboard below to launch it in a new browser tab.
            </p>
          </div>

          {/* Link 1: Fleet Management Dashboard */}
          <div className="border border-zinc-200 rounded-xl p-4 bg-white hover:border-indigo-300 transition-colors shadow-2xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-700 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Ship className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-zinc-900 truncate">
                    Fleet Management Dashboard
                  </h3>
                  <p className="font-mono text-[10px] text-zinc-500 truncate">
                    fleetmgmtdashboardv2.streamlit.app
                  </p>
                </div>
              </div>
              <a
                href="https://fleetmgmtdashboardv2.streamlit.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-indigo-700 hover:text-indigo-900 bg-zinc-50 border border-zinc-200 hover:border-indigo-300 rounded-lg transition-colors shrink-0 cursor-pointer"
                title="Open Fleet Management Dashboard in new tab"
              >
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Interactive reference fleet management analytics, vessel deployment tracking, and operational performance metrics.
            </p>

            <a
              href="https://fleetmgmtdashboardv2.streamlit.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2 px-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer group"
            >
              <span>Open Fleet Management Dashboard</span>
              <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          </div>

          {/* Link 2: SAIL Dashboard */}
          <div className="border border-zinc-200 rounded-xl p-4 bg-white hover:border-indigo-300 transition-colors shadow-2xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-700 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-zinc-900 truncate">
                    SAIL Reference Dashboard
                  </h3>
                  <p className="font-mono text-[10px] text-zinc-500 truncate">
                    planningenginedashboard.streamlit.app
                  </p>
                </div>
              </div>
              <a
                href="https://planningenginedashboard.streamlit.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-indigo-700 hover:text-indigo-900 bg-zinc-50 border border-zinc-200 hover:border-indigo-300 rounded-lg transition-colors shrink-0 cursor-pointer"
                title="Open SAIL Reference Dashboard in new tab"
              >
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed">
              SAIL maritime reference dashboard for liner network intelligence, trade corridor benchmarks, and fleet utilization telemetry.
            </p>

            <a
              href="https://planningenginedashboard.streamlit.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2 px-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer group"
            >
              <span>Open SAIL Dashboard</span>
              <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          </div>
        </div>
      )}
    </aside>
  );
};
