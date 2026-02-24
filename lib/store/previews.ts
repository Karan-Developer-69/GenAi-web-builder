import { atom, type WritableAtom } from 'nanostores';
import type { WebContainer } from '@webcontainer/api';

export interface PreviewInfo {
    id: string;
    port: number;
    ready: boolean;
}

export class PreviewsStore {
    #webcontainer: Promise<WebContainer>;
    previews: WritableAtom<PreviewInfo[]> = atom([]);

    constructor(webcontainer: Promise<WebContainer>) {
        this.#webcontainer = webcontainer;
    }
}
