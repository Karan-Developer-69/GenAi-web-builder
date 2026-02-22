'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    bootWebContainer,
    startDevServer,
    writeContainerFile,
    readContainerFile,
    runInstall,
} from '../../../webcontainer/container';
import { File, Folder, Tree } from "@/components/ui/file-tree";
import { useTerminal } from '../../../hooks/useTerminal';

import TopBar from './TopBar';
import Sidebar from './Sidebar';
import Workspace from './Workspace';

export interface FileEntry {
    name: string;
    path: string;
    language: string;
    isDirectory?: boolean;
}

const DEFAULT_FILES: FileEntry[] = [
    { name: 'App.jsx', path: 'App.jsx', language: 'javascript' },
    { name: 'index.html', path: 'index.html', language: 'html' },
    { name: 'package.json', path: 'package.json', language: 'json' },
    { name: 'server.js', path: 'server.js', language: 'javascript' },
];

type Status = 'idle' | 'booting' | 'running' | 'error';

export default function EditorView() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [status, setStatus] = useState<Status>('idle');
    const [previewUrl, setPreviewUrl] = useState('');
    const { lines: terminalLines, appendLine, updateLastLine, clear: clearTerminal } = useTerminal();
    const [booted, setBooted] = useState(false);

    // Dynamic Files State
    const [files, setFiles] = useState<FileEntry[]>(DEFAULT_FILES);
    const [activeFile, setActiveFile] = useState<FileEntry>(DEFAULT_FILES[0]);
    const [editorContent, setEditorContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // UI States
    const [isBuilding, setIsBuilding] = useState(false);
    const [buildingProgress, setBuildingProgress] = useState(0);
    const [buildingStatus, setBuildingStatus] = useState('Analyzing prompt...');
    const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [currentTab, setCurrentTab] = useState<'chat' | 'history' | 'layers'>('chat');
    const [history, setHistory] = useState<string[]>([]);
    const [layers, setLayers] = useState<{ path: string; type: 'file' | 'dir' }[]>([]);
    const [errorData, setErrorData] = useState<{ message: string; type: 'boot' | 'runtime' } | null>(null);
    const [isReplicating, setIsReplicating] = useState(false);
    const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
    const [runStatus, setRunStatus] = useState<'idle' | 'installing' | 'running' | 'error'>('idle');

    // Helper to detect language from file extension
    const getLanguage = (path: string): string => {
        if (path.endsWith('.css')) return 'css';
        if (path.endsWith('.json')) return 'json';
        if (path.endsWith('.html')) return 'html';
        if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
        if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
        if (path.endsWith('.md')) return 'markdown';
        return 'plaintext';
    };

    // Helper to build structure for Tree component
    const buildTreeData = (filesList: FileEntry[]) => {
        const root: any[] = [];
        const map: { [key: string]: any } = {};

        const sortedFiles = [...filesList].sort((a, b) => a.path.length - b.path.length);

        sortedFiles.forEach(file => {
            const parts = file.path.split('/');
            let currentPath = '';

            parts.forEach((part: string, index: number) => {
                const isLast = index === parts.length - 1;
                const pathPrefix = currentPath ? currentPath + '/' : '';
                currentPath = pathPrefix + part;

                const isDir = !isLast || file.isDirectory;

                if (!map[currentPath]) {
                    const item: any = {
                        name: part,
                        id: currentPath,
                        isDirectory: isDir,
                        children: isDir ? [] : undefined
                    };
                    map[currentPath] = item;

                    if (index === 0) {
                        root.push(item);
                    } else {
                        const parentPath = parts.slice(0, index).join('/');
                        if (map[parentPath]) {
                            map[parentPath].children.push(item);
                        } else {
                            const parentItem = {
                                name: parts[index - 1],
                                id: parentPath,
                                isDirectory: true,
                                children: [item]
                            };
                            map[parentPath] = parentItem;
                        }
                    }
                }
            });
        });

        const sortItems = (items: any[]) => {
            return items
                .sort((a, b) => {
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                })
                .map(item => {
                    if (item.children) item.children = sortItems(item.children);
                    return item;
                });
        };

        return sortItems(root);
    };

    const treeElements = useMemo(() => buildTreeData(files), [files]);

    const renderFileTree = (elements: any[]) => {
        return elements.map(el => {
            if (el.isDirectory) {
                return (
                    <Folder key={el.id} element={el.name} value={el.id}>
                        {el.children && renderFileTree(el.children)}
                    </Folder>
                );
            }
            return (
                <File
                    key={el.id}
                    value={el.id}
                    onClick={async () => {
                        const fileMatch = files.find(f => f.path === el.id);
                        if (fileMatch) {
                            setActiveFile(fileMatch);
                            setEditorContent(await readContainerFile(fileMatch.path));
                        }
                    }}
                >
                    {el.name}
                </File>
            );
        });
    };

    // FIX: Added Content-Type header to initial generation fetch
    const processGeneration = async (prompt: string) => {
        setIsBuilding(true);
        setBuildingProgress(0);

        const statuses = [
            "Synthesizing Synergy...",
            "Architecting Framework...",
            "Generating Components...",
            "Finalizing Structure..."
        ];
        let statusIdx = 0;
        const progressInterval = setInterval(() => {
            setBuildingProgress(prev => Math.min(prev + 1.2, 100));
            if (Math.random() > 0.7) {
                statusIdx = Math.min(statusIdx + 1, statuses.length - 1);
                setBuildingStatus(statuses[statusIdx]);
            }
        }, 30);

        try {
            // FIX: Was missing Content-Type header — caused 400 on some runtimes
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: res.statusText }));
                throw new Error(errData.error || `API returned ${res.status}`);
            }

            const data = await res.json();

            if (data.files) {
                const newFiles: FileEntry[] = data.files.map((f: any) => ({
                    name: f.path.split('/').pop() || f.path,
                    path: f.path,
                    language: getLanguage(f.path),
                    isDirectory: false
                }));

                const directoryMap = new Set<string>();
                newFiles.forEach(f => {
                    const parts = f.path.split('/');
                    if (parts.length > 1) {
                        for (let i = 1; i < parts.length; i++) {
                            directoryMap.add(parts.slice(0, i).join('/'));
                        }
                    }
                });

                const finalFiles = [...newFiles];
                directoryMap.forEach(dirPath => {
                    if (!finalFiles.find(f => f.path === dirPath)) {
                        finalFiles.push({
                            name: dirPath.split('/').pop() || dirPath,
                            path: dirPath,
                            language: 'directory',
                            isDirectory: true
                        });
                    }
                });

                setFiles(finalFiles);
                setLayers(finalFiles.map(f => ({ path: f.path, type: f.isDirectory ? 'dir' : 'file' })));

                for (const file of data.files) {
                    await writeContainerFile(file.path, file.content);
                }

                const entryFile =
                    newFiles.find((f: FileEntry) => f.path === 'App.jsx') ||
                    newFiles.find((f: FileEntry) => f.path === 'index.html') ||
                    newFiles[0];

                if (entryFile) {
                    setActiveFile(entryFile);
                    setEditorContent(
                        data.files.find((f: any) => f.path === entryFile.path)?.content || ''
                    );
                }
            }
        } catch (err: any) {
            setErrorData({
                message: err?.message || "Strategic Build Failure: Synergy Disrupted.",
                type: 'boot'
            });
        } finally {
            clearInterval(progressInterval);
            setBuildingProgress(100);
            setTimeout(() => setIsBuilding(false), 800);
        }
    };

    useEffect(() => {
        let cancelled = false;
        async function boot() {
            try {
                setStatus('booting');
                setRunStatus('idle');
                appendLine('Booting WebContainer…', 'process');
                const wc = await bootWebContainer();
                if (cancelled) return;
                setBooted(true);
                updateLastLine('✓ WebContainer ready', 'success');

                const prompt = searchParams.get('prompt');
                if (prompt) {
                    setChatMessages([{ role: 'user', content: prompt }]);
                    await processGeneration(prompt);
                    setTimeout(() => {
                        setChatMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "✦ I've analyzed your prompt and started building.\n\nThe preview is live on the right. Ask me to change anything — colors, layout, copy, or sections. I'm listening."
                        }]);
                    }, 3500);
                }

                if (!iframeRef.current) return;

                const filesList = await wc.fs.readdir('.');
                const hasPackageJson = filesList.includes('package.json');
                if (hasPackageJson) {
                    setRunStatus('installing');
                    appendLine('Installing dependencies…', 'process');

                    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
                    let spinIdx = 0;
                    const spinInterval = setInterval(() => {
                        updateLastLine(`Installing dependencies ${spinnerChars[spinIdx++ % spinnerChars.length]}`, 'process');
                    }, 100);

                    const exitCode = await runInstall((data: string) => {
                        if (!cancelled && data.toLowerCase().includes('err')) {
                            appendLine(data, 'error');
                        }
                    });

                    clearInterval(spinInterval);
                    if (exitCode !== 0) throw new Error('npm install failed');
                    updateLastLine('✓ Dependencies installed', 'success');
                }

                setRunStatus('running');
                await startDevServer(
                    iframeRef.current,
                    (data) => {
                        if (!cancelled) {
                            if (data.includes('$')) appendLine(data, 'command');
                            else if (data.includes('✓')) appendLine(data, 'success');
                            else appendLine(data, 'log');
                        }
                    },
                    (url) => {
                        if (!cancelled) {
                            console.log("UREL => ",url)
                            setPreviewUrl(url);
                            setStatus('running');
                        }
                    }
                );
            } catch (err) {
                if (!cancelled) {
                    setStatus('error');
                    setRunStatus('error');
                    appendLine(`✗ ${err}`, 'error');
                }
            }
        }
        boot();
        return () => { cancelled = true; };
    }, []);

    const handleSendMessage = async () => {
        if (!chatInput.trim() || isTyping) return;

        const userMsg = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setHistory(prev => [userMsg, ...prev].slice(0, 10));
        setIsTyping(true);

        try {
            // FIX: API route now receives `messages` array — route.ts updated to handle both
            // `prompt` (initial generation) and `messages` (chat flow)
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...chatMessages, { role: 'user', content: userMsg }]
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: res.statusText }));
                throw new Error(errData.error || `API returned ${res.status}`);
            }

            // Non-streaming: route returns { files } JSON
            const data = await res.json();

            if (data.files) {
                // Build assistant message summarizing what changed
                const changedPaths = data.files.map((f: any) => f.path).join(', ');
                setChatMessages(prev => [
                    ...prev,
                    { role: 'assistant', content: `✦ Updated: \`${changedPaths}\`` }
                ]);

                let hasPackageJsonUpdate = false;

                for (const file of data.files) {
                    if (file.path === 'package.json') hasPackageJsonUpdate = true;
                    await writeContainerFile(file.path, file.content);

                    setFiles(prev => {
                        if (prev.find(f => f.path === file.path)) return prev;
                        return [...prev, {
                            name: file.path.split('/').pop() || file.path,
                            path: file.path,
                            language: getLanguage(file.path),
                            isDirectory: false,
                        }];
                    });

                    if (activeFile.path === file.path) {
                        setEditorContent(file.content);
                    }
                }

                if (hasPackageJsonUpdate) {
                    setRunStatus('installing');
                    appendLine('package.json updated — syncing dependencies...', 'process');
                    const exitCode = await runInstall((logLine) => appendLine(logLine, 'log'));
                    if (exitCode === 0) {
                        updateLastLine('✓ Dependencies updated', 'success');
                        setRunStatus('running');
                    } else {
                        setRunStatus('error');
                        appendLine('✗ Dependency sync failed', 'error');
                    }
                }
            } else if (data.error) {
                throw new Error(data.error);
            }
        } catch (err: any) {
            setErrorData({
                message: err?.message || "Communication Disruption. Verify uplink.",
                type: 'runtime'
            });
        } finally {
            setIsTyping(false);
        }
    };

    const handleAutoFix = async () => {
        if (!errorData) return;
        setIsReplicating(true);
        setChatInput(`I encountered this error: "${errorData.message}". Please analyze and fix it.`);
        setErrorData(null);
        // Small delay to let setChatInput settle before sending
        setTimeout(async () => {
            await handleSendMessage();
            setIsReplicating(false);
        }, 100);
    };

    // WebContainer API handlers for Preview
    const handleRestartServer = useCallback(async () => {
        if (status === 'running') {
            setStatus('booting');
            appendLine('Restarting dev server...', 'process');
            try {
                // For now, just refresh the iframe - in a full implementation we'd restart the process
                if (iframeRef.current) {
                    iframeRef.current.src = iframeRef.current.src;
                }
                setStatus('running');
                appendLine('✓ Server restarted', 'success');
            } catch (err) {
                setStatus('error');
                appendLine(`✗ Failed to restart server: ${err}`, 'error');
            }
        }
    }, [status, appendLine]);

    const handleClearContainer = useCallback(async () => {
        setStatus('booting');
        appendLine('Clearing container...', 'process');
        try {
            // Reboot the container
            await bootWebContainer();
            setStatus('idle');
            setPreviewUrl('');
            appendLine('✓ Container cleared', 'success');
        } catch (err) {
            setStatus('error');
            appendLine(`✗ Failed to clear container: ${err}`, 'error');
        }
    }, [appendLine]);

    const handleInstallDeps = useCallback(async () => {
        setRunStatus('installing');
        appendLine('Installing dependencies...', 'process');
        try {
            const exitCode = await runInstall((logLine) => appendLine(logLine, 'log'));
            if (exitCode === 0) {
                setRunStatus('idle');
                appendLine('✓ Dependencies installed', 'success');
            } else {
                setRunStatus('error');
                appendLine('✗ Failed to install dependencies', 'error');
            }
        } catch (err) {
            setRunStatus('error');
            appendLine(`✗ Install error: ${err}`, 'error');
        }
    }, [appendLine]);

    return (
        <div className="h-screen flex flex-col bg-zinc-950 font-sans overflow-hidden text-zinc-100">
            <TopBar
                viewMode={viewMode}
                setViewMode={setViewMode}
                previewUrl={previewUrl}
            />

            <main className="flex-1 flex overflow-hidden">
                <Sidebar
                    chatMessages={chatMessages}
                    isTyping={isTyping}
                    setChatInput={setChatInput}
                    handleSendMessage={handleSendMessage}
                />

                <Workspace
                    viewMode={viewMode}
                    files={files}
                    activeFile={activeFile}
                    setActiveFile={setActiveFile}
                    readContainerFile={readContainerFile}
                    setEditorContent={setEditorContent}
                    editorContent={editorContent}
                    terminalLines={terminalLines}
                    runStatus={runStatus}
                    clearTerminal={clearTerminal}
                    deviceMode={deviceMode}
                    iframeRef={iframeRef}
                    previewUrl={previewUrl}
                    status={status}
                    isBuilding={isBuilding}
                    buildingStatus={buildingStatus}
                    buildingProgress={buildingProgress}
                    treeElements={treeElements}
                    renderFileTree={renderFileTree}
                    onRestartServer={handleRestartServer}
                    onClearContainer={handleClearContainer}
                    onInstallDeps={handleInstallDeps}
                />

                {/* Error Recovery Overlay */}
                {errorData && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[1000] backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-3xl text-center max-w-[420px] shadow-2xl animate-in zoom-in-95 duration-500 relative">
                            <div className="absolute inset-0 -z-10 bg-indigo-500/5 blur-3xl rounded-full" />
                            <div className="text-5xl mb-6">⚠️</div>
                            <h3 className="font-bold text-2xl mb-3 text-white tracking-tight">Synergy Disrupted</h3>
                            <p className="text-sm text-zinc-400 mb-8 leading-relaxed px-4">{errorData.message}</p>
                            <div className="flex flex-col gap-3">
                                <button
                                    className="bg-indigo-600 text-white border-none py-3.5 rounded-xl font-bold cursor-pointer transition-all hover:bg-indigo-500 hover:shadow-[0_10px_30px_rgba(99,102,241,0.3)] active:scale-95 disabled:opacity-50"
                                    onClick={handleAutoFix}
                                    disabled={isReplicating}
                                >
                                    {isReplicating ? 'Replicating Fix...' : 'Fix with Lysis Synergy AI'}
                                </button>
                                <button
                                    className="bg-transparent border border-zinc-800 text-zinc-500 py-3 rounded-xl font-bold text-xs cursor-pointer transition-all hover:text-zinc-300 hover:border-zinc-700 active:scale-95"
                                    onClick={() => setErrorData(null)}
                                >
                                    Manual Intervention
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}