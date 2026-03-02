"use client";

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { FiSend } from 'react-icons/fi';
import { CheckCircle, CircleDot, Rocket, FolderOpen, Brain, Loader2 } from 'lucide-react';

import { ChatPhase, setSelectedAI } from '@/lib/store/slices/chatSlice';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../lib/store/store';

import { AI_MODELS } from '../../../utils/constants';
import { ModelSelector } from '@/components/ModelSelector';

interface SidebarProps {
    chatMessages: { role: 'user' | 'assistant' | 'system', content: string }[];
    isTyping: boolean;
    chatInput: string;
    setChatInput: (input: string) => void;
    handleSendMessage: () => void;
    phase: ChatPhase;
    thinkingText: string;
}

// ─── Message parsers ────────────────────────────────────────────────────────

function parsePlanSteps(raw: string) {
    return raw.split('\n').filter(s => s.trim()).map(s => {
        const isDone = s.startsWith('[x]') || s.startsWith('- [x]');
        const label = s.replace(/^(\[x\]|\[ \]|-\s*\[x\]|-\s*\[ \])\s*/, '').trim();
        return { label, done: isDone };
    });
}

function parseStepFiles(raw: string): string[] {
    return raw.split('\n').map(f => f.replace(/^([-* ]*)/, '').trim()).filter(Boolean);
}

/** Streaming Typewriter Effect */
function StreamingText({ text, speed = 8, onComplete }: { text: string, speed?: number, onComplete?: () => void }) {
    const [displayedText, setDisplayedText] = React.useState('');
    const [index, setIndex] = React.useState(0);

    useEffect(() => {
        if (index < text.length) {
            const timeout = setTimeout(() => {
                setDisplayedText(prev => prev + text[index]);
                setIndex(prev => prev + 1);
            }, speed);
            return () => clearTimeout(timeout);
        } else if (onComplete) {
            onComplete();
        }
    }, [index, text, speed, onComplete]);

    return <span>{displayedText}</span>;
}

// ─── Rendered message types ──────────────────────────────────────────────────

