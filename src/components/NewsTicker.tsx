/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  Pause, 
  Play, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { RSSFeedResult, RSSEntry } from '../types.js';

interface NewsTickerProps {
  feeds: RSSFeedResult[];
  onSelectHeadline: (headline: string) => void;
}

export const NewsTicker: React.FC<NewsTickerProps> = ({ feeds, onSelectHeadline }) => {
  // Flatten all entries from all feeds into a single stream
  const allArticles: (RSSEntry & { feedName: string })[] = [];
  feeds.forEach((feed) => {
    feed.entries.forEach((entry) => {
      allArticles.push({
        ...entry,
        feedName: feed.title || 'Maritime News'
      });
    });
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-rotate articles every 6 seconds if not paused
  useEffect(() => {
    if (isPaused || allArticles.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % allArticles.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused, allArticles.length]);

  if (allArticles.length === 0) {
    return (
      <div className="h-9 bg-zinc-900 text-zinc-300 px-4 flex items-center justify-between text-xs border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-bold text-[11px] uppercase tracking-wider text-indigo-400">Maritime Live Feed</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-400 text-[11px]">Connecting to Hellenic Shipping and container rate RSS feeds...</span>
        </div>
      </div>
    );
  }

  const current = allArticles[currentIndex] || allArticles[0];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + allArticles.length) % allArticles.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % allArticles.length);
  };

  return (
    <div 
      className="h-10 bg-zinc-950 text-white px-3 sm:px-4 flex items-center justify-between text-xs border-b border-zinc-800 shrink-0 select-none overflow-hidden transition-colors"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Ticker Badge & Headline */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
        {/* Live Pulse Label */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 shrink-0 text-[11px] font-semibold tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <Radio className="w-3 h-3 text-indigo-400" />
          <span className="hidden sm:inline uppercase text-[10px] tracking-wider">Live RSS</span>
        </div>

        {/* Source feed tag */}
        <span className="text-zinc-400 text-[11px] font-mono shrink-0 hidden md:inline truncate max-w-[140px]">
          [{current.sourceFeed || current.feedName}]
        </span>

        <span className="text-zinc-600 hidden md:inline">·</span>

        {/* Article Title */}
        <div className="truncate flex-1 min-w-0">
          <a
            href={current.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-zinc-200 hover:text-white transition-colors truncate inline-block max-w-full"
            title={current.title}
          >
            {current.title}
          </a>
        </div>
      </div>

      {/* Right Controls & Quick Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* 1-Click "Ask SAIL" button */}
        <button
          onClick={() => onSelectHeadline(`Analyze this breaking intelligence report: "${current.title}". Summary: ${current.summary || 'Evaluate implications on Southeast Asian shipping lanes.'}`)}
          className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-indigo-700 hover:bg-indigo-600 text-white rounded transition-colors shadow-xs"
          title="Analyze this headline with SAIL AI"
        >
          <Sparkles className="w-3 h-3 text-indigo-200" />
          <span>Ask SAIL</span>
        </button>

        {/* External Link */}
        <a
          href={current.link}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
          title="Open article in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        {/* Carousel controls */}
        <div className="flex items-center gap-0.5 ml-1 border-l border-zinc-800 pl-1.5">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
            title={isPaused ? "Resume auto-rotation" : "Pause auto-rotation"}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </button>
          <button
            onClick={handlePrev}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
            title="Previous headline"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-zinc-500 px-1 hidden sm:inline">
            {currentIndex + 1}/{allArticles.length}
          </span>
          <button
            onClick={handleNext}
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
            title="Next headline"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
