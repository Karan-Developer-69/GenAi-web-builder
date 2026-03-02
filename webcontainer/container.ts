import { WebContainer, type FileSystemTree } from '@webcontainer/api';

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

// ✅ FIX 1: server-ready URL globally cache karo
// Agar event pehle fire ho aur EditorView baad mein pooche — dono cases handle honge
let cachedServerUrl: string | null = null;
let serverReadyCallbacks: Array<(url: string) => void> = [];

export async function getContainerInstance(): Promise<WebContainer> {
    if (webcontainerInstance) return webcontainerInstance;
    if (bootPromise) return bootPromise;

    bootPromise = (async () => {
        try {
            console.log('[WC] Booting WebContainer...');
            webcontainerInstance = await WebContainer.boot();
            console.log('[WC] Boot complete. Registering server-ready listener NOW.');

            // ✅ FIX 2: server-ready listener BOOT ke turant baad register karo
            // Yeh SPAWN se pehle hoga — guaranteed. Event kabhi miss nahi hoga.
            webcontainerInstance.on('server-ready', (_port, url) => {
                console.log('[WC] ✅ server-ready FIRED! port:', _port, 'url:', url);
                cachedServerUrl = url;
                serverReadyCallbacks.forEach(cb => cb(url));
                serverReadyCallbacks = [];
            });

            return webcontainerInstance;
        } catch (err) {
            bootPromise = null;
            throw err;
        }
    })();

    return bootPromise;
}

export async function bootWebContainer(): Promise<WebContainer> {
    const wc = await getContainerInstance();
    await wc.mount({});
    console.log('[WC] Container initialized with empty filesystem.');
    return wc;
}

export function cleanTerminalLog(data: string): string {
    if (!data) return '';
    return data
        .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
        .replace(/[\r\x08\x07\x00-\x09\x0B-\x1F\x7F]/g, '')
        .replace(/\n{3,}/g, '\n\n');
}

let activeDevProcess: import('@webcontainer/api').WebContainerProcess | null = null;

export async function stopDevServer() {
    if (activeDevProcess) {
        console.log('[WC] Stopping active dev server...');
        activeDevProcess.kill();
        activeDevProcess = null;
    }
    cachedServerUrl = null;
    serverReadyCallbacks = [];
}

export async function startDevServer(
    onTerminalLog?: (data: string) => void,
    onUrlReady?: (url: string) => void
) {
    const wc = await getContainerInstance();

    if (cachedServerUrl) {
        console.log('[WC] Server already cached:', cachedServerUrl);
        onUrlReady?.(cachedServerUrl);
        onTerminalLog?.(`✓ Server already running at ${cachedServerUrl}\n`);
        return;
    }

    const framework = await getFramework();

    if (framework === 'python') {
        // Redirection to Python Runner is handled in EditorView.tsx 
        // because it needs the file contents to send over WebSocket.
        // We throw a specific error or return a signal here.
        return 'DELEGATE_TO_PYTHON_RUNNER';
    }

    let command = 'npm';
    let args = ['run', 'dev'];

    let pkg: any = {};
    try {
        const pkgContent = await wc.fs.readFile('package.json', 'utf-8').catch(() => '{}');
        pkg = JSON.parse(pkgContent);
    } catch (e) {
        console.warn('[WC] Could not parse package.json', e);
    }

    const scripts = pkg.scripts || {};
    if (scripts.dev) {
        args = ['run', 'dev'];
    } else if (scripts.start) {
        args = ['start']; // equivalent to run start, but standard npm
    } else if (scripts.preview) {
        args = ['run', 'preview'];
    } else {
        onTerminalLog?.(`\n⚠ Warning: No familiar dev script (dev, start, preview) found in package.json. Defaulting to npm start.\n`);
        args = ['start'];
    }

    onTerminalLog?.(`$ ${command} ${args.join(' ')}\n`);
    console.log('[WC] Spawning:', command, args.join(' '));

    const urlWhenReady = new Promise<string>((resolve) => {
        if (cachedServerUrl) { resolve(cachedServerUrl); return; }
        serverReadyCallbacks.push((url) => {
            console.log('[WC] Callback received URL:', url);
            resolve(url);
        });
    });

    const devProcess = await wc.spawn(command, args);
    console.log('[WC] Process spawned, waiting for server-ready...');

    devProcess.output.pipeTo(
        new WritableStream({
            write(data) {
                const cleaned = cleanTerminalLog(data);
                if (cleaned) {
                    console.log('[WC stdout]', cleaned.trim());
                    onTerminalLog?.(cleaned);
                }
            },
        })
    );

    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('server-ready timeout after 30s — check console logs')), 30_000)
    );

    const devProcessExit = devProcess.exit.then((code) => {
        throw new Error(`Server process exited prematurely with code ${code}. Check the terminal logs.`);
    });

    try {
        const url = await Promise.race([urlWhenReady, timeout, devProcessExit]);
        console.log('[WC] Server ready at:', url);
        activeDevProcess = devProcess; // Save reference for killing
        onUrlReady?.(url);
        onTerminalLog?.(`\n✓ Server ready at ${url}\n`);
    } catch (err) {
        console.error('[WC] startDevServer error:', err);
        activeDevProcess = null;
        onTerminalLog?.(`\n✗ ${err}\n`);
        throw err;
    }
}

