'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  preview: string;
}

const INITIAL_SESSIONS: ChatSession[] = [
  { id: '1', title: 'New Chat', preview: 'Start a new conversation' },
];

function TypingIndicator() {
  return (
    <div className="flex gap-1.5 items-center p-1 px-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-text-3 animate-bounce" />
      <span className="w-1.5 h-1.5 rounded-full bg-text-3 animate-bounce [animation-delay:0.2s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-text-3 animate-bounce [animation-delay:0.4s]" />
    </div>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl overflow-hidden border border-line my-2 bg-bg-base">
      <div className="flex justify-between items-center p-1.5 px-3.5 bg-line/50 border-b border-line">
        <span className="text-[11px] text-text-3 font-mono font-semibold">{lang || 'code'}</span>
        <button className="text-[11px] text-blue-primary bg-transparent border-none cursor-pointer p-0.5 px-2 rounded transition-colors hover:bg-blue-primary/10" onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
      </div>
      <pre className="m-0 p-3 px-4 overflow-x-auto font-mono text-[13px] leading-relaxed text-text"><code>{code}</code></pre>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  // Simple markdown-like renderer for code blocks
  const parts: React.ReactNode[] = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      parts.push(<span key={key++} className="whitespace-pre-wrap">{text}</span>);
    }
    parts.push(<CodeBlock key={key++} lang={match[1]} code={match[2].trimEnd()} />);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(<span key={key++} className="whitespace-pre-wrap">{content.slice(lastIndex)}</span>);
  }

  return <div className="flex flex-col gap-1">{parts}</div>;
}

