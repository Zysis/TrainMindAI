'use client';

import { useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  disabled = false,
  placeholder,
}: ChatInputProps) {
  const t = useTranslations('chat');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [value]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex items-end gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-teal-300">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? t('placeholder')}
        disabled={disabled || isLoading}
        rows={1}
        className="flex-1 resize-none bg-transparent text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-slate-500 focus:outline-none disabled:opacity-50"
        style={{ maxHeight: '120px' }}
      />
      <button
        type="button"
        // Il pulsante ha solo un'icona: senza aria-label il suo nome
        // accessibile e' vuoto (il `title` non basta per tutti i lettori di
        // schermo), e infatti nemmeno i test riuscivano a trovarlo.
        aria-label={t('sendTitle')}
        onClick={onSend}
        disabled={!value.trim() || isLoading || disabled}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white transition-all hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
        title={t('sendTitle')}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
