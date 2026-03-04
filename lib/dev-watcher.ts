/**
 * dev-watcher.ts
 *
 * Drop-in replacement for `npm run dev` that:
 *  1. Starts the Next.js dev server.
 *  2. Watches package.json — on change, kills the server, runs `npm install`, then restarts.
 *
 * Usage:
 *   npm run dev:watch        (runs this via ts-node)
 *
 * Why ts-node? The client/ directory already uses TypeScript everywhere and
 * ts-node is available through the existing TypeScript dev dependency.
 */

import { watch } from 'fs';
import { exec, spawn, ChildProcess } from 'child_process';
import { resolve } from 'path';

const PKG_PATH = resolve(process.cwd(), 'package.json');

let devProcess: ChildProcess | null = null;
let isRestarting = false;
// Debounce multiple rapid saves (e.g. editors write twice on save)
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function startDevServer(): void {
    console.log('[Watcher] 🚀 Starting dev server (npm run dev)...');
    devProcess = spawn('npm', ['run', 'dev'], {
        stdio: 'inherit',
        shell: true,
        // Pass current env so Next.js picks up all .env variables
        env: process.env,
    });

    devProcess.on('close', (code) => {
        if (!isRestarting) {
            console.log(`[Watcher] Dev server exited (code ${code}).`);
        }
    });

    devProcess.on('error', (err) => {
        console.error('[Watcher] Dev server error:', err);
    });
}

function killDevServer(): Promise<void> {
    return new Promise((resolve) => {
        if (!devProcess || devProcess.exitCode !== null) {
            devProcess = null;
            resolve();
            return;
        }

        devProcess.once('close', () => {
            devProcess = null;
            resolve();
        });

        // SIGTERM first; if still alive after 3 s, SIGKILL
        devProcess.kill('SIGTERM');
        setTimeout(() => {
            if (devProcess && devProcess.exitCode === null) {
                console.warn('[Watcher] Dev server did not exit — sending SIGKILL');
                devProcess.kill('SIGKILL');
            }
        }, 3000);
    });
}

function runNpmInstall(): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log('[Watcher] 📦 Running npm install...');
        exec('npm install', { cwd: process.cwd() }, (err, stdout, stderr) => {
            if (stdout) process.stdout.write(stdout);
            if (stderr) process.stderr.write(stderr);
            if (err) {
                console.error('[Watcher] ❌ npm install failed:', err.message);
                reject(err);
            } else {
                console.log('[Watcher] ✅ npm install complete.');
                resolve();
            }
        });
    });
}

async function restartWithInstall(): Promise<void> {
    if (isRestarting) return;
    isRestarting = true;

    console.log('[Watcher] 🔄 package.json changed — reinstalling dependencies and restarting server...');

    try {
        await killDevServer();
        await runNpmInstall();
        startDevServer();
    } catch {
        console.error('[Watcher] Restart aborted due to install failure. Fix package.json and save again.');
    } finally {
        isRestarting = false;
    }
}

// ─── Watch package.json ───────────────────────────────────────────────────────
console.log(`[Watcher] 👀 Watching ${PKG_PATH}`);
watch(PKG_PATH, { persistent: true }, (eventType) => {
    if (eventType !== 'change') return;

    // Debounce: wait 500 ms for all editors to finish writing
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        restartWithInstall();
    }, 500);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(): Promise<void> {
    console.log('\n[Watcher] Shutting down...');
    await killDevServer();
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ─── Start ────────────────────────────────────────────────────────────────────
startDevServer();
