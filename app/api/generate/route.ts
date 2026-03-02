import { groqCall } from '@/utils/ai';
import { NextRequest } from 'next/server';

// IMPORTANT: Do NOT use edge runtime — it cannot connect to localhost:8000
// export const runtime = 'edge';

/* ───────────────── SYSTEM PROMPTS ───────────────── */

/* ─── Framework Configs ─── */
const FRAMEWORK_CONFIGS: Record<string, { label: string; planRules: string; setupFiles: string; devCmd: string; }> = {
  react: {
    label: 'React (Vite)',
    planRules: 'Use Vite + React + Tailwind CSS. The 1st task MUST ONLY create: package.json (dev: vite, include @vitejs/plugin-react in devDependencies), index.html, vite.config.ts (use @vitejs/plugin-react), tsconfig.json, tailwind.config.js, postcss.config.js, src/main.tsx, src/index.css. DO NOT SKIP package.json.',
    setupFiles: 'package.json, index.html, vite.config.ts, tsconfig.json, tailwind.config.js, postcss.config.js, src/main.tsx, src/index.css',
    devCmd: '"dev": "vite"',
  },
  nextjs: {
    label: 'Next.js 14',
    planRules: 'Use Next.js 14.2.0 App Router + Tailwind CSS. The 1st task MUST ONLY create: package.json (next@14.2.0, dev: next dev), next.config.js, tailwind.config.js, postcss.config.js, app/layout.tsx, app/page.tsx, app/globals.css. STRICT: DO NOT use Turbopack (--turbo).',
    setupFiles: 'package.json, next.config.js, tailwind.config.js, postcss.config.js, app/layout.tsx, app/page.tsx, app/globals.css',
    devCmd: '"dev": "next dev"',
  },
  python: {
    label: 'Python (FastAPI)',
    planRules: 'Use Python FastAPI. The 1st task MUST ONLY create: requirements.txt (fastapi, uvicorn, jinja2), main.py (FastAPI app), templates/index.html (Jinja2), static/style.css, run.sh (uvicorn main:app --reload). DO NOT SKIP requirements.txt.',
    setupFiles: 'requirements.txt, main.py, templates/index.html, static/style.css, run.sh',
    devCmd: 'uvicorn main:app --reload',
  },
};

const buildSystemPromptPlan = (framework = 'react') => {
  const fw = FRAMEWORK_CONFIGS[framework] ?? FRAMEWORK_CONFIGS.react;
  return `Act as Lysis AI v7.0. Create a design system & plan for: ${fw.label}.
Rules:
- 1st Task: "Initial Project Setup" (${fw.setupFiles}).
- Max 4-5 focused tasks.
Format (XML tags):
<thinking>...</thinking>
<theme><name>..</name><primary>..</primary><background>..</background><text>..</text><font>..</font></theme>
<tasks><task id="1" description="..">Initial Project Setup</task>...</tasks>`;
};

const buildExecutePrompt = (plan: any, theme: any, currentTask: any, existingFilePaths: string[] = [], framework = 'react') => {
  const fw = FRAMEWORK_CONFIGS[framework] ?? FRAMEWORK_CONFIGS.react;
  const isSetupTask = currentTask.task === "Initial Project Setup";

  return `Act as Lysis AI v7.0. Execute Task: ${currentTask.task}.
Plan: ${JSON.stringify(plan)}
Theme: ${JSON.stringify(theme)}
Context: ${existingFilePaths.join(', ')}

Rules:
- ${isSetupTask ? `MANDATORY: Create ${fw.setupFiles}.` : 'Max 4-5 core files.'}
- ${framework === 'python' ? 'Python files ONLY. No Node stuff.' : 'Tailwind CSS ONLY. No raw CSS.'}
- NEVER import non-existent files.
- UI/UX QUALITY: Create visually stunning, highly polished interfaces. Use smooth buttery micro-animations (e.g., hover:scale-105, transition-all duration-300).
- ARCHITECTURE: Keep code strictly centralized and modular. Do NOT dump huge blobs of code. Break into reusable components.
- UX: Include functional navigation and structured routing out of the box so the app feels like a complete product.
- IMAGES: For any custom images (hero, products, etc.), use "https://ai-image.local/prompt?q=DETAILED_DESCRIPTION". 
  Example: <img src="https://ai-image.local/prompt?q=ultra+realistic+modern+office+laptop+coffee" />
Format:
<thinking>...</thinking>
<files><file path="path">content</file></files>`;
};
const buildFixPrompt = (plan: any, currentFiles: any[], framework = 'react') => {
  return `Act as Lysis AI v7.0. Targeted Error Fix Mode.
Context: The user has reported an error or requested a specific fix. 
Current Files: ${JSON.stringify(currentFiles.map(f => f.path))}

Rules:
1. ONLY modify the files necessary to fix the reported issue.
2. DO NOT regenerate the entire project.
3. Keep changes minimal and focused.
4. If a new file is absolutely required, you may create it, but prefer modifying existing ones.
5. maintain the same theme and framework: ${framework}.

Format:
<thinking>...</thinking>
<files><file path="path">content</file></files>`;
};

/* ───────────────── MAIN HANDLER ───────────────── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, mode = 'execute', plan, theme, currentTask, existingFiles, framework = 'react', selectedProvider, selectedModel } = body;

    // Map frontend mode to groqCall mode
    const groqMode: 'plan' | 'execute' | 'fix' = mode === 'plan' ? 'plan' : (mode === 'fix' ? 'fix' : 'execute');

    if (!prompt?.trim()) {
      return new Response(JSON.stringify({ error: 'Prompt required' }), { status: 400 });
    }

    // Collect existing file paths for context
    const existingFilePaths: string[] = Array.isArray(existingFiles)
      ? existingFiles.map((f: any) => typeof f === 'string' ? f : f.path).filter(Boolean)
      : [];

    // Choose system prompt
    let currentSystemPrompt = '';
    if (groqMode === 'plan') {
      currentSystemPrompt = buildSystemPromptPlan(framework);
    } else if (groqMode === 'fix') {
      currentSystemPrompt = buildFixPrompt(plan, existingFiles, framework);
    } else {
      currentSystemPrompt = buildExecutePrompt(plan, theme, currentTask, existingFilePaths, framework);
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          send('status', { message: '', stage: 'thinking' });

          const rawContent = await groqCall(
            prompt,
            selectedModel || "openai/gpt-oss-120b",
            currentSystemPrompt,
            groqMode,
            1,
            selectedProvider
          );

          // groqCall already parses JSON and returns the correct structure
          // For 'plan' mode: { tasks: [...], theme: {...} }
          // For 'execute' mode: files array
          const result = rawContent;

          send('done', { result });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          send('error', { error: 'Generation failed', detail: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'Generation failed', detail: message }), { status: 500 });
  }
}