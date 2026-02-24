export interface ITerminal {
    write(data: string): void;
    clear(): void;
    resize(cols: number, rows: number): void;
}
