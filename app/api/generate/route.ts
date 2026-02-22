import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// ─── Robust JSON Repair ───────────────────────────────────────────────────────
// Extracts all COMPLETE { path, content } objects from a potentially
// truncated JSON array using a character-level state machine.
function repairTruncatedJSON(raw: string): string {
  let json = raw.trim();

  if (json.startsWith('```json')) json = json.replace(/^```json/, '').replace(/```$/, '').trim();
  else if (json.startsWith('```')) json = json.replace(/^```/, '').replace(/```$/, '').trim();

  try { JSON.parse(json); return json; } catch (_) {}

  const completeObjects: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let objectStart = -1;

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '[' && depth === 0) {
      depth = 1;
    } else if (ch === '{') {
      if (depth === 1) objectStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 1 && objectStart !== -1) {
        completeObjects.push(json.slice(objectStart, i + 1));
        objectStart = -1;
      }
    }
  }

  if (completeObjects.length === 0) {
    throw new Error('No complete JSON objects could be extracted');
  }

  return '[' + completeObjects.join(',') + ']';
}

// ─── Path Correction ──────────────────────────────────────────────────────────
// AI sometimes places files at wrong paths despite instructions.
// This corrects known misplacements for Vite + React projects.
interface FileEntry { path: string; content: string; }

