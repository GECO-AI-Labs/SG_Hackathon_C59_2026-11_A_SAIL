/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Ship, 
  Activity, 
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { SystemStatus } from '../types.js';

interface HeaderProps {
  status: SystemStatus | null;
  onOpenDiagnostics: () => void;
  onOpenMLflow?: () => void;
  onToggleSidebar: () => void;
  sidebarMinimized: boolean;
  activeTab?: 'history' | 'rss' | 'vessels' | 'lanes' | 'scenarios' | 'fleet-planning' | 'scenario-strategy' | 'ref-fleet';
  onTabChange?: (tab: 'history' | 'rss' | 'vessels' | 'lanes' | 'scenarios' | 'fleet-planning' | 'scenario-strategy' | 'ref-fleet') => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenDiagnostics,
  onToggleSidebar,
  sidebarMinimized
}) => {
  return (
    <header className="h-14 bg-white border-b border-zinc-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Brand & Sidebar Minimize Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors flex items-center justify-center shadow-xs cursor-pointer"
          title={sidebarMinimized ? "Expand Maritime Sidebar" : "Minimize Maritime Sidebar"}
          aria-label="Toggle Sidebar"
        >
          {sidebarMinimized ? (
            <PanelLeftOpen className="w-4 h-4 text-indigo-700" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-zinc-600" />
          )}
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-700 text-white flex items-center justify-center shadow-xs">
            <Ship className="w-4.5 h-4.5 text-white stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-zinc-900">SAIL</span>
              <span className="text-zinc-400 font-mono text-[11px]">v2.0</span>
              <span className="hidden sm:inline text-xs text-zinc-300">·</span>
              <span className="hidden sm:inline text-xs font-semibold text-zinc-700">Maritime Intelligence</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Action Tools: Status, Diagnostics */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Systems status indicator */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 text-xs text-zinc-600 border border-zinc-200 rounded-md bg-zinc-50">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
          <span className="font-medium text-[11px]">Systems Online</span>
        </div>

        {/* Diagnostic Button */}
        <button
          onClick={onOpenDiagnostics}
          className="px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          title="Run 4-Phase System Diagnostics"
        >
          <Activity className="w-3.5 h-3.5 text-indigo-600" />
          <span className="hidden sm:inline">Diagnostic</span>
        </button>
      </div>
    </header>
  );
};
