export interface ITerminal {
    write(data: string): void;
    clear(): void;
    resize(cols: number, rows: number): void;
}

export interface TerminalLine {
    id: string;
    content: string;
    type: 'log' | 'command' | 'success' | 'error' | 'process';
}
