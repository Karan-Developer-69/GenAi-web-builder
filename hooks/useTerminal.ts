import { useState, useCallback } from 'react';

export interface TerminalLine {
    id: string;
    content: string;
    type: 'log' | 'command' | 'success' | 'error' | 'process';
}

export function useTerminal() {
    const [lines, setLines] = useState<TerminalLine[]>([]);

    const sanitize = useCallback((data: string) => {
        if (!data) return '';
        return data
            // Strips ANSI escape sequences (colors, cursor control, etc.)
            .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
            // Strips individual control characters that might break UI
            .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');
    }, []);

    const appendLine = useCallback((content: string, type: TerminalLine['type'] = 'log') => {
        const cleaned = sanitize(content);
        if (!cleaned && type === 'log') return;

        setLines((prev) => [
            ...prev,
            {
                id: Math.random().toString(36).substring(2, 9),
                content: cleaned,
                type,
            },
        ]);
    }, [sanitize]);

    const updateLastLine = useCallback((content: string, type: TerminalLine['type'] = 'process') => {
        const cleaned = sanitize(content);
        setLines((prev) => {
            if (prev.length === 0) {
                return [{ id: Math.random().toString(36).substring(2, 9), content: cleaned, type }];
            }
            const newLines = [...prev];
            newLines[newLines.length - 1] = {
                ...newLines[newLines.length - 1],
                content: cleaned,
                type,
            };
            return newLines;
        });
    }, [sanitize]);

    const clear = useCallback(() => {
        setLines([]);
    }, []);

    return {
        lines,
        appendLine,
        updateLastLine,
        clear,
    };
}
