'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { Sparkles, Trash2, AlertCircle, WifiOff, Zap, User } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useChat } from '@/hooks/use-chat';
import { MessageBubble, ChatInput, SourcesPanel, TypingIndicator } from '@/components/chat';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';

function ChatPageInner() {
  // L'atleta arriva nell'URL (pulsante sulla scheda atleta). Senza passarlo
  // all'hook, `athlete_id` non raggiunge l'API e l'ai-service non costruisce
  // il contesto: la chat rispondeva "non ho informazioni su questo atleta"
  // anche aperta dalla sua scheda.
  const params = useSearchParams();
  const athleteId = params.get('athlete') ?? undefined;
  const [athleteName, setAthleteName] = useState<string | null>(null);

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
    namespaces: ['protocols', 'exercises', 'periodization', 'references'],
    athleteId,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('chat');
  const tCommon = useTranslations('common');

  const suggestions = [
    t('suggestion1'),
    t('suggestion2'),
    t('suggestion3'),
    t('suggestion4'),
  ];

  // Il nome si chiede all'API, non all'URL: in barra degli indirizzi (e
  // quindi in cronologia, log e referrer) resta il solo id.
  useEffect(() => {
    if (!athleteId) {
      setAthleteName(null);
      return;
    }
    let cancelled = false;
    apiFetch<{ data: { firstName: string; lastName: string } }>(`/athletes/${athleteId}`)
      .then((res) => {
        if (!cancelled) {
          setAthleteName(`${res.data.firstName} ${res.data.lastName}`.trim());
        }
      })
      .catch(() => {
        // L'etichetta e' decorativa: se non arriva, la chat funziona lo stesso.
      });
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

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

          {athleteName && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <User className="h-3.5 w-3.5" />
              {athleteName}
            </span>
          )}
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
            {tCommon('close')}
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
          {suggestions.map((suggestion) => (
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

export default function ChatPage() {
  // useSearchParams va isolato dentro un confine Suspense, come nelle altre
  // pagine che leggono la query string.
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}