export async function runInstall(onTerminalLog?: (data: string) => void) {
    const wc = await getContainerInstance();
    const framework = await getFramework();

    if (framework === 'python') {
        // Handled in EditorView.tsx
        return 0; // Signal success but do nothing in WC
    }

    let command = 'npm';
    let args = ['install'];

    onTerminalLog?.(`✦ Synergy Orchestrating ${framework} Dependencies...\n`);

    const installProcess = await wc.spawn(command, args);

    installProcess.output.pipeTo(
        new WritableStream({
            write(data) {
                const cleaned = cleanTerminalLog(data);
                if (cleaned) {
                    onTerminalLog?.(cleaned);
                }
            },
        })
    );

    const exitCode = await installProcess.exit;
    console.log(`[WC] ${command} install exit code:`, exitCode);
    if (exitCode === 0) {
        onTerminalLog?.('✓ Dependencies Synchronized\n');
    }
    return exitCode;
}

export async function needsInstall(): Promise<boolean> {
    const wc = await getContainerInstance();
    try {
        const files = await wc.fs.readdir('.');
        return files.includes('package.json') || files.includes('requirements.txt');
    } catch {
        return false;
    }
}

export async function getFramework(): Promise<'react' | 'python' | 'nextjs'> {
    const wc = await getContainerInstance();
    try {
        const files = await wc.fs.readdir('.');
        if (files.includes('requirements.txt')) return 'python';
        if (files.includes('next.config.js') || files.includes('next.config.ts')) return 'nextjs';
        return 'react';
    } catch {
        return 'react';
    }
}

export async function writeContainerFile(filePath: string, contents: string) {
    const wc = await getContainerInstance();
    const parts = filePath.split('/');
    if (parts.length > 1) {
        let currentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
            currentPath += (currentPath ? '/' : '') + parts[i];
            try { await wc.fs.mkdir(currentPath); } catch { /* exists */ }
        }
    }
    await wc.fs.writeFile(filePath, contents);
}

/**
 * Batch write multiple files in parallel.
 * Creates all needed directories first (deduped), then writes files concurrently.
 */
export async function writeContainerFiles(files: { path: string; content: string }[]) {
    const wc = await getContainerInstance();

    // Collect all unique directory paths needed
    const dirsNeeded = new Set<string>();
    for (const file of files) {
        const parts = file.path.split('/');
        if (parts.length > 1) {
            let currentPath = '';
            for (let i = 0; i < parts.length - 1; i++) {
                currentPath += (currentPath ? '/' : '') + parts[i];
                dirsNeeded.add(currentPath);
            }
        }
    }

    // Create directories in order (short paths first so parents exist)
    const sortedDirs = Array.from(dirsNeeded).sort((a, b) => a.length - b.length);
    for (const dir of sortedDirs) {
        try { await wc.fs.mkdir(dir); } catch { /* exists */ }
    }

    // Write all files in parallel
    await Promise.all(
        files.map(f => wc.fs.writeFile(f.path, f.content))
    );
}

