import React, { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import type {
  ChatMessage,
  CurrentAirQualityResponse,
  SelectedLocation,
  UserLifestyleProfile,
} from '../types/airQuality';
import {
  getPrimaryIndex,
  HOUSEHOLD_LABELS,
} from '../utils/airQualityHelpers';

interface AssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  location: SelectedLocation;
  airQuality: CurrentAirQualityResponse | null;
  profile: UserLifestyleProfile;
  messages: ChatMessage[];
  isSending: boolean;
  error: string | null;
  onSendMessage: (text: string) => void;
}

const STARTER_PROMPTS = [
  'When is the safest window to open windows today?',
  'How do I build a low-cost MERV-13 filter box at home?',
  'What mask fit works best for kids walking to school in smog?',
  'How much does replacing 3 car trips a week cut local PM2.5?',
];

export function AssistantDrawer({
  isOpen,
  onClose,
  location,
  airQuality,
  profile,
  messages,
  isSending,
  error,
  onSendMessage,
}: AssistantDrawerProps) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { preferred } = getPrimaryIndex(airQuality);

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft('');
    onSendMessage(text);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="ClearHearth Air Quality Assistant"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="relative z-10 w-full max-w-md bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">
              ClearHearth Smog Advisor
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {location.name}
              {preferred ? ` · ${preferred.displayName} ${preferred.aqiDisplay}` : ''} ·{' '}
              {HOUSEHOLD_LABELS[profile.householdGroup]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assistant"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conversation Thread */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
        >
          {messages.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Ask anything about navigating winter smog in{' '}
                <span className="font-semibold text-slate-900">{location.name}</span>.
                Every answer is grounded in live pollutant readings, your 36-hour forecast, and your household profile.
              </p>

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400">
                  Suggested questions
                </p>
                <div className="space-y-2">
                  {STARTER_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => onSendMessage(q)}
                      className="w-full text-left px-3.5 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:border-teal-600 hover:text-slate-900 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-50 border border-slate-200 text-slate-800'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[11px] font-mono text-slate-400 mt-1 px-1">
                  {msg.role === 'user' ? 'You' : 'Advisor'} · {msg.timestamp}
                </span>
              </div>
            ))
          )}

          {isSending && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500 max-w-[80%]">
              Analyzing live air conditions for {location.name}...
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5 text-xs text-rose-800">
              {error}
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-slate-200 bg-white"
        >
          <div className="flex items-center gap-2">
            <label htmlFor="assistant-input" className="sr-only">
              Ask about local smog, indoor filtration, or daily routines
            </label>
            <input
              ref={inputRef}
              id="assistant-input"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about ventilation, masks, commute swaps..."
              className="flex-1 h-10 px-3.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-700"
            />
            <button
              type="submit"
              disabled={isSending || !draft.trim()}
              aria-label="Send message"
              className="h-10 px-3.5 inline-flex items-center justify-center bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Environmental &amp; lifestyle guidance only; consult a clinician for respiratory symptoms.
          </p>
        </form>
      </div>
    </div>
  );
}
