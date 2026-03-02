
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import CodeEditor from '../../components/CodeEditor';
import Terminal from '../../components/Terminal';
import Preview from '../../components/Preview';
import { Tree } from "@/components/ui/file-tree";
import { FilePlus, FolderPlus, X } from 'lucide-react';

interface WorkspaceProps {
    viewMode: 'code' | 'preview';
    files: any[];
    activeFile: any;
    setActiveFile: (file: any) => void;
    readContainerFile: (path: string) => Promise<string>;
    setEditorContent: (content: string) => void;
    editorContent: string;
    terminalLines: any[];
    userLines: any[];
    activeTab: 'system' | 'user';
    setActiveTab: (tab: 'system' | 'user') => void;
    shell: any;
    runStatus: any;
    clearTerminal: () => void;
    deviceMode: 'desktop' | 'tablet' | 'mobile';
    previewUrl: string;
    status: string;
    isBuilding: boolean;
    buildingStatus: string;
    buildingProgress: number;
    treeElements: any[];
    renderFileTree: (elements: any[]) => React.ReactNode;
    onSaveFile?: (path: string, content: string) => Promise<void>;
    onCreateFile?: (path: string) => Promise<void>;
    onCreateFolder?: (path: string) => Promise<void>;
    onRestartServer?: () => void;
    onClearContainer?: () => void;
    onInstallDeps?: () => void;
}

export default function Workspace({
    viewMode,
    files,
    activeFile,
    setActiveFile,
    readContainerFile,
    setEditorContent,
    editorContent,
    terminalLines,
    userLines,
    activeTab,
    setActiveTab,
    shell,
    runStatus,
    clearTerminal,
    deviceMode,
    previewUrl,
    status,
    isBuilding,
    buildingStatus,
    buildingProgress,
    treeElements,
    renderFileTree,
    onSaveFile,
    onCreateFile,
    onCreateFolder,
    onRestartServer,
    onClearContainer,
    onInstallDeps,
}: WorkspaceProps) {
    // ── New File / Folder creation state ──
    const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(null);
    const [newItemName, setNewItemName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (creatingType && inputRef.current) {
            inputRef.current.focus();
        }
    }, [creatingType]);

    const handleCreateSubmit = async () => {
        const name = newItemName.trim();
        if (!name) {
            setCreatingType(null);
            setNewItemName('');
            return;
        }

        if (creatingType === 'file' && onCreateFile) {
            await onCreateFile(name);
        } else if (creatingType === 'folder' && onCreateFolder) {
            await onCreateFolder(name);
        }

        setCreatingType(null);
        setNewItemName('');
    };

    const handleCreateCancel = () => {
        setCreatingType(null);
        setNewItemName('');
    };

    return (
        <div className="flex-1 flex min-w-0 overflow-hidden bg-zinc-950">
            <div className={viewMode === 'code' ? 'flex-1 flex overflow-hidden' : 'hidden'}>
                <div className="flex-1 flex overflow-hidden">
                    {/* File Tree Panel */}
                    <aside className="w-48 bg-zinc-950 border-r border-zinc-800 flex flex-col overflow-hidden">
                        <div className="px-3 py-2.5 border-b border-zinc-900/50 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Files</span>
                            <div className="flex items-center gap-0.5">
                                <button
                                    onClick={() => setCreatingType('file')}
                                    className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                                    title="New File"
                                >
                                    <FilePlus className="size-3.5" />
                                </button>
                                <button
                                    onClick={() => setCreatingType('folder')}
                                    className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                                    title="New Folder"
                                >
                                    <FolderPlus className="size-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Inline creation input */}
                        {creatingType && (
                            <div className="px-2 py-1.5 border-b border-zinc-800/50 bg-zinc-900/50">
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-zinc-500">
                                        {creatingType === 'file' ? '📄' : '📁'}
                                    </span>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={newItemName}
                                        onChange={(e) => setNewItemName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreateSubmit();
                                            if (e.key === 'Escape') handleCreateCancel();
                                        }}
                                        onBlur={handleCreateSubmit}
                                        placeholder={creatingType === 'file' ? 'filename.tsx' : 'folder-name'}
                                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-[11px] text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/50 font-mono"
                                    />
                                    <button
                                        onClick={handleCreateCancel}
                                        className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 cursor-pointer"
                                    >
                                        <X className="size-3" />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
                            <div className="px-2">
                                <div className="space-y-0.5">
                                    <Tree initialSelectedId={activeFile?.path}>
                                        {renderFileTree(treeElements)}
                                    </Tree>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Code Editor Panel */}
                    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-zinc-950">
                        

                        {/* Editor Area */}
                        <div className="flex-1 flex flex-col overflow-hidden relative">
                            {activeFile ? (
                                <CodeEditor
                                    value={editorContent}
                                    fileName={activeFile.name}
                                    onChange={(val) => setEditorContent(val)}
                                    onSave={async () => {
                                        if (onSaveFile && activeFile) {
                                            await onSaveFile(activeFile.path, editorContent);
                                        }
                                    }}
                                />
                            ) : (
                                <div className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-500">
                                    <div className="text-center">
                                        <div className="text-4xl mb-4 opacity-20">📄</div>
                                        <p className="text-sm">Select a file to begin editing</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Terminal Area */}
                        <div className="h-48 border-t border-zinc-800 bg-zinc-900/50">
                            <Terminal
                                lines={terminalLines}
                                userLines={userLines}
                                activeTab={activeTab}
                                onSetActiveTab={setActiveTab}
                                shell={shell}
                                status={runStatus}
                                onClear={clearTerminal}
                            />
                        </div>
                    </main>
                </div>
            </div>

            <div className={viewMode === 'preview' ? 'flex-1 flex overflow-hidden' : 'hidden'}>
                {/* Preview Panel */}
                <section className="flex-1 flex flex-col bg-zinc-900 relative">
                    <div className={cn(
                        "flex-1 relative mx-auto w-full transition-all duration-500 ease-in-out bg-white overflow-hidden",
                        deviceMode === 'tablet' && "max-w-[768px] my-6 rounded-2xl shadow-2xl border border-zinc-800 ring-1 ring-white/5",
                        deviceMode === 'mobile' && "max-w-[390px] my-10 rounded-[3rem] shadow-2xl border-[12px] border-zinc-950 ring-1 ring-white/5"
                    )}>
                        <Preview
                            url={previewUrl}
                            loading={status === 'idle' || status === 'booting' || isBuilding}
                            onRestartServer={onRestartServer}
                            onClearContainer={onClearContainer}
                            onInstallDeps={onInstallDeps}
                        />
                        {isBuilding && (
                            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex items-center justify-center animate-in fade-in duration-500">
                                <div className="text-center w-72 flex flex-col items-center">
                                    <div className="text-4xl mb-6 animate-bounce text-indigo-600 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]">✦</div>
                                    <div className="text-sm font-bold text-zinc-900 mb-5 tracking-tight">{buildingStatus}</div>
                                    <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden shadow-inner">
                                        <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${buildingProgress}%` }} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}

