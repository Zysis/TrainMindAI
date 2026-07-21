'use client';

import { Bot, User } from 'lucide-react';
import type { ChatMessageUI } from '@/hooks/use-chat';

interface MessageBubbleProps {
  message: ChatMessageUI;
}

/**
 * Renders markdown-lite formatting:
 * **bold**, ### headings, - lists, `code`, ```code blocks```
 */
function formatContent(content: string) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  lines.forEach((line, i) => {
    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${i}`}
            className="my-2 overflow-x-auto rounded-lg bg-slate-800 p-3 text-xs text-slate-100"
          >
            <code>{codeBuffer.join('\n')}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // Heading
    if (line.startsWith('### ')) {
      elements.push(
        <p key={i} className="mt-3 mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
          {line.slice(4)}
        </p>
      );
      return;
    }

    if (line.startsWith('## ')) {
      elements.push(
        <p key={i} className="mt-3 mb-1 text-sm font-bold text-slate-900 dark:text-white">
          {line.slice(3)}
        </p>
      );
      return;
    }

    // Table row
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // Skip separator rows
      if (/^\|[\s-:|]+\|$/.test(line.trim())) return;

      const cells = line
        .split('|')
        .filter((c) => c.trim())
        .map((c) => c.trim());

      elements.push(
        <div key={i} className="flex gap-4 text-xs py-0.5">
          {cells.map((cell, ci) => (
            <span key={ci} className={ci === 0 ? 'font-medium min-w-[120px]' : 'text-slate-600 dark:text-slate-400'}>
              {cell}
            </span>
          ))}
        </div>
      );
      return;
    }

    // Bullet list
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const text = line.trim().slice(2);
      elements.push(
        <p key={i} className="ml-3 text-sm before:content-['•'] before:mr-2 before:text-teal-500">
          {renderInline(text)}
        </p>
      );
      return;
    }

    // Numbered list
    const numMatch = line.trim().match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      elements.push(
        <p key={i} className="ml-3 text-sm">
          <span className="mr-2 font-medium text-teal-600">{numMatch[1]}.</span>
          {renderInline(numMatch[2])}
        </p>
      );
      return;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-1" />);
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm">
        {renderInline(line)}
      </p>
    );
  });

  return elements;
}

/** Render inline formatting: **bold**, `code` */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Inline code
    const codeMatch = remaining.match(/`([^`]+)`/);

    let firstMatch: { index: number; length: number; type: 'bold' | 'code'; content: string } | null = null;

    if (boldMatch && boldMatch.index !== undefined) {
      firstMatch = { index: boldMatch.index, length: boldMatch[0].length, type: 'bold', content: boldMatch[1] };
    }
    if (codeMatch && codeMatch.index !== undefined) {
      if (!firstMatch || codeMatch.index < firstMatch.index) {
        firstMatch = { index: codeMatch.index, length: codeMatch[0].length, type: 'code', content: codeMatch[1] };
      }
    }

    if (!firstMatch) {
      parts.push(remaining);
      break;
    }

    // Text before match
    if (firstMatch.index > 0) {
      parts.push(remaining.slice(0, firstMatch.index));
    }

    if (firstMatch.type === 'bold') {
      parts.push(
        <strong key={`b-${key++}`} className="font-semibold">
          {firstMatch.content}
        </strong>
      );
    } else {
      parts.push(
        <code key={`c-${key++}`} className="rounded bg-slate-200 px-1 py-0.5 text-xs font-mono text-teal-700">
          {firstMatch.content}
        </code>
      );
    }

    remaining = remaining.slice(firstMatch.index + firstMatch.length);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {/* Avatar assistente */}
      {!isUser && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-teal-100">
          <Bot className="h-4 w-4 text-teal-700" />
        </div>
      )}

      {/* Bolla messaggio */}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-teal-700 text-white'
            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="space-y-0.5">{formatContent(message.content)}</div>
        )}

        {/* Indicatore streaming */}
        {message.isStreaming && (
          <span className="inline-flex mt-1">
            <span className="animate-pulse text-teal-500">●</span>
          </span>
        )}
      </div>

      {/* Avatar utente */}
      {isUser && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-200">
          <User className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        </div>
      )}
    </div>
  );
}
