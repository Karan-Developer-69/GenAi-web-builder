"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { FiSend } from 'react-icons/fi';

interface SidebarProps {
    chatMessages: { role: 'user' | 'assistant', content: string }[];
    isTyping: boolean;
    setChatInput: React.Dispatch<React.SetStateAction<string>>;
    handleSendMessage: () => void;
}

export default function Sidebar({
    chatMessages,
    isTyping,
    setChatInput,
    handleSendMessage,
}: SidebarProps) {
    return (
        <aside className="w-72 min-w-[288px] flex flex-col overflow-hidden border-r border-zinc-800 bg-zinc-900 z-40">
            {/* Top Label */}
            <div className="px-4 py-3 border-b border-zinc-800">
                <span className="text-zinc-400 uppercase text-xs font-semibold tracking-widest">
                    Chat History
                </span>
            </div>

            {/* Chat History Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6 custom-scrollbar">
                {chatMessages.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center px-4">
                        <div className="text-4xl mb-3">💬</div>
                        <p className="text-xs font-medium">No messages yet. <br /> Describe your vision to begin.</p>
                    </div>
                )}

                {chatMessages.map((msg, i) => (
                    <div key={i} className={cn(
                        "flex flex-col gap-1.5 max-w-[92%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                        msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                    )}>
                        <div className={cn(
                            "px-4 py-2.5 rounded-md text-[13px] leading-relaxed shadow-lg",
                            msg.role === 'user'
                                ? "bg-blue-500/80 text-white rounded-tr-none shadow-indigo-500/10"
                                : "bg-zinc-900 text-zinc-200 rounded-tl-none border border-zinc-800 shadow-black/20"
                        )}>
                            {msg.content}
                        </div>
                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter px-1">
                            {msg.role === 'user' ? 'YOU' : 'LYSIS'}
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
                        className="w-full relative bg-transparent top-5 left-5 text-zinc-100 placeholder-zinc-600 outline-none resize-none text-sm h-30 pb-8"
                        
                        placeholder="Ask to build..."
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                                e.currentTarget.value = '';
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