/** Render <plan> block as a checklist */
function PlanBlock({ raw }: { raw: string }) {
    const steps = parsePlanSteps(raw);
    return (
        <div className="mb-3 p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-lg">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Brain className="size-3 text-indigo-400" />
                <span>Task Plan</span>
            </div>
            <div className="space-y-1.5">
                {steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10.5px]">
                        <div className={cn("size-1.5 rounded-full shrink-0", step.done ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-zinc-700")} />
                        <span className={cn("font-medium", step.done ? "text-zinc-500 line-through" : "text-zinc-300")}>
                            {step.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Render <step> block (per-task files list) */
function StepBlock({ taskName, filesRaw }: { taskName: string; filesRaw: string }) {
    const files = parseStepFiles(filesRaw);
    return (
        <div className="mb-2 p-2.5 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
            <div className="flex items-center gap-2 text-[11px] text-zinc-300 font-semibold mb-2">
                <CheckCircle className="size-3.5 text-emerald-400" />
                <span>{taskName}</span>
            </div>
            <div className="pl-5 space-y-1 border-l border-zinc-800/50 ml-1.5">
                {files.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                        <span className="opacity-50">📄</span>
                        <span>{file}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Parse and render an assistant message using the right ai-element component */
function AssistantMessage({ content, isLatest }: { content: string; isLatest?: boolean }) {
    // Special: "🚀" launch message
    if (content.startsWith('🚀')) {
        return (
            <div className="flex items-center gap-2 text-emerald-400 text-[12px] font-semibold py-1">
                <Rocket className="size-4" />
                <span>{content}</span>
            </div>
        );
    }

    const parts: React.ReactNode[] = [];
    let remaining = content;
    let key = 0;

    // Extract <thinking> blocks
    const thinkingMatch = remaining.match(/<thinking>([\s\S]*?)(?:<\/thinking>|$)/);
    if (thinkingMatch) {
        parts.push(
            <div key={key++} className="mb-3 p-2.5 bg-zinc-900/40 border border-zinc-800/60 rounded-md text-[11px] text-zinc-400 italic">
                <div className="flex items-center gap-1.5 mb-1.5 text-indigo-400/80 font-bold uppercase tracking-widest text-[9px]">
                    <Brain className="size-3" />
                    <span>Thinking</span>
                </div>
                {thinkingMatch[1].trim()}
            </div>
        );
        remaining = remaining.replace(/<thinking>[\s\S]*?(?:<\/thinking>|$)/, '').trim();
    }

    // Extract <plan> block
    const planMatch = remaining.match(/<plan>([\s\S]*?)(?:<\/plan>|$)/);
    if (planMatch) {
        parts.push(<PlanBlock key={key++} raw={planMatch[1].trim()} />);
        remaining = remaining.replace(/<plan>[\s\S]*?(?:<\/plan>|$)/, '').trim();
    }

    // Extract "✦ I have implemented: **TaskName**\n<step task="...">...</step>"
    const stepWrapMatch = remaining.match(/✦ I have implemented: \*\*(.+?)\*\*\n<step task="[^"]*">([\s\S]*?)<\/step>/);
    if (stepWrapMatch) {
        parts.push(<StepBlock key={key++} taskName={stepWrapMatch[1]} filesRaw={stepWrapMatch[2]} />);
        remaining = remaining.replace(/✦ I have implemented: \*\*(.+?)\*\*\n<step task="[^"]*">[\s\S]*?<\/step>/, '').trim();
    }

    // Extract lone <step> blocks (fallback)
    const stepMatch = remaining.match(/<step(?:\s[^>]*)?>([\s\S]*?)<\/step>/);
    if (stepMatch) {
        const files = parseStepFiles(stepMatch[1]);
        parts.push(
            <div key={key++} className="mb-2 p-2.5 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <FolderOpen className="size-3" />
                    <span>Files Created</span>
                </div>
                <div className="space-y-1">
                    {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                            <span className="opacity-50">📄</span>
                            <span>{f}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
        remaining = remaining.replace(/<step(?:\s[^>]*)?>[\s\S]*?<\/step>/, '').trim();
    }

    // Extract <files> blocks
    const filesMatch = remaining.match(/<files>([\s\S]*?)(?:<\/files>|$)/);
    if (filesMatch) {
        const fileList = parseStepFiles(filesMatch[1]);
        parts.push(
            <div key={key++} className="mb-2 p-2.5 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <FolderOpen className="size-3" />
                    <span>Provisioned Assets</span>
                </div>
                <div className="space-y-1">
                    {fileList.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                            <span className="opacity-50">📄</span>
                            <span>{f}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
        remaining = remaining.replace(/<files>[\s\S]*?(?:<\/files>|$)/, '').trim();
    }

    // Render any remaining plain text
    if (remaining) {
        const textParts: React.ReactNode[] = [];
        const codeRegex = /```(\w*)\n?([\s\S]*?)```/g;
        let lastIdx = 0;
        let match;
        let k = 0;
        while ((match = codeRegex.exec(remaining)) !== null) {
            if (match.index > lastIdx) {
                textParts.push(<span key={k++}>{remaining.slice(lastIdx, match.index)}</span>);
            }
            textParts.push(
                <pre key={k++} className="bg-black/50 p-2 rounded my-1 font-mono text-[10px] overflow-x-auto border border-zinc-800">
                    <code>{match[2].trim()}</code>
                </pre>
            );
            lastIdx = match.index + match[0].length;
        }
        if (lastIdx < remaining.length) {
            const textToRender = remaining.slice(lastIdx);
            textParts.push(
                <div key={k++} className="whitespace-pre-wrap">
                    {isLatest ? <StreamingText text={textToRender} /> : textToRender}
                </div>
            );
        }
        parts.push(<div key={key++} className="text-[12.5px]">{textParts}</div>);
    }

    return <div className="w-full flex flex-col gap-1">{parts}</div>;
}

// ─── Phase Indicator ─────────────────────────────────────────────────────────

const PHASE_LABELS: Record<ChatPhase, string> = {
    idle: '',
    thinking: 'Analyzing your request…',
    planning: 'Architecting the plan…',
    executing: 'Building your project…',
    launching: 'Starting dev server…',
    done: '',
};

function PhaseIndicator({ phase }: { phase: ChatPhase }) {
    const label = PHASE_LABELS[phase];
    if (!label) return null;

    return (
        <div className="flex items-center gap-2 text-zinc-400 text-[10px] ml-1 animate-in fade-in duration-500">
            <Loader2 className="size-3 animate-spin text-indigo-400" />
            <Shimmer className="font-medium">{label}</Shimmer>
        </div>
    );
}

// ─── Main Sidebar Component ──────────────────────────────────────────────────

export default function Sidebar({
    chatMessages,
    isTyping,
    chatInput,
    setChatInput,
    handleSendMessage,
    phase,
    thinkingText,
}: SidebarProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const dispatch = useDispatch();
    const selectedProvider = useSelector((state: RootState) => state.chat.selectedProvider);
    const selectedModel = useSelector((state: RootState) => state.chat.selectedModel);


    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isTyping, phase, thinkingText]);

    return (
        <aside className="w-1/3 min-w-[288px] flex flex-col overflow-hidden border-r border-zinc-800/60 bg-[#0a0a0c] z-40 shadow-2xl">
            {/* Top Label */}
            <div className="px-4 py-3 border-b border-zinc-800">
                <span className="text-zinc-400 uppercase text-xs font-semibold tracking-widest">
                    Lysis Oracle
                </span>
            </div>

            {/* Chat History Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 custom-scrollbar">
                {chatMessages.length === 0 && phase === 'idle' && (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center px-4 py-16">
                        <div className="text-4xl mb-3">⚡</div>
                        <p className="text-xs font-medium">Core AI Offline. <br />Initialize with a prompt.</p>
                    </div>
                )}

                {chatMessages.map((msg, i) => {
                    if (msg.role === 'system') return null;

                    if (msg.role === 'user') {
                        return (
                            <div key={i} className="flex flex-col gap-1 max-w-[90%] ml-auto items-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="px-3 py-2 rounded-sm text-[12.5px] leading-relaxed bg-zinc-800 text-white">
                                    {msg.content}
                                </div>
                                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter px-1">OPERATOR</span>
                            </div>
                        );
                    }

                    // Assistant messages
                    const isLatest = i === chatMessages.length - 1;
                    return (
                        <div key={i} className="flex flex-col gap-1 w-full mr-auto items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="w-full px-3 py-2.5 rounded-md bg-zinc-900/50 text-zinc-200 rounded-tl-none border border-zinc-800/80 shadow-black/20">
                                <AssistantMessage content={msg.content} isLatest={isLatest} />
                            </div>
                            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter px-1">LYSIS CORE</span>
                        </div>
                    );
                })}

                {/* Live Thinking Phase — shows streaming AI thinking before any response */}
                {phase === 'thinking' && (
                    <div className="flex flex-col gap-1 w-full mr-auto items-start animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="w-full px-3 py-2.5 rounded-md bg-zinc-900/50 text-zinc-200 rounded-tl-none border border-zinc-800/80 shadow-black/20">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase tracking-widest text-[9px]">
                                    <Brain className="size-3 animate-pulse" />
                                    <span>Thinking</span>
                                </div>
                                <div className="text-[11px] opacity-75 max-h-40 overflow-y-auto italic text-zinc-400">
                                    {thinkingText || 'Processing your request…'}
                                </div>
                            </div>
                        </div>
                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter px-1">LYSIS CORE</span>
                    </div>
                )}

                {/* Phase indicator for non-thinking active phases */}
                {phase !== 'idle' && phase !== 'done' && phase !== 'thinking' && (
                    <PhaseIndicator phase={phase} />
                )}

                <div ref={bottomRef} />
            </div>

            {/* Bottom Prompt Input */}
            <div className="p-4 backdrop-blur-md">
                <div className='relative h-40 rounded-sm border border-zinc-700/50 hover:border-zinc-600 transition-colors flex flex-col bg-zinc-900/30'>

                    <textarea
                        className="w-full h-3/6 top-2 absolute bg-transparent px-5 py-2 text-zinc-100 placeholder-zinc-600 outline-none resize-none text-md "
                        placeholder="Ask to build..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        autoFocus
                    />

                    {/* Bottom Input Actions */}
                    <div className="absolute bottom-4 left-6 right-4 flex justify-between items-center ">

                        <div className=" flex items-center gap-2 p-2 cursor-pointer">
                            <ModelSelector />
                        </div>
                        <button
                            onClick={handleSendMessage}
                            className="ml-auto cursor-pointer pointer-events-auto w-8 h-8 bg-white hover:bg-zinc-200 text-black rounded flex items-center justify-center transition-all duration-200 active:scale-95 shadow-xl"
                        >
                            <FiSend className="text-lg" />
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}

