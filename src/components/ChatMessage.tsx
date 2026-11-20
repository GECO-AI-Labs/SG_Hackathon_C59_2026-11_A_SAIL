/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Ship, 
  User, 
  Copy, 
  Check, 
  BarChart2, 
  Sparkles,
  ShieldAlert,
  Clock,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  Database,
  ExternalLink
} from 'lucide-react';
import { Message } from '../types.js';

interface ChatMessageProps {
  message: Message;
  onOpenTrace?: (traceId: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onOpenTrace }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract confidence rating or score if present
  const confidenceMatch = message.content.match(/Confidence Score:\s*\[?(\d{1,3})\/100\]?/i);
  const confidenceScore = confidenceMatch ? Number(confidenceMatch[1]) : message.confidenceScore;

  // Render formatted content matching GitHub Copilot Chat layout
  const renderFormattedContent = (content: string) => {
    // Replace any verbose citation disclaimers with 'None'
    const cleanContent = content.replace(
      /\*?\s*\(\s*No verified citation available[^)]*\)\s*\*?/gi,
      'None'
    );
    const lines = cleanContent.split('\n');
    return lines.map((line, idx) => {
      // Bold Headings
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} className="font-bold text-zinc-950 text-sm mt-3.5 mb-1.5 tracking-tight">
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h3 key={idx} className="font-bold text-zinc-950 text-base mt-4 mb-2 tracking-tight">
            {line.replace('## ', '')}
          </h3>
        );
      }
      if (line.startsWith('# ')) {
        return (
          <h2 key={idx} className="font-bold text-zinc-950 text-lg mt-5 mb-2.5 tracking-tight">
            {line.replace('# ', '')}
          </h2>
        );
      }

      // Thin-Data Warning Card (Copilot warning callout)
      if (line.toLowerCase().includes('thin-data lane') || line.toLowerCase().includes('low-confidence warning')) {
        return (
          <div key={idx} className="my-3 p-3 bg-amber-50/90 border border-amber-300 rounded-lg text-amber-950 text-xs flex items-start gap-2.5 shadow-2xs">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-amber-900">Thin-Data Corridor Warning: </span>
              {line}
            </div>
          </div>
        );
      }

      // Confidence score card at the end
      if (line.toLowerCase().includes('confidence score:')) {
        return (
          <div key={idx} className="mt-4 p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between text-xs shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-700 shrink-0" />
              <span className="font-semibold text-zinc-900">{line}</span>
            </div>
            {confidenceScore !== undefined && (
              <span className={`font-mono font-bold px-2.5 py-0.5 rounded-md text-xs border ${
                Number(confidenceScore) >= 80 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                  : Number(confidenceScore) >= 60 
                  ? 'bg-amber-50 text-amber-800 border-amber-300' 
                  : 'bg-rose-50 text-rose-800 border-rose-300'
              }`}>
                {confidenceScore}/100
              </span>
            )}
          </div>
        );
      }

      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const text = line.trim().substring(2);
        return (
          <li key={idx} className="ml-4 list-disc text-xs leading-relaxed text-zinc-800 my-1">
            {renderBoldHighlights(text)}
          </li>
        );
      }

      // Empty line
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }

      // Regular text paragraph
      return (
        <p key={idx} className="text-xs leading-relaxed text-zinc-800 my-1">
          {renderBoldHighlights(line)}
        </p>
      );
    });
  };

  // Validate whether a target string is a real HTTP/HTTPS URL
  const isValidHttpUrl = (raw: string): boolean => {
    const trimmed = raw.trim();
    if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) return false;
    if (/^https?:\/\/(\.\.\.|placeholder|example\.(com|org|net))/i.test(trimmed)) return false;
    try {
      const parsed = new URL(trimmed);
      return (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        Boolean(parsed.hostname) &&
        parsed.hostname.includes('.') &&
        !parsed.hostname.includes('..')
      );
    } catch {
      return false;
    }
  };

  // Helper to render a highlighted database source badge (non-hyperlink)
  const renderDatabaseSourceBadge = (key: React.Key, label: string) => {
    const cleanLabel = label.trim().replace(/^\[(.*)\]$/, '$1').trim();
    return (
      <span
        key={key}
        className="inline-flex items-center gap-1 font-semibold text-emerald-900 bg-emerald-50/90 px-1.5 py-0.5 rounded border border-emerald-200/90 font-mono text-[11px] my-0.5"
        title={`Database Source: ${cleanLabel}`}
      >
        <Database className="w-2.5 h-2.5 text-emerald-700 inline shrink-0" />
        <span>{cleanLabel}</span>
      </span>
    );
  };

  // Helper to render a clickable hyperlink only for valid URLs
  const renderUrlHyperlink = (key: React.Key, label: string, rawUrl: string) => {
    const cleanUrl = rawUrl.trim().replace(/\/feed\/?$/i, '/').replace(/\/rss\/?$/i, '/');
    return (
      <a
        key={key}
        href={cleanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50/90 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 transition-colors text-[11px] underline underline-offset-2 my-0.5"
        title={`Click to verify source: ${cleanUrl}`}
      >
        <span>{label}</span>
        <ExternalLink className="w-2.5 h-2.5 inline shrink-0" />
      </a>
    );
  };

  // Helper to highlight database sources and render clickable hyperlinks ONLY for valid URLs
  const renderBoldHighlights = (text: string) => {
    const tokenRegex = /(\*\*\[[^\]]+\]\([^)]+\)\*\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)<>\]]+|\*\*[^*]+\*\*|\[(?:AIS|Seaport|Filling|Filing|News|Corporate|Database|Source)[^\]]*\])/gi;
    const parts = text.split(tokenRegex);

    return parts.map((part, pIdx) => {
      if (!part) return null;

      // 1. Bold Markdown Link: **[Label](target)**
      if (part.startsWith('**[') && part.includes('](') && part.endsWith(')**')) {
        const inner = part.slice(2, -2);
        const match = inner.match(/^\[(.*?)\]\((.*?)\)$/);
        if (match) {
          const [, label, target] = match;
          if (isValidHttpUrl(target)) {
            return renderUrlHyperlink(pIdx, label, target);
          }
          return renderDatabaseSourceBadge(pIdx, label);
        }
      }

      // 2. Standard Markdown Link: [Label](target)
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const match = part.match(/^\[(.*?)\]\((.*?)\)$/);
        if (match) {
          const [, label, target] = match;
          if (isValidHttpUrl(target)) {
            return renderUrlHyperlink(pIdx, label, target);
          }
          return renderDatabaseSourceBadge(pIdx, label);
        }
      }

      // 3. Bold Text or Database Citation: **text**
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2);
        const trimmedBold = boldText.trim();

        // If the bold text itself is a standalone valid URL, make it a hyperlink
        if (isValidHttpUrl(trimmedBold)) {
          return renderUrlHyperlink(pIdx, trimmedBold, trimmedBold);
        }

        const isBracketedCitation = trimmedBold.startsWith('[') && trimmedBold.endsWith(']');
        const isDatabaseKeyword =
          /\b(Database|Collection|Telemetry|Statistics|Fillings|Filings)\b/i.test(trimmedBold) ||
          /^(AIS|Seaport|Filling|Corporate|News)\s+(Database|Source|Telemetry|Statistics|Fillings|Filings|Records|Collection)/i.test(trimmedBold);

        if (isBracketedCitation || isDatabaseKeyword) {
          return renderDatabaseSourceBadge(pIdx, trimmedBold);
        }

        return (
          <strong key={pIdx} className="font-bold text-zinc-950">
            {boldText}
          </strong>
        );
      }

      // 4. Unbolded Bracketed Database Source: [AIS Telemetry Database: ...]
      if (
        part.startsWith('[') &&
        part.endsWith(']') &&
        /^\[(?:AIS|Seaport|Filling|Filing|News|Corporate|Database|Source)/i.test(part)
      ) {
        return renderDatabaseSourceBadge(pIdx, part);
      }

      // 5. Standalone URL
      if (/^https?:\/\//i.test(part)) {
        const trailingMatch = part.match(/^(.*?)([.,;:!?]+)$/);
        const rawUrl = trailingMatch ? trailingMatch[1] : part;
        const trailingPunct = trailingMatch ? trailingMatch[2] : '';

        if (isValidHttpUrl(rawUrl)) {
          return (
            <React.Fragment key={pIdx}>
              <a
                href={rawUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 underline text-[11px] font-mono break-all inline-flex items-center gap-0.5"
              >
                <span>{rawUrl}</span>
                <ExternalLink className="w-2.5 h-2.5 inline" />
              </a>
              {trailingPunct}
            </React.Fragment>
          );
        }
        return renderDatabaseSourceBadge(pIdx, part);
      }

      return part;
    });
  };

  return (
    <div className={`group py-4 px-4 sm:px-6 transition-colors border-b ${
      isUser 
        ? 'bg-zinc-50/50 border-zinc-100' 
        : 'bg-white border-zinc-200/80 hover:bg-zinc-50/30'
    }`}>
      <div className="max-w-4xl mx-auto flex gap-3.5">
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          {isUser ? (
            <div className="w-7 h-7 rounded-md bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-xs border border-zinc-300">
              <User className="w-3.5 h-3.5 text-zinc-700" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-md bg-indigo-700 text-white flex items-center justify-center shadow-xs">
              <Ship className="w-4 h-4 text-white stroke-[2.2]" />
            </div>
          )}
        </div>

        {/* Message Content Body */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Header Row (GitHub Copilot style metadata bar) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-zinc-900">
                {isUser ? 'You' : 'Maritime Intelligence Expert'}
              </span>

              {!isUser && message.durationMs && (
                <span className="text-[11px] text-zinc-400 font-mono">
                  {(message.durationMs / 1000).toFixed(2)}s
                </span>
              )}

              <span className="text-[11px] text-zinc-400 font-mono">
                {message.timestamp}
              </span>
            </div>

            {/* Copilot Action Toolbar (Hover state) */}
            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="p-1 text-zinc-400 hover:text-zinc-800 rounded hover:bg-zinc-100 transition-colors"
                title="Copy response"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {!isUser && (
                <>
                  <button
                    onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
                    className={`p-1 rounded hover:bg-zinc-100 transition-colors ${feedback === 'up' ? 'text-indigo-700 font-bold' : 'text-zinc-400 hover:text-zinc-800'}`}
                    title="Helpful response"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
                    className={`p-1 rounded hover:bg-zinc-100 transition-colors ${feedback === 'down' ? 'text-rose-600 font-bold' : 'text-zinc-400 hover:text-zinc-800'}`}
                    title="Not helpful"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                  {message.traceId && onOpenTrace && (
                    <button
                      onClick={() => onOpenTrace(message.traceId!)}
                      className="px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded flex items-center gap-1 transition-colors ml-1 shadow-2xs"
                      title="Inspect Execution Trace"
                    >
                      <BarChart2 className="w-3 h-3" />
                      <span>Trace</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Copilot-style References summary chip (Clean, NO heavy accordion) */}
          {!isUser && message.status === 'complete' && (
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium py-0.5">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              <span>Agentic AI Tools</span>
            </div>
          )}

          {/* Active Streaming Thinking Indicator */}
          {message.status && message.status !== 'complete' && message.status !== 'error' && (
            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 mt-1 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700">
                <Sparkles className="w-4 h-4 animate-spin text-indigo-700" />
                <span>{message.statusMessage || 'Processing query...'}</span>
              </div>
              {message.searchTopics && message.searchTopics.length > 0 && (
                <div className="pl-6 space-y-1">
                  <p className="text-[11px] text-zinc-500 font-medium">Targeted Maritime Queries:</p>
                  <ul className="text-[11px] text-zinc-700 space-y-0.5 font-mono">
                    {message.searchTopics.map((topic, tIdx) => (
                      <li key={tIdx} className="list-disc ml-3">
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Main Formatted Content */}
          <div className="text-xs text-zinc-900 leading-relaxed pt-1">
            {renderFormattedContent(message.content)}
          </div>
        </div>
      </div>
    </div>
  );
};
