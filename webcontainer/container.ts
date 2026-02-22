import { WebContainer, type FileSystemTree } from '@webcontainer/api';

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

/* ─── Zero-dependency static file server (no servor!) ─── */
const SERVER_JS = `
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = process.cwd();

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.jsx':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  let filePath = path.join(ROOT, urlPath);

  // Simple existence check
  if (!fs.existsSync(filePath)) {
    filePath = path.join(ROOT, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('Lysis Synergy Server ready at http://localhost:' + PORT);
});
`.trim();

/** Starter project files mounted into the container */
const starterFiles: FileSystemTree = {
    'index.html': {
        file: {
            contents: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lysis Synergy Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap');
    body { font-family: 'Outfit', sans-serif; background: #ffffff; color: #0f172a; }
  </style>
</head>
<body class="bg-slate-50 min-h-screen flex items-center justify-center">
  <div id="root" class="max-w-md w-full bg-white p-12 rounded-[2rem] border border-slate-200 shadow-2xl text-center">
    <div class="text-4xl mb-6">✦</div>
    <h1 class="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Synergy Ready.</h1>
    <p class="text-slate-500 leading-relaxed mb-8">
      Lysis v3.0 has initialized your environment. Describe your project in the AI chat to start generating components.
    </p>
    <div class="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-semibold border border-blue-100 uppercase tracking-widest">
      <span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
      Synergy v3.0
    </div>
  </div>
  <script type="module" src="App.jsx"></script>
</body>
</html>`,
        },
    },
    'App.jsx': {
        file: {
            contents: `// Your synergy starts here
console.log('Lysis Synergy Booted');`,
        },
    },
    'server.js': {
        file: { contents: SERVER_JS },
    },
    'package.json': {
        file: {
            contents: JSON.stringify(
                {
                    name: 'lysis-synergy-app',
                    version: '3.0.0',
                    private: true,
                    scripts: {
                        dev: 'node server.js',
                    },
                    dependencies: {
                        'express': '^4.18.2'
                    }
                },
                null,
                2
            ),
        },
    },
};

export function getStarterFiles() {
    return starterFiles;
}

/** Boot the WebContainer (only once) and mount starter files */
export async function bootWebContainer(): Promise<WebContainer> {
    const wc = await getContainerInstance();
    await wc.mount(starterFiles);
    return wc;
}

/** Purification utility for terminal logs */
export function cleanTerminalLog(data: string): string {
    if (!data) return '';

    return (
        data
            // Strictly remove all ANSI escape sequences
            .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
            // Remove carriage returns and other control chars
            .replace(/[\r\x08\x07\x00-\x09\x0B-\x1F\x7F]/g, '')
            // Collapse excessive newlines
            .replace(/\n{3,}/g, '\n\n')
    );
}

export async function getContainerInstance(): Promise<WebContainer> {
    if (webcontainerInstance) return webcontainerInstance;

    if (bootPromise) return bootPromise;

    bootPromise = (async () => {
        try {
            webcontainerInstance = await WebContainer.boot();
            return webcontainerInstance;
        } catch (err) {
            bootPromise = null;
            throw err;
        }
    })();

    return bootPromise;
}

export async function startDevServer(
    iframeEl: HTMLIFrameElement,
    onTerminalLog?: (data: string) => void,
    onUrlReady?: (url: string) => void
) {
    const wc = await getContainerInstance();

    const pkgContent = await wc.fs.readFile('package.json', 'utf-8').catch(() => '{}');
    const pkg = JSON.parse(pkgContent);
    const command = 'npm';
    const args = pkg.scripts?.dev ? ['run', 'dev'] : ['start'];

    onTerminalLog?.(`$ ${command} ${args.join(' ')}\n`);
    const devProcess = await wc.spawn(command, args);

    devProcess.output.pipeTo(
        new WritableStream({
            write(data) {
                const cleaned = cleanTerminalLog(data);
                if (cleaned) {
                    onTerminalLog?.(cleaned);
                }
            },
        })
    );

    wc.on('server-ready', (_port, url) => {
        console.log("Webcontainer ready",url,_port)
        iframeEl.src = url;
        onUrlReady?.(url);
        onTerminalLog?.(`\n✓ Server ready at ${url}\n`);
    });
}

/** Dynamic npm install cycle */
export async function runInstall(onTerminalLog?: (data: string) => void) {
    const wc = await getContainerInstance();
    onTerminalLog?.('✦ Synergy Orchestrating Dependencies...\n');

    const installProcess = await wc.spawn('npm', ['install']);

    installProcess.output.pipeTo(
        new WritableStream({
            write(data) {
                const cleaned = cleanTerminalLog(data);
                if (cleaned.toLowerCase().includes('err') || cleaned.toLowerCase().includes('warn')) {
                    onTerminalLog?.(cleaned);
                }
            },
        })
    );

    const exitCode = await installProcess.exit;
    onTerminalLog?.('✓ Dependencies Synchronized\n');
    return exitCode;
}

/** Check if project needs install based on package.json presence */
export async function needsInstall(): Promise<boolean> {
    const wc = await getContainerInstance();
    try {
        await wc.fs.readFile('package.json');
        return true; // We have a package.json, let's play it safe and install deps
    } catch {
        return false; // No package.json, probably a static project
    }
}

export async function writeContainerFile(path: string, contents: string) {
    const wc = await getContainerInstance();
    const parts = path.split('/');
    if (parts.length > 1) {
        let currentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
            currentPath += (currentPath ? '/' : '') + parts[i];
            try {
                await wc.fs.mkdir(currentPath);
            } catch (e) {
                // Ignore if directory already exists
            }
        }
    }
    await wc.fs.writeFile(path, contents);
}

export async function readContainerFile(path: string): Promise<string> {
    const wc = await getContainerInstance();
    // Smart Command Detection
    let command = 'npm';
    let args = ['run', 'dev'];
    return await wc.fs.readFile(path, 'utf-8');
}
