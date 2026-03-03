'use client';

import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import type { ShellType } from '../../components/Terminal';
import { useSearchParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import type { TerminalLine } from '../../../types/terminal';
import type { Theme, Task } from '@/utils/validators';
import { RootState } from '../../../lib/store/store';
import {
    setStatus,
    setPreviewUrl,
    setBooted,
    setFiles,
    setActiveFile,
    setEditorContent,
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
    updateMessage,
    setPhase,
    setThinkingText,
} from '../../../lib/store/slices/chatSlice';
import {
    appendLine,
    updateLastLine,
    clearLines,
    setActiveTab,
} from '../../../lib/store/slices/terminalSlice';
import {
    bootWebContainer,
    startDevServer,
    runInstall,
    startShell,
    readContainerFile,
    writeContainerFile,
    writeContainerFiles,
    readContainerTree,
    flattenTree,
    shouldReinstall,
    markInstalled,
    needsInstall,
    createContainerDirectory,
    getFramework,
    stopDevServer,
} from '../../../webcontainer/container';
import { pythonRunner } from '../../../utils/python-runner';
import { File, Folder } from '../../../components/ui/file-tree';
import { getLanguage } from '../../../lib/utils';
import { generateImage } from '../../../utils/image-ai';
import { DEFAULT_FILES_BY_FRAMEWORK } from '../../../utils/constants';

import TopBar from './TopBar';
import Sidebar from './Sidebar';
import Workspace from './Workspace';

export interface FileEntry {
    name: string;
    path: string;
    language: string;
    isDirectory?: boolean;
}

interface FileResult {
    path: string;
    content: string;
}

interface PlanResult {
    tasks: Task[];
    theme: Theme;
}

interface TreeNode {
    name: string;
    id: string;
    isDirectory: boolean;
    children?: TreeNode[];
}


export default function EditorView() {
    const searchParams = useSearchParams();
    const popupRef = useRef<Window | null>(null);
    const dispatch = useDispatch();

    // Selectors
    const status = useSelector((state: RootState) => state.editor.status);
    const previewUrl = useSelector((state: RootState) => state.editor.previewUrl);
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
    const phase = useSelector((state: RootState) => state.chat.phase);
    const thinkingText = useSelector((state: RootState) => state.chat.thinkingText);
    const selectedProvider = useSelector((state: RootState) => state.chat.selectedProvider);
    const selectedModel = useSelector((state: RootState) => state.chat.selectedModel);

    // Action dispatchers as functions
    const setActiveFileFunc = (file: FileEntry) => dispatch(setActiveFile(file));
    const setChatInputFunc = (input: string) => dispatch(setInput(input));
    const setEditorContentFunc = (content: string) => dispatch(setEditorContent(content));
    const setViewModeFunc = (mode: 'code' | 'preview') => dispatch(setViewMode(mode));
    const setErrorDataFunc = (data: { message: string; type: string } | null) => dispatch(setErrorData(data));
    const setActiveTabFunc = (tab: 'system' | 'user') => dispatch(setActiveTab(tab));

    const activeTab = useSelector((state: RootState) => state.terminal.activeTab);
    const [shell, setShell] = useState<ShellType | null>(null);

    // ── Log Throttling ──
    const logBufferRef = useRef<TerminalLine[]>([]);
    const flushLogs = useCallback(() => {
        if (logBufferRef.current.length === 0) return;

        // Group consecutive logs to reduce dispatches even further
        const logs = logBufferRef.current;
        logBufferRef.current = [];

        logs.forEach(log => {
            dispatch(appendLine(log));
        });
    }, [dispatch]);

    useEffect(() => {
        const interval = setInterval(flushLogs, 150); // Flush logs every 150ms
        return () => clearInterval(interval);
    }, [flushLogs]);

    const bufferedAppendLine = useCallback((log: Omit<TerminalLine, 'id'> & Partial<Pick<TerminalLine, 'id'>>) => {
        const entry: TerminalLine = {
            id: log.id ?? `${Date.now()}-${Math.random()}`,
            content: log.content,
            type: log.type,
        };
        logBufferRef.current.push(entry);
    }, []);

    const runDevServer = useCallback(async (cancelled: boolean) => {
        dispatch(setRunStatus('running'));
        bufferedAppendLine({ content: 'Starting dev server…', type: 'process' });

        await startDevServer(
            (data) => {
                if (!cancelled) {
                    if (data.includes('$')) bufferedAppendLine({ content: data, type: 'process' });
                    else if (data.includes('✓')) bufferedAppendLine({ content: data, type: 'success' });
                    else bufferedAppendLine({ content: data, type: 'log' });
                }
            },
            (url) => {
                if (!cancelled) {
                    dispatch(setPreviewUrl(url));
                    dispatch(setStatus('running'));

                    if (!popupRef.current || popupRef.current.closed) {
                        popupRef.current = window.open(
                            '/webcontainer/connect/init',
                            'wc-preview',
                            'width=1200,height=800'
                        );
                    }

                    if (popupRef.current) {
                        popupRef.current.location.href = url;
                    } else {
                        dispatch(appendLine({ content: '⚠ Preview popup blocked. Please allow popups.', type: 'error' }));
                    }
                }
            }
        );
    }, [dispatch, bufferedAppendLine]);

    const buildTreeData = (filesList: FileEntry[]) => {
        const root: TreeNode[] = [];
        const map: { [key: string]: TreeNode } = {};

        const sortedFiles = [...filesList].sort((a, b) => a.path.length - b.path.length);

        sortedFiles.forEach(file => {
            const parts = file.path.split('/');
            let currentPath = '';

            parts.forEach((part: string, index: number) => {
                const isLast = index === parts.length - 1;
                const pathPrefix = currentPath ? currentPath + '/' : '';
                currentPath = pathPrefix + part;

                const isDir = !isLast || Boolean(file.isDirectory);

                if (!map[currentPath]) {
                    const item: TreeNode = {
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
                            map[parentPath].children!.push(item);
                        }
                    }
                }
            });
        });

        const sortItems = (items: TreeNode[]) => {
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

    const renderFileTree = (elements: TreeNode[]) => {
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

    // ── SSE helper: calls /api/generate and reads streamed events ──
    // NOTE: Never passes chat messages history to AI — only prompt + plan/task context
    const fetchGenerateSSE = useCallback(async (
        body: Record<string, unknown>,
        onStatus: (msg: string) => void,
    ): Promise<unknown> => {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, selectedProvider, selectedModel }),
        });
        if (!res.ok || !res.body) throw new Error(`Generate failed (${res.status})`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                // Handle both 'data: {...}' and 'event: xxx' lines
                if (trimmed.startsWith('data: ')) {
                    let parsed: unknown;
                    try { parsed = JSON.parse(trimmed.slice(6)); } catch { continue; }

                    const p = parsed as Record<string, unknown>;
                    if (typeof p.message === 'string') onStatus(p.message);
                    // safely extract detail / error as string
                    const detailVal = p.detail;
                    let errMsg: string | undefined;
                    if (typeof detailVal === 'string') {
                        errMsg = detailVal;
                    } else if (detailVal && typeof detailVal === 'object') {
                        errMsg = JSON.stringify(detailVal);
                    }
                    const errorVal = p.error;
                    let errValStr: string | undefined;
                    if (typeof errorVal === 'string') {
                        errValStr = errorVal;
                    } else if (errorVal && typeof errorVal === 'object') {
                        errValStr = JSON.stringify(errorVal);
                    }
                    if (errMsg || errValStr) {
                        throw new Error(errMsg ?? errValStr ?? 'Unknown error');
                    }
                    if ('result' in p) return p.result;
                }
            }
        }
        return null;
    }, [selectedModel, selectedProvider]);

    const framework = searchParams.get('framework') || 'react';

    const processGeneration = useCallback(async (prompt: string, currentFiles: FileEntry[]) => {
        let installStarted = false;
        let installAndServerPromise: Promise<void> | null = null;
        let updatedFiles = [...currentFiles];

        // ── Helpers ──
        const refreshFileTree = async () => {
            try {
                const tree = await readContainerTree();
                const flat = flattenTree(tree).filter(e => !e.isDirectory);
                const newFiles: FileEntry[] = flat.map(e => ({
                    name: e.name,
                    path: e.path,
                    language: getLanguage(e.path),
                    isDirectory: false,
                }));
                updatedFiles = newFiles;
                dispatch(setFiles(newFiles));
            } catch {
                // fallback: keep existing files
            }
        };

        const processImagesInFiles = async (taskFiles: FileResult[]) => {
            for (const file of taskFiles) {
                if (typeof file.content !== 'string') continue;

                const matches = [...file.content.matchAll(/https:\/\/ai-image\.local\/prompt\?q=([^"'\r\n\s>]+)/g)];
                if (matches.length === 0) continue;

                let updatedContent = file.content;
                let hasChanges = false;

                for (const match of matches) {
                    const fullUrl = match[0];
                    const encodedPrompt = match[1];
                    const prompt = decodeURIComponent(encodedPrompt).replace(/\+/g, ' ');

                    console.log(`[EditorView] Generating AI Image for: ${prompt}`);
                    try {
                        const realUrl = await generateImage(prompt);
                        updatedContent = updatedContent.split(fullUrl).join(realUrl);
                        hasChanges = true;
                    } catch (e) {
                        console.error("[EditorView] AI Image failed:", e);
                    }
                }

                if (hasChanges) {
                    file.content = updatedContent;
                    await writeContainerFile(file.path, updatedContent);
                    // Refresh editor if active
                    const currentActivePath = activeFile?.path;
                    if (currentActivePath === file.path) {
                        dispatch(setEditorContent(updatedContent));
                    }
                }
            }
        };

        const startProjectIfPossible = async () => {
            if (installStarted) return;

            // Safety check: verify dependency file exists before starting install
            const needsInstallation = await needsInstall();
            if (!needsInstallation) {
                dispatch(appendLine({ content: '⚠ Skipping auto-start: No dependency file (package.json/requirements.txt) found.', type: 'error' }));
                return;
            }

            if (framework === 'python') {
                installStarted = true;
                installAndServerPromise = (async () => {
                    dispatch(setRunStatus('installing'));

                    // Collect ALL files from container to sync to backend
                    const tree = await readContainerTree();
                    const flat = flattenTree(tree).filter(e => !e.isDirectory);
                    const projectFiles = await Promise.all(
                        flat.map(async f => ({
                            path: f.path,
                            content: await readContainerFile(f.path)
                        }))
                    );

                    if (projectFiles.length === 0) {
                        console.log('[EditorView] No project files found yet, skipping runner.');
                        return;
                    }

                    // Noisy log patterns to filter out
                    const NOISY_PATTERNS = [
                        /^Collecting /i,
                        /^Using cached /i,
                        /^Downloading /i,
                        /^Requirement already satisfied/i,
                        /^  Preparing metadata /i,
                        /^  Installing build dependencies/i,
                        /^  Checking if build backend supports /i,
                        /^  Getting requirements /i,
                    ];

                    await pythonRunner.run(
                        { files: projectFiles },
                        (msg) => {
                            if (msg.type === 'log' && msg.content) {
                                // Skip noisy logs
                                const isNoisy = NOISY_PATTERNS.some(p => p.test(msg.content!));
                                if (isNoisy) return;

                                dispatch(appendLine({ content: msg.content, type: 'log' }));

                                // Port detection logic
                                const portMatch = msg.content.match(/(?:at\s+|listening\s+on\s+)(?:http:\/\/)?(?:localhost|0\.0\.0\.0|127\.0\.0\.1):(\d+)/i)
                                    || msg.content.match(/port\s*[:=]\s*(\d+)/i)
                                    || msg.content.match(/running on http:\/\/.*:(\d+)/i);

                                if (portMatch && portMatch[1]) {
                                    const port = portMatch[1];
                                    const url = `http://localhost:${port}`;
                                    dispatch(setPreviewUrl(url));
                                    dispatch(setStatus('running'));
                                    dispatch(appendLine({ content: `🚀 Preview detected at ${url}`, type: 'success' }));
                                }
                            } else if (msg.type === 'error') {
                                dispatch(appendLine({ content: msg.message || 'Unknown error', type: 'error' }));
                            }
                        }
                    );
                })();
            } else {
                // Node install logic (Background)
                installStarted = true;
                installAndServerPromise = (async () => {
                    dispatch(setRunStatus('installing'));
                    await stopDevServer(); // ✅ Stop old node dev server before install
                    const exitCode = await runInstall((data) => {
                        bufferedAppendLine({ content: data, type: 'log' });
                    });
                    if (exitCode === 0) {
                        dispatch(updateLastLine({ content: '✓ Dependencies synchronized', type: 'success' }));
                        await runDevServer(false);
                    } else {
                        dispatch(setRunStatus('error'));
                    }
                })();
            }
        };

        try {
            const isFixRequest = /fix|error|bug|typo|issue|correct|not working/i.test(prompt);

            if (isFixRequest && currentFiles.length > 0) {
                dispatch(setPhase('thinking'));
                dispatch(setThinkingText('Analyzing for fixes...'));

                const fixedFiles = await fetchGenerateSSE(
                    { prompt, mode: 'fix', existingFiles: currentFiles, framework },
                    (msg) => {
                        if (msg) dispatch(setThinkingText(msg));
                    },
                );

                if (fixedFiles && Array.isArray(fixedFiles)) {
                    dispatch(setPhase('executing'));
                    for (const f of fixedFiles) {
                        dispatch(appendLine({ content: `✦ Fixing ${f.path}...`, type: 'process' }));
                        await writeContainerFile(f.path, f.content);
                    }
                    const tree = await readContainerTree();
                    const flat = flattenTree(tree).filter(e => !e.isDirectory);
                    dispatch(setFiles(flat.map(e => ({
                        name: e.name,
                        path: e.path,
                        language: getLanguage(e.path),
                        isDirectory: false,
                    }))));
                    dispatch(addMessage({ role: 'assistant', content: `✦ Targeted fixes applied to: ${fixedFiles.map(f => `**${f.path}**`).join(', ')}` }));

                    // Trigger restart/re-sync for Python projects
                    if (framework === 'python') {
                        installStarted = false; // Allow startProjectIfPossible to run
                        await startProjectIfPossible();
                    }

                    return fixedFiles;
                }
            }

            // ── Normal Mode: Phase 1: Thinking ──
            dispatch(setPhase('thinking'));
            dispatch(setThinkingText(''));

            const planResult = await fetchGenerateSSE(
                { prompt, mode: 'plan', framework },
                (msg) => {
                    if (msg) dispatch(setThinkingText(msg));
                },
            );

            const { tasks, theme } = (planResult && !Array.isArray(planResult) ? planResult : {}) as PlanResult;

            if (!tasks || tasks.length === 0) throw new Error('No tasks generated');

            // ── Phase 2: Planning ── Show intro + plan
            dispatch(setPhase('planning'));
            dispatch(setThinkingText(''));
            dispatch(addMessage({ role: 'assistant', content: `I can build this for you! Let me set everything up.` }));

            const initialPlanStr = `<plan>\n${tasks.map((t: Task) => `- [ ] ${t.task}`).join('\n')}\n</plan>`;
            dispatch(addMessage({ role: 'assistant', content: initialPlanStr }));
            const planMessageIndex = chatMessages.length + 2;

            let allGeneratedFiles: FileResult[] = [];


            // ── Phase 3: Executing tasks (PARALLEL PIPELINE) ──
            dispatch(setPhase('executing'));

            // Helper: execute a single task — AI call → batch write → update UI
            const executeTask = async (currentTask: Task, taskIndex: number) => {
                // Pass existing file paths so AI knows what already exists
                const existingFilePaths = allGeneratedFiles.map(f => f.path);

                const taskResult = await fetchGenerateSSE(
                    { prompt, mode: 'task_execute', plan: tasks, theme, currentTask, existingFiles: existingFilePaths, framework },
                    () => { },
                );

                const taskFiles: FileResult[] = Array.isArray(taskResult)
                    ? taskResult as FileResult[]
                    : ((taskResult as Record<string, unknown>).files as FileResult[] | undefined) ?? [];

                // ── Fallback logic: Ensure mandatory dependency files exist in the setup task ──
                const isSetupTask = currentTask.task === "Initial Project Setup";
                if (isSetupTask) {
                    const mandatoryFiles = DEFAULT_FILES_BY_FRAMEWORK[framework] || [];
                    for (const mandatory of mandatoryFiles) {
                        const exists = taskFiles.some(f => f.path === mandatory.path);
                        if (!exists) {
                            console.warn(`[EditorView] AI missed mandatory file ${mandatory.path} for ${framework}. Injecting fallback.`);
                            taskFiles.push({ path: mandatory.path, content: mandatory.content });
                        }
                    }
                }

                if (taskFiles.length > 0) {
                    allGeneratedFiles = [...allGeneratedFiles, ...taskFiles];

                    // Batch write all files for this task in parallel
                    await writeContainerFiles(taskFiles);

                    // Refresh file tree from actual container FS
                    await refreshFileTree();

                    // Replace placeholders with real AI images (async, non-blocking for next task)
                    processImagesInFiles(taskFiles);

                    // Set first file as active in editor
                    if (taskIndex === 0) {
                        const firstFile = updatedFiles.find(f => f.path === taskFiles[0].path) || updatedFiles[0];
                        dispatch(setActiveFile(firstFile));
                        const content = await readContainerFile(firstFile.path);
                        dispatch(setEditorContent(content));
                    }

                    // Smart install: only if dependency files changed
                    const hasDepsFile = taskFiles.some(f => f.path === 'package.json' || f.path === 'requirements.txt');
                    if (hasDepsFile) {
                        const needsReinstall = await shouldReinstall();
                        if (needsReinstall) {
                            startProjectIfPossible();
                        }
                    }
                }

                // Show per-task completion in chat
                const fileNames = taskFiles.map(f => f.path);
                const stepMsg = `<step task="${currentTask.task}">${fileNames.join('\n')}</step>`;
                dispatch(addMessage({ role: 'assistant', content: `✦ I have implemented: **${currentTask.task}**\n${stepMsg}` }));

                // Update plan checkmarks
                const updatedPlanStr = `<plan>\n${tasks.map((t: Task, idx: number) =>
                    `${idx <= taskIndex ? '- [x]' : '- [ ]'} ${t.task}`
                ).join('\n')}\n</plan>`;
                dispatch(updateMessage({ index: planMessageIndex, content: updatedPlanStr }));
            };

            // Execute Task 1 first (creates package.json → triggers background install)
            await executeTask(tasks[0], 0);

            // Execute remaining tasks 2-at-a-time in parallel
            const CONCURRENCY = 2;
            const remaining = tasks.slice(1);
            for (let i = 0; i < remaining.length; i += CONCURRENCY) {
                const batch = remaining.slice(i, i + CONCURRENCY);
                await Promise.all(
                    batch.map((task, batchIdx) => executeTask(task, i + batchIdx + 1))
                );
            }

            // ── Phase 4: Launching ──
            dispatch(setPhase('launching'));
            dispatch(addMessage({
                role: 'assistant',
                content: 'All tasks complete! Finalizing your project…'
            }));

            // Final safety check: if we haven't started install/server yet, but package.json exists, start it now.
            await startProjectIfPossible();

            // Wait for install + dev server if they're still running
            if (installAndServerPromise) {
                await installAndServerPromise;
            }

            // Final file tree refresh from container
            await refreshFileTree();

            return allGeneratedFiles;
        } catch (err) {
            dispatch(setPhase('idle'));
            dispatch(appendLine({ content: `✗ ${err}`, type: 'error' }));
            throw err;
        }
    }, [dispatch, chatMessages.length, fetchGenerateSSE, bufferedAppendLine, activeFile, framework, runDevServer]);

    const isBooting = useRef(false);

    useEffect(() => {
        if (isBooting.current) return;
        isBooting.current = true;
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
                dispatch(appendLine({ content: '✓ WebContainer ready', type: 'success' }));

                // Start interactive shell
                const shellInstance = await startShell();
                setShell(shellInstance);

                const prompt = searchParams.get('prompt');
                if (prompt) {
                    dispatch(setMessages([{ role: 'user', content: prompt }]));

                    // processGeneration handles npm install + dev server internally (parallel)
                    await processGeneration(prompt, files);

                    // Dev server is started inside processGeneration as part of the install chain
                    dispatch(setPhase('done'));
                } else {
                    // No prompt: check if there's already a package.json in the container
                    const filesList = (await wc.fs.readdir('.').catch(() => [])) as string[];
                    const hasDepsFile = filesList.includes('package.json') || filesList.includes('requirements.txt');

                    if (hasDepsFile) {
                        dispatch(setRunStatus('installing'));
                        dispatch(appendLine({ content: 'Orchestrating dependencies…', type: 'process' }));

                        const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
                        let spinIdx = 0;
                        const spinInterval = setInterval(() => {
                            dispatch(updateLastLine({ content: `Processing ${spinnerChars[spinIdx++ % spinnerChars.length]}`, type: 'process' }));
                        }, 100);

                        const exitCode = await runInstall((data: string) => {
                            if (!cancelled && data.trim()) {
                                bufferedAppendLine({ content: data, type: 'log' });
                            }
                        });

                        clearInterval(spinInterval);
                        if (exitCode !== 0) throw new Error('Installation failed');
                        dispatch(updateLastLine({ content: '✓ Dependencies synchronized', type: 'success' }));

                        await runDevServer(cancelled);
                    } else {
                        dispatch(setStatus('idle'));
                        dispatch(updateLastLine({ content: '✦ Ready. Describe your project to start.', type: 'success' }));
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    dispatch(setStatus('error'));
                    dispatch(setRunStatus('error'));
                    dispatch(appendLine({ content: `✗ ${err}`, type: 'error' }));
                }
            }
        }
        boot();
        return () => {
            cancelled = true;
            pythonRunner.stop();
        };
    }, [dispatch, processGeneration, searchParams, bufferedAppendLine, files, runDevServer]);

    // ── Debounced auto-save: write editor changes to WebContainer after 1s ──
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedContentRef = useRef<string>('');

    useEffect(() => {
        if (!activeFile || !editorContent) return;
        // Skip if content hasn't changed from last save
        if (editorContent === lastSavedContentRef.current) return;

        // Clear existing timer
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

        // Set new debounce timer
        autoSaveTimerRef.current = setTimeout(async () => {
            try {
                await writeContainerFile(activeFile.path, editorContent);
                lastSavedContentRef.current = editorContent;
                // Silent save — no terminal log for auto-save to avoid noise
            } catch {
                // Auto-save failures are silent
            }
        }, 1000);

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [editorContent, activeFile]);

    const handleSendMessage = async () => {
        if (!chatInput.trim() || isTyping) return;

        const userMsg = chatInput.trim();
        dispatch(setInput(''));
        dispatch(addMessage({ role: 'user', content: userMsg }));
        dispatch(addToHistory(userMsg));
        dispatch(setIsTyping(true));

        try {
            await processGeneration(userMsg, files);
            dispatch(setPhase('done'));
        } catch (err: unknown) {
            dispatch(setPhase('idle'));
            dispatch(setErrorData({
                message: err instanceof Error ? err.message : String(err) || "Communication Disruption. Verify uplink.",
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
        setTimeout(async () => {
            await handleSendMessage();
            dispatch(setIsReplicating(false));
        }, 100);
    };

    const handleRestartServer = useCallback(async () => {
        if (status === 'running') {
            dispatch(setStatus('booting'));
            dispatch(appendLine({ content: 'Restarting dev server...', type: 'process' }));
            try {
                const framework = await getFramework();
                if (framework === 'python') {
                    // Start processGeneration again (or just trigger runner)
                    await processGeneration(chatMessages[0]?.content || 'Restart', files);
                } else {
                    if (popupRef.current && !popupRef.current.closed) {
                        popupRef.current.location.reload();
                    }
                }
                dispatch(setStatus('running'));
                dispatch(appendLine({ content: '✓ Server restarted', type: 'success' }));
            } catch (err) {
                dispatch(setStatus('error'));
                dispatch(appendLine({ content: `✗ Failed to restart server: ${err}`, type: 'error' }));
            }
        }
    }, [status, dispatch, chatMessages, files, processGeneration]);

    const handleClearContainer = useCallback(async () => {
        dispatch(setStatus('booting'));
        dispatch(appendLine({ content: 'Clearing container...', type: 'process' }));
        try {
            await bootWebContainer();
            dispatch(setStatus('idle'));
            dispatch(setPreviewUrl(''));
            dispatch(appendLine({ content: '✓ Container cleared', type: 'success' }));
        } catch (err) {
            dispatch(setStatus('error'));
            dispatch(appendLine({ content: `✗ Failed to clear container: ${err}`, type: 'error' }));
        }
    }, [dispatch]);

    const handleSaveFile = useCallback(async (filePath: string, content: string) => {
        try {
            await writeContainerFile(filePath, content);
            dispatch(appendLine({ content: `✓ Saved ${filePath}`, type: 'success' }));

            // If deps file was saved, check if we need to reinstall
            if (filePath === 'package.json' || filePath === 'requirements.txt') {
                const needsReinstall = await shouldReinstall();
                if (needsReinstall) {
                    dispatch(setRunStatus('installing'));
                    dispatch(appendLine({ content: `📦 ${filePath} changed — synchronizing dependencies…`, type: 'process' }));

                    const framework = await getFramework();
                    if (framework !== 'python') await stopDevServer(); // ✅ Stop dev server on manual save of pkg.json

                    const exitCode = await runInstall((logLine) => {
                        if (logLine.trim()) bufferedAppendLine({ content: logLine, type: 'log' });
                    });
                    if (exitCode === 0) {
                        await markInstalled();
                        dispatch(appendLine({ content: '✓ Dependencies updated', type: 'success' }));
                        dispatch(setRunStatus('idle'));

                        if (framework !== 'python') {
                            await runDevServer(false); // ✅ Restart server automatically
                        }
                    } else {
                        dispatch(appendLine({ content: '✗ Dependency synchronization failed', type: 'error' }));
                        dispatch(setRunStatus('idle'));
                    }
                }
            }

            // Refresh file tree from container
            try {
                const tree = await readContainerTree();
                const flat = flattenTree(tree).filter(e => !e.isDirectory);
                const newFiles: FileEntry[] = flat.map(e => ({
                    name: e.name,
                    path: e.path,
                    language: getLanguage(e.path),
                    isDirectory: false,
                }));
                dispatch(setFiles(newFiles));
            } catch { /* keep existing */ }
        } catch (err) {
            dispatch(appendLine({ content: `✗ Failed to save ${filePath}: ${err}`, type: 'error' }));
        }
    }, [dispatch, bufferedAppendLine, runDevServer]);

    // ── Create File Handler ──
    const handleCreateFile = useCallback(async (filePath: string) => {
        try {
            await writeContainerFile(filePath, '');
            dispatch(appendLine({ content: `✓ Created ${filePath}`, type: 'success' }));

            // Refresh file tree
            const tree = await readContainerTree();
            const flat = flattenTree(tree).filter(e => !e.isDirectory);
            const newFiles: FileEntry[] = flat.map(e => ({
                name: e.name,
                path: e.path,
                language: getLanguage(e.path),
                isDirectory: false,
            }));
            dispatch(setFiles(newFiles));

            // Open the new file
            const newFile = newFiles.find(f => f.path === filePath);
            if (newFile) {
                dispatch(setActiveFile(newFile));
                dispatch(setEditorContent(''));
            }
        } catch (err) {
            dispatch(appendLine({ content: `✗ Failed to create ${filePath}: ${err}`, type: 'error' }));
        }
    }, [dispatch]);

    // ── Create Folder Handler ──
    const handleCreateFolder = useCallback(async (dirPath: string) => {
        try {
            await createContainerDirectory(dirPath);
            dispatch(appendLine({ content: `✓ Created folder ${dirPath}`, type: 'success' }));

            // Refresh file tree — include BOTH files and directories so empty folders show
            const tree = await readContainerTree();
            const flat = flattenTree(tree);
            const newFiles: FileEntry[] = flat.map(e => ({
                name: e.name,
                path: e.path,
                language: e.isDirectory ? '' : getLanguage(e.path),
                isDirectory: e.isDirectory,
            }));
            dispatch(setFiles(newFiles));
        } catch (err) {
            dispatch(appendLine({ content: `✗ Failed to create folder ${dirPath}: ${err}`, type: 'error' }));
        }
    }, [dispatch]);

    const handleInstallDeps = useCallback(async () => {
        dispatch(setRunStatus('installing'));
        bufferedAppendLine({ content: 'Installing dependencies...', type: 'process' });
        try {
            const exitCode = await runInstall((logLine) => bufferedAppendLine({ content: logLine, type: 'log' }));
            if (exitCode === 0) {
                dispatch(updateLastLine({ content: '✓ Dependencies installed', type: 'success' }));
                await runDevServer(false);
            } else {
                dispatch(setRunStatus('error'));
                dispatch(appendLine({ content: '✗ Failed to install dependencies', type: 'error' }));
            }
        } catch (err) {
            dispatch(setRunStatus('error'));
            dispatch(appendLine({ content: `✗ Install error: ${err}`, type: 'error' }));
        }
    }, [dispatch, bufferedAppendLine, runDevServer]);

    return (
        <div className="relative h-screen flex flex-col bg-[#050505] font-sans overflow-hidden text-zinc-100 selection:bg-indigo-500/30">
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
                    phase={phase}
                    thinkingText={thinkingText}
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
                    userLines={[]}
                    activeTab={activeTab}
                    setActiveTab={setActiveTabFunc}
                    shell={shell ?? undefined}
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
                    onSaveFile={handleSaveFile}
                    onCreateFile={handleCreateFile}
                    onCreateFolder={handleCreateFolder}
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