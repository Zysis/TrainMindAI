'use client';

import { useState, useCallback, useRef } from 'react';

// ============================================================
// Types (inline to avoid ai-sdk build dependency issues at dev time)
// ============================================================

export interface ChatMessageUI {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: SourceUI[];
  isStreaming?: boolean;
}

export interface SourceUI {
  id: string;
  title: string;
  category: string;
  score: number;
}

interface SSEEvent {
  type: 'content' | 'sources' | 'done' | 'error';
  chunk?: string;
  sources?: SourceUI[];
  full_content?: string;
  message?: string;
}

interface UseChatOptions {
  /** AI service base URL — default `/api/ai-svc` (proxied by Next.js to ai-service container). */
  aiBaseUrl?: string;
  /** Athlete ID for personalization */
  athleteId?: string;
  /** Namespaces to search in the knowledge base */
  namespaces?: string[];
  /** Initial system greeting */
  greeting?: string;
}

interface UseChatReturn {
  messages: ChatMessageUI[];
  input: string;
  setInput: (value: string) => void;
  sendMessage: () => Promise<void>;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  clearError: () => void;
  clearMessages: () => void;
  isServiceAvailable: boolean | null;
}

const DEFAULT_GREETING =
  'Ciao! Sono il tuo assistente AI per la preparazione fisica nel basket. Posso aiutarti con programmazione allenamenti, analisi dati atleti, protocolli di recupero e molto altro. Come posso aiutarti?';

/**
 * Hook for managing AI chat interactions with SSE streaming.
 *
 * Calls the FastAPI AI service directly from the browser.
 * Supports real-time streaming responses via Server-Sent Events.
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const {
    aiBaseUrl = '/api/ai-svc',
    athleteId,
    namespaces = ['protocols', 'exercises'],
    greeting = DEFAULT_GREETING,
  } = options;

  const [messages, setMessages] = useState<ChatMessageUI[]>([
    {
      id: 'greeting',
      role: 'assistant',
      content: greeting,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isServiceAvailable, setIsServiceAvailable] = useState<boolean | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  /**
   * Check AI service health on first interaction
   */
  const checkHealth = useCallback(async (): Promise<boolean> => {
    if (isServiceAvailable === true) return true;

    try {
      const res = await fetch(`${aiBaseUrl}/health`, { signal: AbortSignal.timeout(5000) });
      const ok = res.ok;
      setIsServiceAvailable(ok);
      return ok;
    } catch {
      setIsServiceAvailable(false);
      return false;
    }
  }, [aiBaseUrl, isServiceAvailable]);

  /**
   * Build the messages array for the API request.
   * Includes conversation history (last 20 messages).
   */
  const buildApiMessages = useCallback(
    (userContent: string) => {
      const historyMessages = messages
        .filter((m) => m.id !== 'greeting')
        .slice(-20)
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      return [
        ...historyMessages,
        { role: 'user' as const, content: userContent },
      ];
    },
    [messages]
  );

  /**
   * Send a message and receive a streaming response.
   */
  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setError(null);

    // Check service health on first message
    const healthy = await checkHealth();
    if (!healthy) {
      setError('Il servizio AI non è raggiungibile. Verifica che il container ai-service di trainmind-app sia avviato (docker compose up -d ai-service llm-server).');
      return;
    }

    // Add user message
    const userMsg: ChatMessageUI = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    // Add placeholder assistant message for streaming
    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessageUI = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);

    // Abort any previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    try {
      const apiMessages = buildApiMessages(trimmed);

      const response = await fetch(`${aiBaseUrl}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          stream: true,
          athlete_id: athleteId || undefined,
          namespaces,
          top_k: 5,
          temperature: 0.7,
          max_tokens: 2048,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Errore dal servizio AI (${response.status})`);
      }

      if (!response.body) {
        throw new Error('Nessun body nella risposta streaming');
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let sources: SourceUI[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines[lines.length - 1];

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (!line || !line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const event: SSEEvent = JSON.parse(jsonStr);

            if (event.type === 'content' && event.chunk) {
              fullContent += event.chunk;
              // Update assistant message with accumulated content
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: fullContent }
                    : m
                )
              );
            } else if (event.type === 'sources' && event.sources) {
              sources = event.sources;
            } else if (event.type === 'done') {
              if (event.full_content) {
                fullContent = event.full_content;
              }
            } else if (event.type === 'error') {
              throw new Error(event.message || 'Errore streaming');
            }
          } catch (parseErr) {
            // Skip unparseable lines
            if (parseErr instanceof Error && parseErr.message !== 'Errore streaming') {
              continue;
            }
            throw parseErr;
          }
        }
      }

      // Finalize: mark streaming complete, attach sources
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: fullContent || 'Nessuna risposta ricevuta.',
                isStreaming: false,
                sources: sources.length > 0 ? sources : undefined,
              }
            : m
        )
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled - remove empty assistant message
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        return;
      }

      const errorMsg =
        err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(errorMsg);

      // Update assistant message with error
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: 'Mi dispiace, si è verificato un errore. Riprova.',
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isLoading, checkHealth, buildApiMessages, aiBaseUrl, athleteId, namespaces]);

  const clearError = useCallback(() => setError(null), []);

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: 'greeting',
        role: 'assistant',
        content: greeting,
        timestamp: new Date(),
      },
    ]);
    setError(null);
  }, [greeting]);

  return {
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
  };
}
