import { atom, map, type MapStore, type WritableAtom } from 'nanostores';
import type { WebContainer } from '@webcontainer/api';

export interface File {
    type: 'file';
    content: string;
}

export interface Directory {
    type: 'directory';
}

export type Dirent = File | Directory;
export type FileMap = Record<string, Dirent | undefined>;

export class FilesStore {
    #webcontainer: Promise<WebContainer>;
    files: MapStore<FileMap> = map({});
    filesCount: WritableAtom<number> = atom(0);

    constructor(webcontainer: Promise<WebContainer>) {
        this.#webcontainer = webcontainer;
    }

    getFile(filePath: string): File | undefined {
        const file = this.files.get()[filePath];
        return file?.type === 'file' ? file : undefined;
    }

    async saveFile(filePath: string, content: string) {
        const wc = await this.#webcontainer;
        await wc.fs.writeFile(filePath, content);

        this.files.setKey(filePath, { type: 'file', content });
    }

    getFileModifications() {
        return {}; // Stub
    }

    resetFileModifications() {
        // Stub
    }
}
