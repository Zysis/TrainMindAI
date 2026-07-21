'use client';

import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Lightweight markdown renderer — handles headers, bold, italic, lists, and line breaks.
 * No external dependencies needed.
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const Tag = listType;
      elements.push(
        <Tag key={key++} className={listType === 'ul' ? 'my-2 ml-4 list-disc space-y-1' : 'my-2 ml-4 list-decimal space-y-1'}>
          {listItems}
        </Tag>
      );
      listItems = [];
      listType = null;
    }
  };

  const renderInline = (text: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    // Process bold, italic, and inline code
    const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Text before match
      if (match.index > lastIndex) {
        nodes.push(text.slice(lastIndex, match.index));
      }

      if (match[2]) {
        // ***bold italic***
        nodes.push(<strong key={`bi-${match.index}`} className="font-bold italic">{match[2]}</strong>);
      } else if (match[3]) {
        // **bold**
        nodes.push(<strong key={`b-${match.index}`} className="font-semibold text-slate-800 dark:text-slate-200">{match[3]}</strong>);
      } else if (match[4]) {
        // *italic*
        nodes.push(<em key={`i-${match.index}`}>{match[4]}</em>);
      } else if (match[5]) {
        // `code`
        nodes.push(
          <code key={`c-${match.index}`} className="rounded bg-slate-100 dark:bg-slate-700 px-1 py-0.5 text-xs font-mono text-teal-700">
            {match[5]}
          </code>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }

    return nodes.length > 0 ? nodes : [text];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Empty line
    if (!line.trim()) {
      flushList();
      continue;
    }

    // Headers
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      flushList();
      elements.push(
        <h4 key={key++} className="mt-4 mb-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
          {renderInline(h3Match[1])}
        </h4>
      );
      continue;
    }

    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      flushList();
      elements.push(
        <h3 key={key++} className="mt-4 mb-1.5 text-base font-bold text-slate-900 dark:text-white">
          {renderInline(h2Match[1])}
        </h3>
      );
      continue;
    }

    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match) {
      flushList();
      elements.push(
        <h2 key={key++} className="mt-4 mb-2 text-lg font-bold text-slate-900 dark:text-white">
          {renderInline(h1Match[1])}
        </h2>
      );
      continue;
    }

    // Unordered list (- or *)
    const ulMatch = line.match(/^[\s]*[-*]\s+(.+)/);
    if (ulMatch) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(
        <li key={key++} className="text-sm text-slate-700">
          {renderInline(ulMatch[1])}
        </li>
      );
      continue;
    }

    // Ordered list (1. 2. etc)
    const olMatch = line.match(/^[\s]*\d+[.)]\s+(.+)/);
    if (olMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(
        <li key={key++} className="text-sm text-slate-700">
          {renderInline(olMatch[1])}
        </li>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      flushList();
      elements.push(<hr key={key++} className="my-3 border-slate-200 dark:border-slate-700" />);
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={key++} className="my-1.5 text-sm leading-relaxed text-slate-700">
        {renderInline(line)}
      </p>
    );
  }

  flushList();

  return <div className={`markdown-content ${className}`}>{elements}</div>;
}
