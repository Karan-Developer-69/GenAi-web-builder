import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../lib/store/store';
import { appendLine as appendLineAction, updateLastLine as updateLastLineAction, clearLines } from '../lib/store/slices/terminalSlice';

export interface TerminalLine {
    id: string;
    content: string;
    type: 'log' | 'error' | 'success' | 'process';
}

export function useTerminal() {
    const dispatch = useDispatch();
    const lines = useSelector((state: RootState) => state.terminal.lines);

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
        dispatch(appendLineAction({ content: cleaned, type }));
    }, [dispatch, sanitize]);

    const updateLastLine = useCallback((content: string, type: TerminalLine['type'] = 'process') => {
        const cleaned = sanitize(content);
        dispatch(updateLastLineAction({ content: cleaned, type }));
    }, [dispatch, sanitize]);

    const clear = useCallback(() => {
        dispatch(clearLines());
    }, [dispatch]);

    return {
        lines,
        appendLine,
        updateLastLine,
        clear,
    };
}