/**
 * Create a directory in the WebContainer (recursive, like mkdir -p).
 */
export async function createContainerDirectory(dirPath: string) {
    const wc = await getContainerInstance();
    const parts = dirPath.split('/').filter(Boolean);
    let currentPath = '';
    for (const part of parts) {
        currentPath += (currentPath ? '/' : '') + part;
        try { await wc.fs.mkdir(currentPath); } catch { /* exists */ }
    }
}

export async function readContainerFile(filePath: string): Promise<string> {
    const wc = await getContainerInstance();
    return await wc.fs.readFile(filePath, 'utf-8');
}

/* ────────── READ CONTAINER FILE TREE (recursive) ────────── */
const SKIP_DIRS = new Set(['node_modules', '.cache', 'dist', '.next', '.vite', '.git', '.turbo']);

export interface ContainerFileEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    language?: string;
    children?: ContainerFileEntry[];
}

async function readDirRecursive(wc: WebContainer, dirPath: string): Promise<ContainerFileEntry[]> {
    const entries: ContainerFileEntry[] = [];
    try {
        const dirEntries = await wc.fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of dirEntries) {
            const fullPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name)) continue;
                const children = await readDirRecursive(wc, fullPath);
                entries.push({
                    name: entry.name,
                    path: fullPath,
                    isDirectory: true,
                    children,
                });
            } else {
                entries.push({
                    name: entry.name,
                    path: fullPath,
                    isDirectory: false,
                });
            }
        }
    } catch {
        // directory might not exist yet
    }
    return entries;
}

/** Recursively read the full file tree from the WebContainer filesystem */
export async function readContainerTree(): Promise<ContainerFileEntry[]> {
    const wc = await getContainerInstance();
    return readDirRecursive(wc, '');
}

/** Flatten the tree into a flat list of file entries (non-directories) */
export function flattenTree(entries: ContainerFileEntry[]): ContainerFileEntry[] {
    const result: ContainerFileEntry[] = [];
    for (const entry of entries) {
        if (entry.isDirectory && entry.children) {
            result.push(entry); // include dirs too for the tree
            result.push(...flattenTree(entry.children));
        } else {
            result.push(entry);
        }
    }
    return result;
}

/* ────────── SMART NPM INSTALL (hash-based) ────────── */
let lastPackageJsonHash: string | null = null;

/** Simple string hash for comparison */
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32-bit int
    }
    return hash.toString(36);
}

/** Get current package.json hash from container */
export async function getPackageJsonHash(): Promise<string | null> {
    try {
        const content = await readContainerFile('package.json');
        return simpleHash(content);
    } catch {
        return null;
    }
}

/** Check if npm install is needed (package.json content changed) */
export async function shouldReinstall(): Promise<boolean> {
    const currentHash = await getPackageJsonHash();
    if (!currentHash) return false; // no package.json
    if (lastPackageJsonHash === null) return true; // first time
    return currentHash !== lastPackageJsonHash;
}

/** Mark the current package.json as installed */
export async function markInstalled(): Promise<void> {
    lastPackageJsonHash = await getPackageJsonHash();
}

/** Start an interactive shell (jsh) */
export async function startShell() {
    const wc = await getContainerInstance();
    const shellProcess = await wc.spawn('jsh', {
        terminal: {
            cols: 80,
            rows: 24,
        },
    });


    const input = shellProcess.input.getWriter();

    return {
        write: (data: string) => input.write(data),
        resize: (cols: number, rows: number) => shellProcess.resize({ cols, rows }),
        process: shellProcess,
        output: shellProcess.output,
    };
}