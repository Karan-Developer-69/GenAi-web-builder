"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface ActivityBarProps {
    activeSideTab: 'files' | 'chat';
    setActiveSideTab: (tab: 'files' | 'chat') => void;
    setCurrentTab: (tab: 'chat' | 'history' | 'layers') => void;
}

export default function ActivityBar({ activeSideTab, setActiveSideTab, setCurrentTab }: ActivityBarProps) {
    return (
        <aside className="w-12 min-w-12 bg-bg-surface border-r border-line flex flex-col items-center py-3 gap-2 z-50">
            <button
                className={cn(
                    "w-9 h-9 flex items-center justify-center bg-transparent border-none text-xl cursor-pointer opacity-50 transition-opacity border-l-2 border-transparent hover:opacity-100",
                    activeSideTab === 'files' && "opacity-100 border-l-blue-primary bg-white/5"
                )}
                onClick={() => {
                    setActiveSideTab('files');
                    setCurrentTab('layers');
                }}
            >
                <span className="icon">📁</span>
            </button>
            <button className="w-9 h-9 flex items-center justify-center bg-transparent border-none text-xl cursor-pointer opacity-50 transition-opacity border-l-2 border-transparent hover:opacity-20 pointer-events-none"><span className="icon">🔍</span></button>
            <button className="w-9 h-9 flex items-center justify-center bg-transparent border-none text-xl cursor-pointer opacity-50 transition-opacity border-l-2 border-transparent hover:opacity-20 pointer-events-none"><span className="icon">🌿</span></button>
            <button
                className={cn(
                    "w-9 h-9 flex items-center justify-center bg-transparent border-none text-xl cursor-pointer opacity-50 transition-opacity border-l-2 border-transparent hover:opacity-100",
                    activeSideTab === 'chat' && "opacity-100 border-l-blue-primary bg-white/5"
                )}
                onClick={() => {
                    setActiveSideTab('chat');
                    setCurrentTab('chat');
                }}
            >
                <span className="icon">💬</span>
            </button>
            <div className="flex-grow" />
            <button className="w-9 h-9 flex items-center justify-center bg-transparent border-none text-xl cursor-pointer opacity-50 transition-opacity border-l-2 border-transparent hover:opacity-100"><span className="icon">⚙️</span></button>
        </aside>
    );
}
