import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

import type { ShellType } from './Terminal';

interface UserTerminalProps {
    shell?: ShellType;
    visible?: boolean;
}

export default function UserTerminal({ shell, visible }: UserTerminalProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const pipedRef = useRef(false);
    const shellRef = useRef(shell);

    // Keep shellRef updated
    useEffect(() => {
        shellRef.current = shell;
    }, [shell]);

    useEffect(() => {
        if (!terminalRef.current) return;

        const terminal = new XTerm({
            cursorBlink: true,
            theme: {
                background: '#020203',
                foreground: '#e2e2e7',
                cursor: '#3b82f6',
                selectionBackground: 'rgba(59, 130, 246, 0.3)',
                black: '#000000',
                red: '#ef4444',
                green: '#10b981',
                yellow: '#fbbf24',
                blue: '#3b82f6',
                magenta: '#a855f7',
                cyan: '#06b6d4',
                white: '#ffffff',
            },
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            allowProposedApi: true,
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(terminalRef.current);

        // Initial fit
        setTimeout(() => fitAddon.fit(), 100);

        xtermRef.current = terminal;
        fitAddonRef.current = fitAddon;

        const onKeyHandler = terminal.onData((data) => {
            shellRef.current?.write(data);
        });

        const resizeHandler = () => {
            try {
                fitAddon.fit();
                if (terminal.cols && terminal.rows) {
                    shell?.resize(terminal.cols, terminal.rows);
                }
            } catch (err) {
                console.warn('Fit failed', err);
            }
        };
        window.addEventListener('resize', resizeHandler);

        return () => {
            onKeyHandler.dispose();
            window.removeEventListener('resize', resizeHandler);
            terminal.dispose();
        };
    }, []);

    // Handle incoming shell data
    useEffect(() => {
        if (!shell || !xtermRef.current || pipedRef.current) return;
        if (shell.output.locked) {
            console.warn('Terminal output stream is already locked. Waiting for unlock...');
            return;
        }

        pipedRef.current = true;
        const terminal = xtermRef.current;
        let isStopped = false;

        const reader = shell.output.getReader();

        async function read() {
            try {
                while (!isStopped) {
                    const { done, value } = await reader.read();
                    if (done || isStopped) break;
                    if (typeof value === 'string') {
                        terminal.write(value);
                    } else if (value instanceof Uint8Array) {
                        terminal.write(new TextDecoder().decode(value));
                    } else if (value != null) {
                        terminal.write(String(value));
                    }
                }
            } catch (err) {
                console.error('Terminal read error:', err);
            } finally {
                reader.releaseLock();
                pipedRef.current = false;
            }
        }

        read();

        return () => {
            isStopped = true;
            reader.cancel().catch(() => { }); // Force release lock
        };
    }, [shell]);

    // Re-fit and Focus when becoming visible
    useEffect(() => {
        if (!xtermRef.current) return;
        const terminal = xtermRef.current;
        const fitAddon = fitAddonRef.current;

        if (visible) {
            setTimeout(() => {
                fitAddon?.fit();
                terminal.focus();
                if (terminal.cols && terminal.rows) {
                    shell?.resize(terminal.cols, terminal.rows);
                }
            }, 50);
        }
    }, [visible, shell]);

    // Handle initial focus and interaction
    useEffect(() => {
        if (visible && xtermRef.current) {
            xtermRef.current.focus();
        }
    }, [visible]);

    return (
        <div
            ref={terminalRef}
            className="h-full w-full xterm-wrapper"
            onClick={() => xtermRef.current?.focus()}
        />
    );
}
