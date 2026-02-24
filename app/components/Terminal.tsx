import React, { useEffect, useRef } from 'react';
import { TerminalLine } from '../../hooks/useTerminal';

interface TerminalProps {
    lines: TerminalLine[];
    status: 'idle' | 'installing' | 'running' | 'error';
    onClear?: () => void;
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

export default function Terminal({ lines, status, onClear }: TerminalProps) {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [lines]);

    const s = STATUS_CONFIG[status];

    return (
        <div className="terminal-container h-50">
            <div className="terminal-header">
                <div className="header-left">
                    <span className="terminal-title">TERMINAL</span>
                    <span className="status-badge" style={{ color: s.color }}>{s.label}</span>
                </div>
                <button className="btn-clear" onClick={onClear}>Clear</button>
            </div>

            <div className="terminal-log">
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
                    padding: 6px 14px;
                    background: #08080a;
                    border-bottom: 1px solid #121215;
                }
                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .terminal-title {
                    font-size: 9px;
                    font-weight: 900;
                    color: var(--text-3);
                    letter-spacing: 0.15em;
                    opacity: 0.6;
                }
                .status-badge {
                    font-size: 9px;
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
                }
                .btn-clear:hover {
                    color: var(--text-2);
                }
                .terminal-log {
                    flex: 1;
                    padding: 16px;
                    overflow-y: auto;
                    font-size: 12px;
                    line-height: 1.6;
                }
                .log-line {
                    white-space: pre-wrap;
                    word-break: break-all;
                    margin-bottom: 4px;
                }
                .type-command {
                    font-weight: 700;
                }
                .shell-prompt {
                    opacity: 0.5;
                }
                .terminal-log::-webkit-scrollbar {
                    width: 8px;
                }
                .terminal-log::-webkit-scrollbar-thumb {
                    background: var(--line);
                    border-radius: 4px;
                }
            `}</style>
        </div>
    );
}
