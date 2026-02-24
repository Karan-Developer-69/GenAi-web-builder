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

    const pkgContent = await wc.fs.readFile('package.json', 'utf-8').catch(() => '{}');
    const pkg = JSON.parse(pkgContent);
    const command = 'npm';
    const args = pkg.scripts?.dev ? ['run', 'dev'] : ['start'];

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

    try {
        const url = await Promise.race([urlWhenReady, timeout]);
        console.log('[WC] Server ready at:', url);
        onUrlReady?.(url);
        onTerminalLog?.(`\n✓ Server ready at ${url}\n`);
    } catch (err) {
        console.error('[WC] startDevServer error:', err);
        onTerminalLog?.(`\n✗ ${err}\n`);
        throw err;
    }
}

export async function runInstall(onTerminalLog?: (data: string) => void) {
    const wc = await getContainerInstance();
    onTerminalLog?.('✦ Synergy Orchestrating Dependencies...\n');

    const installProcess = await wc.spawn('npm', ['install']);

    installProcess.output.pipeTo(
        new WritableStream({
            write(data) {
                const cleaned = cleanTerminalLog(data);
                if (cleaned) {
                    if (cleaned.toLowerCase().includes('err') || cleaned.toLowerCase().includes('warn')) {
                        onTerminalLog?.(cleaned);
                    }
                }
            },
        })
    );

    const exitCode = await installProcess.exit;
    console.log('[WC] npm install exit code:', exitCode);
    onTerminalLog?.('✓ Dependencies Synchronized\n');
    return exitCode;
}

export async function needsInstall(): Promise<boolean> {
    const wc = await getContainerInstance();
    try {
        await wc.fs.readFile('package.json');
        return true;
    } catch {
        return false;
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

export async function readContainerFile(filePath: string): Promise<string> {
    const wc = await getContainerInstance();
    return await wc.fs.readFile(filePath, 'utf-8');
}