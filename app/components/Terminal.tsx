import React, { useEffect, useRef } from 'react';
import { TerminalLine } from '@/types/terminal';
import { cn } from '@/lib/utils';
import UserTerminal from './UserTerminal';

export interface ShellType {
    process?: unknown;
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    output: ReadableStream<unknown>; // can be string or bytes depending on implementation
}

interface TerminalProps {
    lines: TerminalLine[];
    userLines?: TerminalLine[];
    activeTab?: 'system' | 'user';
    status: 'idle' | 'installing' | 'running' | 'error';
    shell?: ShellType;
    onClear?: () => void;
    onSetActiveTab?: (tab: 'system' | 'user') => void;
}

const TYPE_COLORS = {
    log: 'var(--text-2)',
    command: 'var(--blue-primary)',
    success: '#10b981',
    error: '#ef4444',
    process: '#38bdf8',
};

const STATUS_CONFIG = {
    idle: { label: '● IDLE', color: '#94a3b8' },
    installing: { label: '⟳ INSTALLING', color: '#fbbf24' },
    running: { label: '● RUNNING', color: '#10b981' },
    error: { label: '✗ ERROR', color: '#ef4444' },
};

export default function Terminal({
    lines,
    activeTab = 'system',
    status,
    shell,
    onClear,
    onSetActiveTab,
}: TerminalProps) {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeTab === 'system') {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [lines, activeTab]);

    const s = STATUS_CONFIG[status];

    return (
        <div className="terminal-container h-50">
            <div className="terminal-header">
                <div className="header-left">
                    <div className="terminal-tabs">
                        <button
                            className={cn("tab-btn", activeTab === 'system' && "active")}
                            onClick={() => onSetActiveTab?.('system')}
                        >
                            SYSTEM
                        </button>
                        <button
                            className={cn("tab-btn", activeTab === 'user' && "active")}
                            onClick={() => onSetActiveTab?.('user')}
                        >
                            USER
                        </button>
                    </div>
                    <span className="status-badge" style={{ color: s.color }}>{s.label}</span>
                </div>
                <button className="btn-clear" onClick={onClear}>Clear</button>
            </div>

            <div className="terminal-log scrollbar-hide">
                <div className={cn("system-log h-full overflow-y-auto", activeTab !== 'system' && "hidden")}>
                    {lines.map((line) => (
                        <div
                            key={line.id}
                            className={`log-line type-${line.type}`}
                            style={{ color: TYPE_COLORS[line.type] }}
                        >
                            {line.content}
                        </div>
                    ))}
                    <div ref={endRef} />
                </div>

                <div className={cn("user-terminal h-full", activeTab !== 'user' && "hidden")}>
                    <UserTerminal shell={shell} visible={activeTab === 'user'} />
                </div>
            </div>

            <style jsx>{`
                .terminal-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: #020203;
                    border: 1px solid #121215;
                    border-radius: 12px;
                    overflow: hidden;
                    font-family: var(--font-mono);
                    box-shadow: inset 0 0 40px rgba(0,0,0,0.5);
                }
                .terminal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 4px 14px;
                    background: #08080a;
                    border-bottom: 1px solid #121215;
                }
                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                .terminal-tabs {
                    display: flex;
                    gap: 8px;
                }
                .tab-btn {
                    background: none;
                    border: none;
                    font-size: 9px;
                    font-weight: 900;
                    color: var(--text-3);
                    letter-spacing: 0.15em;
                    opacity: 0.4;
                    cursor: pointer;
                    padding: 4px 0;
                    border-bottom: 1px solid transparent;
                    transition: 0.2s;
                }
                .tab-btn.active {
                    opacity: 1;
                    color: var(--text-2);
                    border-bottom-color: var(--blue-primary);
                }
                .status-badge {
                    font-size: 8px;
                    font-weight: 800;
                    padding: 1px 6px;
                    background: rgba(255,255,255,0.03);
                    border-radius: 4px;
                }
                .btn-clear {
                    background: none;
                    border: none;
                    color: var(--text-3);
                    font-size: 10px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: 0.2s;
                    opacity: 0.6;
                }
                .btn-clear:hover {
                    color: var(--text-2);
                    opacity: 1;
                }
                .terminal-log {
                    flex: 1;
                    padding: 0;
                    overflow: hidden;
                    font-size: 12px;
                    line-height: 1.5;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                }
                .system-log {
                    flex: 1;
                    padding: 8px 12px;
                }
                .user-terminal {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .hidden {
                    display: none !important;
                }
                .log-line {
                    white-space: pre-wrap;
                    word-break: break-all;
                    margin-bottom: 1px;
                }
                .user-input-line {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 4px;
                }
                .prompt {
                    color: var(--blue-primary);
                    font-weight: bold;
                    pointer-events: none;
                }
                .terminal-input {
                    flex: 1;
                    background: none;
                    border: none;
                    outline: none;
                    color: var(--text-2);
                    font-family: inherit;
                    font-size: inherit;
                }
                .type-command {
                    font-weight: 700;
                }
                .terminal-log::-webkit-scrollbar {
                    width: 6px;
                }
                .terminal-log::-webkit-scrollbar-thumb {
                    background: #121215;
                    border-radius: 3px;
                }
            `}</style>
        </div>
    );
}