function correctFilePaths(files: FileEntry[]): FileEntry[] {
  return files.map(file => {
    let { path, content } = file;

    // Root-level config files mistakenly placed inside src/
    const rootFiles = [
      'package.json', 'vite.config.ts', 'vite.config.js',
      'tsconfig.json', 'tsconfig.node.json',
      'tailwind.config.ts', 'tailwind.config.js',
      'postcss.config.cjs', 'postcss.config.js',
      'index.html', 'README.md', '.env.example', '.gitignore',
    ];
    for (const rootFile of rootFiles) {
      if (path === `src/${rootFile}`) {
        path = rootFile;
        break;
      }
    }

    // src/main.tsx or src/App.tsx placed at root (no folder)
    if (path === 'main.tsx' || path === 'main.jsx') path = `src/${path}`;
    if (path === 'App.tsx' || path === 'App.jsx') path = `src/${path}`;

    // Component/page files placed directly in src/ instead of subfolders
    // e.g. src/Navbar.tsx → src/components/Navbar.tsx
    // (only apply if it's clearly a component, not main/App/styles)
    const srcRootMatch = path.match(/^src\/([A-Z][^/]+\.(tsx|jsx))$/);
    if (srcRootMatch) {
      const filename = srcRootMatch[1];
      // Don't move App.tsx or files that already have correct placement
      if (filename !== 'App.tsx' && filename !== 'App.jsx') {
        path = `src/components/${filename}`;
      }
    }

    // Fix index.html script src if it points to wrong path
    if (path === 'index.html') {
      // Ensure script always points to /src/main.tsx (or .jsx)
      content = content
        .replace(/src="\/main\.(tsx|jsx)"/, 'src="/src/main.$1"')
        .replace(/src="main\.(tsx|jsx)"/, 'src="/src/main.$1"');
    }

    return { path, content };
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let prompt: string;
    if (body.prompt) {
      prompt = body.prompt;
    } else if (body.messages && Array.isArray(body.messages)) {
      const lastUserMsg = [...body.messages]
        .reverse()
        .find((m: { role: string; content: string }) => m.role === 'user');
      if (!lastUserMsg) {
        return NextResponse.json({ error: 'No user message found in messages array' }, { status: 400 });
      }
      prompt = lastUserMsg.content;
    } else {
      return NextResponse.json(
        { error: 'Request body must contain either "prompt" string or "messages" array' },
        { status: 400 }
      );
    }

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt cannot be empty' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    const systemPrompt = `You are Lysis AI v4.0 — an elite, world-class full-stack software architect and engineer.

Your mission: Given a user prompt, generate a COMPLETE, MODULAR, PRODUCTION-READY project.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — STRICT
═══════════════════════════════════════════════════════════════
Return a raw JSON array of objects:
[{ "path": "string", "content": "string" }, ...]

CRITICAL: Complete the entire array. Last character MUST be ].
Never truncate mid-file. If near token limit, close current file and end array.

═══════════════════════════════════════════════════════════════
TECHNOLOGY STACK
═══════════════════════════════════════════════════════════════
- React + Vite  → Vite 5, React 18, TypeScript, Tailwind via PostCSS

═══════════════════════════════════════════════════════════════
FILE PLACEMENT — MEMORIZE THIS, NO EXCEPTIONS
═══════════════════════════════════════════════════════════════
For React + Vite projects the structure is EXACTLY:

  package.json          ← ROOT (no folder)
  vite.config.ts        ← ROOT
  tsconfig.json         ← ROOT
  tailwind.config.ts    ← ROOT (if Tailwind used)
  postcss.config.cjs    ← ROOT (if Tailwind used)
  index.html            ← ROOT — script MUST point to "/main.tsx"
  README.md             ← ROOT

  /main.tsx          ← ALWAYS "/main.tsx", NEVER "/src/main.tsx" at root
  /App.tsx           ← ALWAYS "/App.tsx", NEVER "/src/App.tsx" at root
  src/styles/globals.css

  src/components/       ← All reusable UI components
  src/pages/            ← Route-level views
  src/hooks/            ← Custom React hooks
  src/utils/            ← Helper functions  

WRONG ❌               CORRECT ✅
"src/main.tsx"             "main.tsx"
"src/App.tsx"              "App.tsx"
"src/index.html"       "index.html"
"src/package.json"     "package.json"
"src/Navbar.tsx"       "src/components/Navbar.tsx"

index.html script tag:
  ✅ <script type="module" src="/src/main.tsx"></script>
  ❌ <script type="module" src="/main.tsx"></script>

═══════════════════════════════════════════════════════════════
DESIGN SYSTEM: "Obsidian Synergy"
═══════════════════════════════════════════════════════════════
Fonts: "Plus Jakarta Sans" or "DM Sans" via Google Fonts
Effects: Glassmorphism (bg-white/60 backdrop-blur-xl), Framer Motion
Cards: rounded-2xl shadow-sm border border-slate-200
Buttons: rounded-xl px-6 py-3 hover:scale-105 transition
Inputs: rounded-xl border focus:ring-2 focus:ring-blue-500
Nav: sticky top-0 backdrop-blur border-b

═══════════════════════════════════════════════════════════════
CODE QUALITY
═══════════════════════════════════════════════════════════════
- TypeScript strict mode
- Named + default exports on every component
- Accessible HTML: aria-labels, semantic tags
- Mobile-first Tailwind breakpoints
- Response MUST start with '[' and end with ']'`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 8192,
        stream: true,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return NextResponse.json(
        { error: `Groq API error: ${errText}` },
        { status: groqRes.status }
      );
    }

    const reader = groqRes.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: 'No response stream from Groq' }, { status: 500 });
    }

    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });

      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break;
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) fullContent += delta;
        } catch {
          // Partial SSE frame — skip
        }
      }
    }

    try {
      const repairedJson = repairTruncatedJSON(fullContent);
      const rawFiles: FileEntry[] = JSON.parse(repairedJson);

      // ── Post-process: fix any path misplacements ──────────────────────────
      const files = correctFilePaths(rawFiles);
      const wasRepaired = repairedJson !== fullContent.trim();
      const pathsFixed = files.some((f, i) => f.path !== rawFiles[i]?.path);

      return NextResponse.json({
        files,
        ...(wasRepaired && {
          warning: `Response truncated — ${files.length} complete files recovered`,
        }),
        ...(pathsFixed && {
          info: 'Some file paths were automatically corrected',
        }),
      });
    } catch (parseErr) {
      return NextResponse.json(
        {
          error: 'Failed to generate valid project structure',
          detail: parseErr instanceof Error ? parseErr.message : 'Unknown parse error',
          raw: fullContent.slice(0, 800) + (fullContent.length > 800 ? '…[truncated]' : ''),
        },
        { status: 500 }
      );
    }
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}