
"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import CodeEditor from '../../components/CodeEditor';
import Terminal from '../../components/Terminal';
import Preview from '../../components/Preview';
import { Tree } from "@/components/ui/file-tree";

interface WorkspaceProps {
    viewMode: 'code' | 'preview';
    files: any[];
    activeFile: any;
    setActiveFile: (file: any) => void;
    readContainerFile: (path: string) => Promise<string>;
    setEditorContent: (content: string) => void;
    editorContent: string;
    terminalLines: any[];
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
    onRestartServer,
    onClearContainer,
    onInstallDeps,
}: WorkspaceProps) {
    return (
        <div className="flex-1 flex min-w-0 overflow-hidden bg-zinc-950">
            <div className={viewMode === 'code' ? 'flex-1 flex overflow-hidden' : 'hidden'}>
                <div className="flex-1 flex overflow-hidden">
                    {/* File Tree Panel */}
                    <aside className="w-48 bg-zinc-950 border-r border-zinc-800 flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b border-zinc-900/50">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Files</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
                            <div className="px-2">
                                {/* Using the standard file tree styling from design direction */}
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
                        {/* Tab Bar */}
                        <div className="flex bg-zinc-900 border-b border-zinc-800 overflow-x-auto no-scrollbar h-9">
                            {files.map((file: any) => (
                                <button
                                    key={file.path}
                                    className={cn(
                                        "px-4 flex items-center gap-2 border-r border-zinc-800 text-[11px] font-mono transition-all min-w-[120px]",
                                        activeFile?.path === file.path
                                            ? "bg-zinc-950 border-t border-t-indigo-500 text-indigo-400 font-semibold"
                                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                                    )}
                                    onClick={async () => {
                                        setActiveFile(file);
                                        setEditorContent(await readContainerFile(file.path));
                                    }}
                                >
                                    <span className="text-xs opacity-60">📄</span>
                                    <span className="truncate">{file.name}</span>
                                </button>
                            ))}
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 flex flex-col overflow-hidden relative">
                            {activeFile ? (
                                <CodeEditor
                                    value={editorContent}
                                    fileName={activeFile.name}
                                    onChange={(val) => setEditorContent(val)}
                                    onSave={async () => {
                                        // In a real app we'd trigger a save here
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

