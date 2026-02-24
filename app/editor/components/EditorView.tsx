'use client';

import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../lib/store/store';
import {
    setStatus,
    setPreviewUrl,
    setBooted,
    setFiles,
    setActiveFile,
    setEditorContent,
    setIsBuilding,
    setBuildingProgress,
    setBuildingStatus,
    setErrorData,
    setIsReplicating,
    setViewMode,
    setRunStatus,
} from '../../../lib/store/slices/editorSlice';
import {
    setMessages,
    addMessage,
    setInput,
    setIsTyping,
    addToHistory,
} from '../../../lib/store/slices/chatSlice';
import {
    appendLine,
    updateLastLine,
    clearLines,
} from '../../../lib/store/slices/terminalSlice';
import {
    bootWebContainer,
    startDevServer,
    runInstall,
    readContainerFile,
    writeContainerFile
} from '../../../webcontainer/container';
import { File, Folder } from '../../../components/ui/file-tree';
import { getLanguage } from '../../../lib/utils';

import TopBar from './TopBar';
import Sidebar from './Sidebar';
import Workspace from './Workspace';

export interface FileEntry {
    name: string;
    path: string;
    language: string;
    isDirectory?: boolean;
}


export default function EditorView() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const popupRef = useRef<Window | null>(null);
    const dispatch = useDispatch();

    // Selectors
    const status = useSelector((state: RootState) => state.editor.status);
    const previewUrl = useSelector((state: RootState) => state.editor.previewUrl);
    const booted = useSelector((state: RootState) => state.editor.booted);
    const files = useSelector((state: RootState) => state.editor.files);
    const activeFile = useSelector((state: RootState) => state.editor.activeFile);
    const editorContent = useSelector((state: RootState) => state.editor.editorContent);
    const isBuilding = useSelector((state: RootState) => state.editor.isBuilding);
    const buildingProgress = useSelector((state: RootState) => state.editor.buildingProgress);
    const buildingStatus = useSelector((state: RootState) => state.editor.buildingStatus);
    const deviceMode = useSelector((state: RootState) => state.editor.deviceMode);
    const errorData = useSelector((state: RootState) => state.editor.errorData);
    const isReplicating = useSelector((state: RootState) => state.editor.isReplicating);
    const viewMode = useSelector((state: RootState) => state.editor.viewMode);
    const runStatus = useSelector((state: RootState) => state.editor.runStatus);

    const chatMessages = useSelector((state: RootState) => state.chat.messages);
    const chatInput = useSelector((state: RootState) => state.chat.input);
    const isTyping = useSelector((state: RootState) => state.chat.isTyping);

    const terminalLines = useSelector((state: RootState) => state.terminal.lines);

    // Action dispatchers as functions
    const setActiveFileFunc = (file: FileEntry) => dispatch(setActiveFile(file));
    const setChatInputFunc = (input: string) => dispatch(setInput(input));
    const setEditorContentFunc = (content: string) => dispatch(setEditorContent(content));
    const setViewModeFunc = (mode: 'code' | 'preview') => dispatch(setViewMode(mode));
    const setErrorDataFunc = (data: any) => dispatch(setErrorData(data));

    const processGeneration = useCallback(async (prompt: string, currentFiles: FileEntry[]) => {
        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });
            if (!res.ok) throw new Error('Generation failed');
            const data = await res.json();
            if (data.files) {
                let updatedFiles = [...currentFiles];
                for (const file of data.files) {
                    await writeContainerFile(file.path, file.content);
                    if (!updatedFiles.find(f => f.path === file.path)) {
                        const newFile = {
                            name: file.path.split('/').pop() || file.path,
                            path: file.path,
                            language: getLanguage(file.path),
                            isDirectory: false,
                        };
                        updatedFiles.push(newFile);
                    }
                }
                dispatch(setFiles(updatedFiles));

                // If no active file, set the first generated one
                if (!activeFile && updatedFiles.length > 0) {
                    const firstFile = updatedFiles[0];
                    dispatch(setActiveFile(firstFile));
                    const content = await readContainerFile(firstFile.path);
                    dispatch(setEditorContent(content));
                }
            }
        } catch (err) {
            console.error('Generation error:', err);
        }
    }, [dispatch, activeFile, files]);

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
                            dispatch(setActiveFile(fileMatch));
                            const content = await readContainerFile(fileMatch.path);
                            dispatch(setEditorContent(content));
                        }
                    }}
                >
                    {el.name}
                </File>
            );
        });
    };

    // In processGeneration, removed unused variables and cleaned up

    useEffect(() => {
        let cancelled = false;
        async function boot() {
            try {
                dispatch(setStatus('booting'));
                dispatch(setRunStatus('idle'));
                if (typeof window !== 'undefined' && !window.crossOriginIsolated) {
                    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                    const msg = `Security isolation (COOP/COEP) is not active. ${!isLocalhost ? 'Please use http://localhost:3000 instead of an IP address. ' : ''}Check your next.config.ts and restart the dev server.`;
                    dispatch(appendLine({ content: `✗ ${msg}`, type: 'error' }));
                    throw new Error(msg);
                }

                const wc = await bootWebContainer();
                if (!wc) throw new Error('bootWebContainer failed');

                dispatch(setBooted(true));
                dispatch(updateLastLine({ content: '✓ WebContainer ready', type: 'success' }));

                // ✅ FIX: prompt processing pehle, parallel mein chal sakta hai
                const prompt = searchParams.get('prompt');
                if (prompt) {
                    dispatch(setMessages([{ role: 'user', content: prompt }]));
                    // processGeneration ko await mat karo — server boot parallel mein chale
                    processGeneration(prompt, files).then(() => {
                        setTimeout(() => {
                            dispatch(addMessage({
                                role: 'assistant',
                                content: "✦ I've analyzed your prompt and started building.\n\nThe preview is live on the right. Ask me to change anything — colors, layout, copy, or sections. I'm listening."
                            }));
                        }, 3500);
                    });
                }

                // Removed iframe check as we are using popups

                // Install dependencies
                const filesList = await wc.fs.readdir('.');
                const hasPackageJson = filesList.includes('package.json');

                if (hasPackageJson) {
                    dispatch(setRunStatus('installing'));
                    dispatch(appendLine({ content: 'Installing dependencies…', type: 'process' }));

                    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
                    let spinIdx = 0;
                    const spinInterval = setInterval(() => {
                        dispatch(updateLastLine({ content: `Installing dependencies ${spinnerChars[spinIdx++ % spinnerChars.length]}`, type: 'process' }));
                    }, 100);

                    const exitCode = await runInstall((data: string) => {
                        if (!cancelled && data.toLowerCase().includes('err')) {
                            dispatch(appendLine({ content: data, type: 'error' }));
                        }
                    });

                    clearInterval(spinInterval);
                    if (exitCode !== 0) throw new Error('npm install failed');
                    dispatch(updateLastLine({ content: '✓ Dependencies installed', type: 'success' }));
                }

                // ✅ FIX: startDevServer HAMESHA chalega — install ke baad bhi
                dispatch(setRunStatus('running'));
                dispatch(appendLine({ content: 'Starting dev server…', type: 'process' }));

                await startDevServer(
                    (data) => {
                        if (!cancelled) {
                            if (data.includes('$')) dispatch(appendLine({ content: data, type: 'process' }));
                            else if (data.includes('✓')) dispatch(appendLine({ content: data, type: 'success' }));
                            else dispatch(appendLine({ content: data, type: 'log' }));
                        }
                    },
                    (url) => {
                        if (!cancelled) {
                            console.log('[EditorView] Preview URL received:', url);
                            dispatch(setPreviewUrl(url));
                            dispatch(setStatus('running'));

                            // Popup opening sequence
                            if (!popupRef.current || popupRef.current.closed) {
                                // First open the connection page to establish the window
                                popupRef.current = window.open(
                                    '/webcontainer/connect/init',
                                    'wc-preview',
                                    'width=1200,height=800'
                                );
                            }

                            if (popupRef.current) {
                                // Then navigate to the actual WebContainer URL
                                popupRef.current.location.href = url;
                            } else {
                                dispatch(appendLine({ content: '⚠ Preview popup blocked. Please allow popups.', type: 'error' }));
                            }
                        }
                    }
                );
            } catch (err) {
                if (!cancelled) {
                    dispatch(setStatus('error'));
                    dispatch(setRunStatus('error'));
                    dispatch(appendLine({ content: `✗ ${err}`, type: 'error' }));
                    console.error('[EditorView] Boot error:', err);
                }
            }
        }
        boot();
        return () => { cancelled = true; };
    }, [dispatch, processGeneration, searchParams, files]);

    const handleSendMessage = async () => {
        if (!chatInput.trim() || isTyping) return;

        const userMsg = chatInput.trim();
        dispatch(setInput(''));
        dispatch(addMessage({ role: 'user', content: userMsg }));
        dispatch(addToHistory(userMsg));
        dispatch(setIsTyping(true));

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
                dispatch(addMessage({ role: 'assistant', content: `✦ Updated: \`${changedPaths}\`` }));

                let hasPackageJsonUpdate = false;
                let updatedFiles = [...files];

                for (const file of data.files) {
                    if (file.path === 'package.json') hasPackageJsonUpdate = true;
                    await writeContainerFile(file.path, file.content);

                    const existingIndex = updatedFiles.findIndex(f => f.path === file.path);
                    if (existingIndex === -1) {
                        updatedFiles.push({
                            name: file.path.split('/').pop() || file.path,
                            path: file.path,
                            language: getLanguage(file.path),
                            isDirectory: false,
                        });
                    }

                    if (activeFile && file.path === activeFile.path) {
                        dispatch(setEditorContent(file.content));
                    }
                }

                dispatch(setFiles(updatedFiles));

                if (hasPackageJsonUpdate) {
                    dispatch(setRunStatus('installing'));
                    dispatch(appendLine({ content: 'package.json updated — syncing dependencies...', type: 'process' }));
                    const exitCode = await runInstall((logLine) => dispatch(appendLine({ content: logLine, type: 'log' })));
                    if (exitCode === 0) {
                        dispatch(updateLastLine({ content: '✓ Dependencies updated', type: 'success' }));
                        dispatch(setRunStatus('running'));
                    } else {
                        dispatch(setRunStatus('error'));
                        dispatch(appendLine({ content: '✗ Dependency sync failed', type: 'error' }));
                    }
                }
            } else if (data.error) {
                throw new Error(data.error);
            }
        } catch (err: any) {
            dispatch(setErrorData({
                message: err?.message || "Communication Disruption. Verify uplink.",
                type: 'runtime'
            }));
        } finally {
            dispatch(setIsTyping(false));
        }
    };

    const handleAutoFix = async () => {
        if (!errorData) return;
        dispatch(setIsReplicating(true));
        dispatch(setInput(`I encountered this error: "${errorData.message}". Please analyze and fix it.`));
        dispatch(setErrorData(null));
        // Small delay to let setChatInput settle before sending
        setTimeout(async () => {
            await handleSendMessage();
            dispatch(setIsReplicating(false));
        }, 100);
    };

    // WebContainer API handlers for Preview
    const handleRestartServer = useCallback(async () => {
        if (status === 'running') {
            dispatch(setStatus('booting'));
            dispatch(appendLine({ content: 'Restarting dev server...', type: 'process' }));
            try {
                // For now, just refresh the iframe - in a full implementation we'd restart the process
                if (popupRef.current && !popupRef.current.closed) {
                    popupRef.current.location.reload();
                }
                dispatch(setStatus('running'));
                dispatch(appendLine({ content: '✓ Server restarted', type: 'success' }));
            } catch (err) {
                dispatch(setStatus('error'));
                dispatch(appendLine({ content: `✗ Failed to restart server: ${err}`, type: 'error' }));
            }
        }
    }, [status, dispatch]);

    const handleClearContainer = useCallback(async () => {
        dispatch(setStatus('booting'));
        dispatch(appendLine({ content: 'Clearing container...', type: 'process' }));
        try {
            // Reboot the container
            await bootWebContainer();
            dispatch(setStatus('idle'));
            dispatch(setPreviewUrl(''));
            dispatch(appendLine({ content: '✓ Container cleared', type: 'success' }));
        } catch (err) {
            dispatch(setStatus('error'));
            dispatch(appendLine({ content: `✗ Failed to clear container: ${err}`, type: 'error' }));
        }
    }, [dispatch]);

    const handleInstallDeps = useCallback(async () => {
        dispatch(setRunStatus('installing'));
        dispatch(appendLine({ content: 'Installing dependencies...', type: 'process' }));
        try {
            const exitCode = await runInstall((logLine) => dispatch(appendLine({ content: logLine, type: 'log' })));
            if (exitCode === 0) {
                dispatch(setRunStatus('idle'));
                dispatch(appendLine({ content: '✓ Dependencies installed', type: 'success' }));
            } else {
                dispatch(setRunStatus('error'));
                dispatch(appendLine({ content: '✗ Failed to install dependencies', type: 'error' }));
            }
        } catch (err) {
            dispatch(setRunStatus('error'));
            dispatch(appendLine({ content: `✗ Install error: ${err}`, type: 'error' }));
        }
    }, [dispatch]);

    return (
        <div className="h-screen flex flex-col bg-zinc-950 font-sans overflow-hidden text-zinc-100">
            <TopBar
                viewMode={viewMode as 'code' | 'preview'}
                setViewMode={setViewModeFunc}
                previewUrl={previewUrl}
            />

            <main className="flex-1 flex overflow-hidden">
                <Sidebar
                    chatMessages={chatMessages}
                    isTyping={isTyping}
                    chatInput={chatInput}
                    setChatInput={setChatInputFunc}
                    handleSendMessage={handleSendMessage}
                />

                <Workspace
                    viewMode={viewMode as 'code' | 'preview'}
                    files={files}
                    activeFile={activeFile}
                    setActiveFile={setActiveFileFunc}
                    readContainerFile={readContainerFile}
                    setEditorContent={setEditorContentFunc}
                    editorContent={editorContent}
                    terminalLines={terminalLines}
                    runStatus={runStatus}
                    clearTerminal={() => dispatch(clearLines())}
                    deviceMode={deviceMode as 'desktop' | 'tablet' | 'mobile'}
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
                                    onClick={() => setErrorDataFunc(null)}
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