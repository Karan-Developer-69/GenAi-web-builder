'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
    value: string;
    fileName: string;
    onChange: (value: string) => void;
    onSave: () => void;
    isSaving?: boolean;
}

export default function CodeEditor({
    value,
    fileName,
    onChange,
    onSave,
    isSaving,
}: CodeEditorProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);

    const lines = value.split('\n');

    const handleScroll = () => {
        if (lineNumbersRef.current && textareaRef.current) {
            lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const newVal = value.substring(0, start) + '  ' + value.substring(end);
            onChange(newVal);
            requestAnimationFrame(() => {
                ta.selectionStart = ta.selectionEnd = start + 2;
            });
        }
        if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSave();
        }
    };

    return (
        <div className="flex flex-col flex-1 overflow-hidden bg-zinc-950">
            {/* Header / Tab-like spacer */}
            <div className="flex items-center bg-zinc-900 border-b border-zinc-800 h-9 px-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-400">
                    <span className="opacity-70">📄</span>
                    {fileName}
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={onSave}
                        disabled={isSaving}
                        className={cn(
                            "px-3 py-1 rounded-md text-[10px] font-bold transition-all active:scale-95",
                            isSaving
                                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                : "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600/20"
                        )}
                    >
                        {isSaving ? 'SAVING...' : 'SAVE'}
                    </button>
                </div>
            </div>

            {/* Editor body */}
            <div className="flex flex-1 overflow-hidden">
                {/* Line numbers */}
                <div
                    ref={lineNumbersRef}
                    className="w-12 min-w-[48px] bg-zinc-950/50 border-r border-zinc-800 py-4 overflow-y-hidden text-right pr-3 text-[11px] font-mono text-zinc-600 select-none"
                >
                    {lines.map((_, i) => (
                        <div key={i} className="leading-5">
                            {i + 1}
                        </div>
                    ))}
                </div>

                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onScroll={handleScroll}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="flex-1 bg-transparent border-none outline-none resize-none p-4 text-zinc-300 font-mono text-sm leading-5 caret-indigo-500 overflow-auto selection:bg-indigo-500/30 no-scrollbar"
                />
            </div>
        </div>
    );
}
