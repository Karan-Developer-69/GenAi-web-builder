import { atom, map, type MapStore, type WritableAtom } from 'nanostores';
import type { FileMap } from './files';

export interface EditorDocument {
    filePath: string;
    value: string;
    isUnsaved: boolean;
    scrollPosition?: ScrollPosition;
}

export interface ScrollPosition {
    top: number;
    left: number;
}

export class EditorStore {
    documents: MapStore<Record<string, EditorDocument>> = map({});
    selectedFile: WritableAtom<string | undefined> = atom(undefined);
    currentDocument: WritableAtom<EditorDocument | undefined> = atom(undefined);

    constructor(filesStore: any) {
        // Initialized with files store
    }

    setDocuments(files: FileMap) {
        const newDocuments: Record<string, EditorDocument> = {};
        for (const [path, dirent] of Object.entries(files)) {
            if (dirent && dirent.type === 'file') {
                newDocuments[path] = {
                    filePath: path,
                    value: (dirent as any).content || '',
                    isUnsaved: false,
                };
            }
        }
        this.documents.set(newDocuments);
    }

    setSelectedFile(filePath: string | undefined) {
        this.selectedFile.set(filePath);
        if (filePath) {
            const doc = this.documents.get()[filePath];
            this.currentDocument.set(doc);
        } else {
            this.currentDocument.set(undefined);
        }
    }

    updateFile(filePath: string, content: string) {
        const documents = this.documents.get();
        const document = documents[filePath];

        if (document) {
            this.documents.setKey(filePath, { ...document, value: content, isUnsaved: true });
            if (this.selectedFile.get() === filePath) {
                this.currentDocument.set({ ...document, value: content, isUnsaved: true });
            }
        }
    }

    updateScrollPosition(filePath: string, position: ScrollPosition) {
        const document = this.documents.get()[filePath];
        if (document) {
            this.documents.setKey(filePath, { ...document, scrollPosition: position });
        }
    }
}
