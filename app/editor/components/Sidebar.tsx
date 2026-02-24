"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { FiSend } from 'react-icons/fi';
import {
    Reasoning,
    ReasoningTrigger,
    ReasoningContent
} from '@/components/ai-elements/reasoning';
import {
    ChainOfThought,
    ChainOfThoughtHeader,
    ChainOfThoughtStep,
    ChainOfThoughtContent
} from '@/components/ai-elements/chain-of-thought';
import {
    Queue,
    QueueItem,
    QueueItemIndicator,
    QueueItemContent,
    QueueList,
    QueueSection,
    QueueSectionTrigger,
    QueueSectionLabel,
    QueueSectionContent
} from '@/components/ai-elements/queue';

interface SidebarProps {
    chatMessages: { role: 'user' | 'assistant' | 'system', content: string }[];
    isTyping: boolean;
    chatInput: string;
    setChatInput: (input: string) => void;
    handleSendMessage: () => void;
}

function MessageContent({ content }: { content: string }) {
    const parts: React.ReactNode[] = [];

    // Extract and render <thinking> blocks
    const thinkingMatch = content.match(/<thinking>([\s\S]*?)(?:<\/thinking>|$)/);
    const thinkingContent = thinkingMatch ? thinkingMatch[1].trim() : null;

    // Extract and render <plan> blocks
    const planMatch = content.match(/<plan>([\s\S]*?)(?:<\/plan>|$)/);
    const planRaw = planMatch ? planMatch[1].trim() : null;

    // Extract and render <files> blocks
    const filesMatch = content.match(/<files>([\s\S]*?)(?:<\/files>|$)/);
    const filesRaw = filesMatch ? filesMatch[1].trim() : null;

    let mainText = content
        .replace(/<thinking>[\s\S]*?(?:<\/thinking>|$)/g, '')
        .replace(/<plan>[\s\S]*?(?:<\/plan>|$)/g, '')
        .replace(/<files>[\s\S]*?(?:<\/files>|$)/g, '')
        .trim();

    if (thinkingContent) {
        parts.push(
            <Reasoning key="thinking" className="mb-2">
                <ReasoningTrigger className="text-xs" />
                <ReasoningContent className="text-xs">{thinkingContent}</ReasoningContent>
            </Reasoning>
        );
    }

    if (planRaw) {
        const steps = planRaw.split('\n').filter(s => s.trim()).map(s => {
            const isComplete = s.includes('[x]');
            const label = s.replace(/^([-* ]*\[[ x]\]\s*|[-* ]+)/, '');
            return { label, status: isComplete ? 'complete' : 'active' };
        });

        parts.push(
            <ChainOfThought key="plan" className="mb-3">
                <ChainOfThoughtHeader className="text-xs font-semibold">Project Plan</ChainOfThoughtHeader>
                <ChainOfThoughtContent>
                    {steps.map((step, i) => (
                        //@ts-ignore
                        <ChainOfThoughtStep key={i} label={step.label} status={step.status as any} className="text-[11px]" />
                    ))}
                </ChainOfThoughtContent>
            </ChainOfThought>
        );
    }

    if (filesRaw) {
        const fileList = filesRaw.split('\n').map(f => f.replace(/^([-* ]*)/, '').trim()).filter(f => f);
        parts.push(
            <Queue key="files" className="mb-3 border border-zinc-800 rounded-md overflow-hidden bg-zinc-900/50 p-1">
                <QueueSection>
                    <QueueSectionTrigger>
                        <QueueSectionLabel count={fileList.length} label="Deployed Assets" className="text-[10px]" />
                    </QueueSectionTrigger>
                    <QueueSectionContent>
                        <QueueList>
                            {fileList.map((file, i) => (
                                <QueueItem key={i}>
                                    <div className="flex items-center gap-2">
                                        <QueueItemIndicator completed />
                                        <QueueItemContent completed className="text-[11px] font-mono">{file}</QueueItemContent>
                                    </div>
                                </QueueItem>
                            ))}
                        </QueueList>
                    </QueueSectionContent>
                </QueueSection>
            </Queue>
        );
    }

    // Basic code block rendering
    const textParts: React.ReactNode[] = [];
    const regex = /```(\w*)\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    let k = 0;

    while ((match = regex.exec(mainText)) !== null) {
        if (match.index > lastIndex) {
            textParts.push(<span key={k++}>{mainText.slice(lastIndex, match.index)}</span>);
        }
        textParts.push(
            <pre key={k++} className="bg-black/50 p-2 rounded my-1 font-mono text-[10px] overflow-x-auto border border-zinc-800">
                <code>{match[2].trim()}</code>
            </pre>
        );
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < mainText.length) {
        textParts.push(<span key={k++}>{mainText.slice(lastIndex)}</span>);
    }

    parts.push(<div key="main" className="whitespace-pre-wrap">{textParts}</div>);

    return <div className="w-full flex flex-col">{parts}</div>;
}

export default function Sidebar({
    chatMessages,
    isTyping,
    chatInput,
    setChatInput,
    handleSendMessage,
}: SidebarProps) {
    return (
        <aside className="w-1/3 min-w-[288px] flex flex-col overflow-hidden border-r border-zinc-800 bg-zinc-900 z-40">
            {/* Top Label */}
            <div className="px-4 py-3 border-b border-zinc-800">
                <span className="text-zinc-400 uppercase text-xs font-semibold tracking-widest">
                    Lysis Oracle
                </span>
            </div>

            {/* Chat History Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6 custom-scrollbar">
                {chatMessages.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center px-4">
                        <div className="text-4xl mb-3">⚡</div>
                        <p className="text-xs font-medium">Core AI Offline. <br /> Initialize with a prompt.</p>
                    </div>
                )}

                {chatMessages.map((msg: { role: string, content: string }, i: number) => (
                    <div key={i} className={cn(
                        "flex flex-col gap-1.5 max-w-[95%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                        msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start w-full"
                    )}>
                        <div className={cn(
                            "px-4 py-3 rounded-md text-[13px] leading-relaxed shadow-lg w-full",
                            msg.role === 'user'
                                ? "bg-indigo-600/90 text-white rounded-tr-none shadow-indigo-500/10 ml-auto max-w-[90%]"
                                : "bg-zinc-900/50 text-zinc-200 rounded-tl-none border border-zinc-800 shadow-black/20"
                        )}>
                            <MessageContent content={msg.content} />
                        </div>
                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter px-1">
                            {msg.role === 'user' ? 'OPERATOR' : 'LYSIS CORE'}
                        </span>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex items-center gap-2 text-zinc-500 text-[10px] animate-pulse ml-1">
                        <div className="flex gap-1">
                            <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce"></span>
                            <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                        Lysis is architecting...
                    </div>
                )}
            </div>

            {/* Bottom Prompt Input */}
            <div className="p-4 backdrop-blur-md">

                <div className={`relative bg-[#0a0a0a]/80 rounded-sm border transition-colors duration-300 flex flex-col
                    border-zinc-800 group-focus-within:border-zinc-700
                    `}>
                    <textarea
                        className="w-full relative bg-transparent top-5 left-5 text-zinc-100 placeholder-zinc-600 outline-none resize-none text-sm h-38 pb-8 focus:ring-0"
                        placeholder="Ask to build..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                    />

                    {/* Bottom Input Actions */}
                    <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">


                        <button
                            onClick={handleSendMessage}
                            className="ml-auto cursor-pointer w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-sm  flex items-center gap-2 transition-all duration-200 active:scale-95 shadow-sm flex items-center justify-center"
                        >
                            <FiSend />
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}

