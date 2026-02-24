import { atom, type WritableAtom } from 'nanostores';
import type { WebContainer } from '@webcontainer/api';
import type { ITerminal } from '@/types/terminal';

export class TerminalStore {
    #webcontainer: Promise<WebContainer>;
    showTerminal: WritableAtom<boolean> = atom(false);

    constructor(webcontainer: Promise<WebContainer>) {
        this.#webcontainer = webcontainer;
    }

    toggleTerminal(value?: boolean) {
        this.showTerminal.set(value ?? !this.showTerminal.get());
    }

    attachTerminal(terminal: ITerminal) {
        // Stub
    }

    onTerminalResize(cols: number, rows: number) {
        // Stub
    }
}
