'use client';

import { useEffect, useRef } from 'react';
import { Sparkles, Trash2, AlertCircle, WifiOff, Zap } from 'lucide-react';
import { useChat } from '@/hooks/use-chat';
import { MessageBubble, ChatInput, SourcesPanel, TypingIndicator } from '@/components/chat';
import { useTranslations } from 'next-intl';

export default function ChatPage() {
  const {
    messages,
    input,
    setInput,
    sendMessage,
    isLoading,
    isStreaming,
    error,
    clearError,
    clearMessages,
    isServiceAvailable,
  } = useChat({
    // Use mobile-internal proxy so the request becomes same-origin (no CORS),
    // and the actual ai-service URL is configured server-side via AI_INTERNAL_URL.
    aiBaseUrl: '/api/ai-svc',
    namespaces: ['protocols', 'exercises', 'periodization', 'references'],
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('chat');

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex h-[calc(100vh-var(--topbar-height)-3rem)] flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
            <Sparkles className="h-5 w-5 text-teal-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{t('title')}</h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('subtitle')}
              </p>
              {isServiceAvailable === true && (
                <span className="flex items-center gap-1 text-2xs text-green-600">
                  <Zap className="h-3 w-3" /> Online
                </span>
              )}
              {isServiceAvailable === false && (
                <span className="flex items-center gap-1 text-2xs text-red-500">
                  <WifiOff className="h-3 w-3" /> Offline
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Clear chat button */}
        {messages.length > 1 && (
          <button
            onClick={clearMessages}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
            title={t('clearConversation')}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('newChat')}
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
          <p className="flex-1 text-xs text-red-600">{error}</p>
          <button
            onClick={clearError}
            className="text-xs text-red-400 hover:text-red-600"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
      >
        {messages.map((msg) => (
          <div key={msg.id}>
            <MessageBubble message={msg} />
            {/* Sources panel below assistant messages */}
            {msg.role === 'assistant' && msg.sources && !msg.isStreaming && (
              <SourcesPanel sources={msg.sources} />
            )}
          </div>
        ))}

        {/* Typing indicator while waiting for first chunk */}
        {isLoading && !isStreaming && (
          <TypingIndicator />
        )}
      </div>

      {/* Quick suggestions (shown only on greeting) */}
      {messages.length === 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            'Come programmare la forza in pre-season?',
            'Protocollo prevenzione caviglia per basket',
            'Differenza tra periodizzazione ondulata e lineare',
            'Esercizi pliometrici per migliorare il salto',
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => {
                setInput(suggestion);
              }}
              className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="mt-3">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={sendMessage}
          isLoading={isLoading}
          placeholder={t('chatPlaceholder')}
        />
        <p className="mt-1.5 text-center text-2xs text-slate-400 dark:text-slate-500">
          {t('footerHint')}
        </p>
      </div>
    </div>
  );
}