export default function ChatPage() {
  const [sessions] = useState<ChatSession[]>(INITIAL_SESSIONS);
  const [activeSession] = useState('1');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
  }, [input]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMsg]);

    const allMessages = [...messages, userMsg];
    const apiMessages = allMessages.map(m => ({ role: m.role, content: m.content }));

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: m.content + delta } : m)
              );
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m => m.id === assistantId
            ? { ...m, content: `⚠️ Error: ${err instanceof Error ? err.message : 'Unknown error'}` }
            : m)
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return <div className="flex h-screen overflow-hidden bg-bg-base font-sans">
    {/* ── SIDEBAR ── */}
    <aside className={cn(
      "flex flex-col w-[260px] min-w-[260px] bg-bg-surface border-r border-line transition-all duration-300 overflow-hidden",
      !sidebarOpen && "w-0 min-w-0 opacity-0"
    )}>
      <div className="flex items-center justify-between p-4 pb-3 border-b border-line">
        <a href="/" className="flex items-center gap-2 no-underline group">
          <span className="bg-gradient-to-br from-purple-400 to-blue-400 bg-clip-text text-transparent text-xl font-bold group-hover:scale-110 transition-transform">⚡</span>
          <span className="font-bold text-[15px] text-text tracking-tight group-hover:text-blue-primary transition-colors">Coder AI</span>
        </a>
        <button className="bg-transparent border-none text-text-3 cursor-pointer text-sm p-1 rounded transition-colors hover:text-text hover:bg-line/50" onClick={() => setSidebarOpen(false)} title="Close sidebar">
          ✕
        </button>
      </div>

      <button className="m-3 mt-3 mb-2 flex items-center gap-2 p-2 px-3.5 rounded-lg border border-dashed border-line bg-transparent text-text-2 cursor-pointer text-[13px] font-medium transition-all hover:border-blue-primary hover:text-blue-primary hover:bg-blue-primary/5 active:scale-95">
        <span className="text-lg leading-none">+</span> New Chat
      </button>

      <div className="flex-1 overflow-y-auto p-1 px-2 custom-scrollbar">
        {sessions.map(s => (
          <div
            key={s.id}
            className={cn(
              "p-2.5 px-3 rounded-lg cursor-pointer transition-colors mb-0.5 hover:bg-line/50 group",
              s.id === activeSession ? "bg-blue-primary/10 border border-blue-primary/20" : "border border-transparent"
            )}
          >
            <div className={cn("text-[13px] font-semibold mb-0.5 transition-colors", s.id === activeSession ? "text-blue-primary" : "text-text group-hover:text-blue-primary")}>{s.title}</div>
            <div className="text-[11px] text-text-3 whitespace-nowrap overflow-hidden text-ellipsis opacity-70 group-hover:opacity-100">{s.preview}</div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-line">
        <a href="/editor" className="flex items-center gap-2 p-2 px-3 rounded-lg bg-line/30 text-text-2 no-underline text-[13px] font-medium transition-all hover:text-text hover:bg-line/50 hover:shadow-sm">
          <span>🖥️</span> Open Editor
        </a>
      </div>
    </aside>

    {/* ── MAIN ── */}
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg-base relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] pointer-events-none"></div>

      {/* Header */}
      <header className="flex items-center gap-2.5 px-5 h-[52px] shrink-0 bg-bg-surface/80 backdrop-blur-xl border-b border-line z-20">
        {!sidebarOpen && (
          <button className="bg-transparent border-none text-text-3 cursor-pointer text-lg p-1 px-2 rounded-md transition-all hover:text-text hover:bg-line/50" onClick={() => setSidebarOpen(true)} title="Open sidebar">
            ☰
          </button>
        )}
        <div className="flex items-center gap-3 flex-1">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-primary/10 border border-blue-primary/20 text-blue-primary font-mono tracking-wider">
            LLAMA-3.3-70B
          </span>
          <span className="text-[10px] font-bold text-text-3 uppercase tracking-widest opacity-60">Powered by Groq</span>
        </div>
        <a href="/editor" className="text-[11px] font-bold text-text-2 no-underline px-3.5 py-1.5 border border-line rounded-lg bg-line/30 transition-all hover:text-text hover:border-text-3 hover:bg-line/50 hover:shadow-sm">
          🖥️ Editor
        </a>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-6 custom-scrollbar relative z-10">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 px-5 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/5 flex items-center justify-center text-4xl mb-4 shadow-2xl shadow-blue-500/5 rotate-3 hover:rotate-0 transition-transform duration-500">
              <span className="animate-pulse">⚡</span>
            </div>
            <h2 className="text-4xl font-black text-text tracking-tighter bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              Coder AI
            </h2>
            <p className="text-sm font-medium text-text-3 max-w-[400px] leading-relaxed opacity-60">
              Your hyper-intelligent coding companion, specialized in building full-scale production ecosystems.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8 w-full max-w-[560px]">
              {[
                { icon: '🚀', text: 'Explain React hook patterns' },
                { icon: '🐛', text: 'Debug TypeScript generics' },
                { icon: '⚡', text: 'Write Next.js API routes' },
                { icon: '🎨', text: 'Create Framer Motion UI' },
              ].map((s, i) => (
                <button
                  key={i}
                  className="flex items-center gap-3 p-4 rounded-2xl cursor-pointer bg-bg-surface/50 border border-line text-text-2 text-[13px] text-left transition-all duration-300 hover:border-blue-primary/40 hover:text-text hover:bg-blue-primary/5 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/5 group"
                  onClick={() => { setInput(s.text); textareaRef.current?.focus(); }}
                >
                  <span className="text-xl grayscale group-hover:grayscale-0 transition-all">{s.icon}</span>
                  <span className="font-semibold">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn(
            "flex gap-4 items-start max-w-[85%] md:max-w-[80%] animate-in slide-in-from-bottom-2 duration-300",
            msg.role === 'user' ? "flex-row-reverse ml-auto" : "mr-auto"
          )}>
            <div className={cn(
              "w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-lg shadow-lg",
              msg.role === 'user'
                ? "bg-gradient-to-br from-purple-500 to-blue-600 border border-white/10"
                : "bg-slate-900 border border-line text-blue-400"
            )}>
              {msg.role === 'user' ? '👤' : '⚡'}
            </div>
            <div className={cn(
              "flex flex-col gap-1.5",
              msg.role === 'user' ? "items-end" : "items-start"
            )}>
              <div className={cn(
                "p-4 px-5 rounded-2xl text-[14px] leading-[1.6] break-words shadow-sm transition-all",
                msg.role === 'user'
                  ? "bg-gradient-to-br from-purple-600 to-blue-700 text-white rounded-br-sm shadow-purple-900/10"
                  : "bg-bg-surface text-text border border-line rounded-bl-sm"
              )}>
                {msg.content === '' && msg.role === 'assistant' && isStreaming
                  ? <TypingIndicator />
                  : <MessageContent content={msg.content} />
                }
              </div>
              <span className="text-[10px] font-bold text-text-3 px-1 uppercase tracking-widest opacity-40">{formatTime(msg.timestamp)}</span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-5 md:p-8 pt-0 shrink-0 relative z-20">
        <div className="max-w-4xl mx-auto">
          <div className="bg-bg-surface/50 backdrop-blur-xl border border-line rounded-2xl p-3 px-4 transition-all duration-300 focus-within:border-blue-primary/40 focus-within:shadow-2xl focus-within:shadow-blue-500/5 group">
            <div className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent border-none outline-none resize-none text-[14.5px] text-text leading-relaxed p-1.5 custom-scrollbar placeholder:text-text-3/50"
                placeholder="Ask anything about code..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                style={{ maxHeight: '200px' }}
                disabled={isStreaming}
              />
              <div className="flex items-end pb-1">
                {isStreaming ? (
                  <button
                    className="h-10 px-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 cursor-pointer text-[12px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-red-500/20 active:scale-95 transition-all"
                    onClick={stopStreaming}
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    Stop
                  </button>
                ) : (
                  <button
                    className="w-10 h-10 rounded-xl border-none cursor-pointer bg-text text-bg-base flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed group-focus-within:bg-blue-primary group-focus-within:text-white"
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    title="Send (Enter)"
                  >
                    <span className="text-xl">➤</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="text-[10px] font-bold text-text-3 text-center mt-3 uppercase tracking-[0.2em] opacity-40">
            Shift+Enter for new line · AI may generate mistakes
          </p>
        </div>
      </div>
    </main>
  </div>
    ;
}
