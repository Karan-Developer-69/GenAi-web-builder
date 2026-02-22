"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface TopBarProps {
    viewMode: 'code' | 'preview';
    setViewMode: (mode: 'code' | 'preview') => void;
    previewUrl: string;
}

export default function TopBar({ viewMode, setViewMode, previewUrl }: TopBarProps) {
    const router = useRouter();

    return (
        <header className="h-12 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900 z-[100]">
            {/* Left: App logo/name */}
            <div className="flex items-center gap-3">
                <div
                    className="flex items-center gap-2 cursor-pointer group"
                    onClick={() => router.push('/')}
                >
                    <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300">
                        <span className="text-white font-black text-sm">L</span>
                    </div>
                    <span className="font-bold text-sm tracking-tight text-zinc-100">Lysis</span>
                </div>
            </div>

            {/* Center: Toggle pill */}
            <div className="flex items-center">
                <div className="flex bg-zinc-800 p-1 rounded-lg border border-zinc-700">
                    <button
                        onClick={() => setViewMode('code')}
                        className={cn(
                            "px-4 py-1 rounded-md text-xs font-semibold transition-all duration-200",
                            viewMode === 'code'
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200"
                        )}
                    >
                        Code
                    </button>
                    <button
                        onClick={() => setViewMode('preview')}
                        className={cn(
                            "px-4 py-1 rounded-md text-xs font-semibold transition-all duration-200",
                            viewMode === 'preview'
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200"
                        )}
                    >
                        Preview
                    </button>
                </div>
            </div>

            {/* Right: action buttons */}
            <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all duration-200">
                    Share
                </button>
                <button
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all duration-200"
                    onClick={() => window.open(previewUrl, '_blank')}
                >
                    Open ↗
                </button>
                <button className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all duration-200 shadow-lg shadow-indigo-600/10">
                    Deploy
                </button>
            </div>
        </header>
    );
}

