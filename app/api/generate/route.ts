import { groqCall } from '@/utils/ai';
import { NextRequest } from 'next/server';
import { validateGeneratedFiles } from '@/utils/code-validator';

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

import type { Theme, Task } from '@/utils/validators';

const buildSystemPromptPlan = (framework = 'react') => {
  const fw = FRAMEWORK_CONFIGS[framework] ?? FRAMEWORK_CONFIGS.react;
  return `You are Lysis AI v7.1, a project planner for ${fw.label} websites.

YOUR ONLY JOB RIGHT NOW IS TO OUTPUT A STRUCTURED XML PLAN. DO NOT WRITE ANY CODE. DO NOT WRITE PROSE.

CRITICAL: You MUST respond using ONLY these XML tags — nothing else:

<thinking>
Brief reasoning about the project structure (2-3 sentences max).
</thinking>
<theme>
<name>Theme Name</name>
<primary>#hexcolor</primary>
<background>#hexcolor</background>
<text>#hexcolor</text>
<font>Font Name, fallback</font>
</theme>
<tasks>
<task id="1" description="Create all base project files">Initial Project Setup</task>
<task id="2" description="Build the main UI components">Core Components</task>
<task id="3" description="Add pages and routing">Pages & Navigation</task>
</tasks>

RULES:
- Task 1 MUST be called "Initial Project Setup" and cover: ${fw.setupFiles}
- Use 4-5 tasks maximum
- Each task title is SHORT (3-5 words)
- Each description is ONE sentence
- Colors must use a modern dark/vibrant palette that fits the user's request
- DO NOT write any code, markdown, or explanation outside of the XML tags above
- DO NOT use backticks, bullet points, or numbered lists
- Your ENTIRE response must start with <thinking> and end with </tasks>`;
};


const buildExecutePrompt = (
  plan: { tasks: Task[]; theme: Theme },
  theme: Theme,
  currentTask: Task,
  existingFilePaths: string[] = [],
  framework = 'react'
) => {
  const fw = FRAMEWORK_CONFIGS[framework] ?? FRAMEWORK_CONFIGS.react;
  const isSetupTask = currentTask.task === "Initial Project Setup";

  return `You are Lysis AI v7.1. Execute Task: ${currentTask.task}.
Plan: ${JSON.stringify(plan)}
Theme: ${JSON.stringify(theme)}
Context: ${existingFilePaths.join(', ')}

YOUR ONLY JOB RIGHT NOW IS TO OUTPUT STRUCTURED XML FILES. DO NOT WRITE ANY PROSE. DO NOT USE MARKDOWN CODE BLOCKS.

CRITICAL FORMAT REQUIREMENT:
You MUST respond using ONLY these exact XML tags — nothing else:

<thinking>
Brief reasoning about the implementation (1-2 sentences).
</thinking>
<files>
<file path="path/to/filename.ext">
// raw file content goes directly here, no markdown backticks
</file>
</files>

Rules:
- ${isSetupTask ? `MANDATORY: Create ${fw.setupFiles}.` : 'Max 4-5 core files.'}
- ${framework === 'python' ? 'PYTHON RULES: MUST use FastAPI and uvicorn. DO NOT use Flask or Django. Create a fully working API with Jinja2 templates. ALWAYS use this exact Tailwind script in HTML: <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>' : 'Tailwind CSS ONLY. No raw CSS.'}
- NEVER import non-existent files.
- UI/UX QUALITY: Create visually stunning, highly polished interfaces. Use smooth buttery micro-animations.
- IMAGES: For placeholders, use <img src="https://ai-image.local/prompt?q=DETAILED_DESCRIPTION" />
- DO NOT wrap file contents in \`\`\` language backticks. Write raw code directly inside the <file> tag.
- Your ENTIRE response must start with <thinking> and end with </files>`;
};
const buildFixPrompt = (
  currentFiles: unknown[],
  framework = 'react'
) => {
  const filePaths = currentFiles
    .map((f) => {
      if (typeof f === 'string') return f;
      if (typeof f === 'object' && f) {
        const obj = f as { path?: unknown };
        if (typeof obj.path === 'string') return obj.path;
      }
      return '';
    })
    .filter(Boolean);

  return `You are Lysis AI v7.1. Targeted Error Fix Mode.
Context: The user has reported an error or requested a specific fix. 
Current Files: ${JSON.stringify(filePaths)}

YOUR ONLY JOB RIGHT NOW IS TO OUTPUT STRUCTURED XML FILES. DO NOT WRITE ANY PROSE. DO NOT USE MARKDOWN CODE BLOCKS.

CRITICAL FORMAT REQUIREMENT:
You MUST respond using ONLY these exact XML tags — nothing else:

<thinking>
Brief reasoning about the fix (1-2 sentences).
</thinking>
<files>
<file path="path/to/filename.ext">
// complete raw file content goes directly here, no markdown backticks
</file>
</files>

Rules:
1. ONLY return the complete contents of the files being modified to fix the issue.
2. DO NOT use diffs or placeholder comments. Return the full, working file content.
3. DO NOT wrap file contents in \`\`\` language backticks. Write raw code directly inside the <file> tag.
4. Maintain the same theme. ${framework === 'python' ? 'PYTHON RULES: MUST use FastAPI and uvicorn. DO NOT use Flask or Django. ALWAYS use this exact Tailwind script in HTML: <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>' : 'Tailwind CSS ONLY. No raw CSS.'}
5. Your ENTIRE response must start with <thinking> and end with </files>`;
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
      ? existingFiles.map((f: unknown) => {
        if (typeof f === 'string') return f;
        if (typeof f === 'object' && f) {
          const obj = f as { path?: unknown };
          if (typeof obj.path === 'string') {
            return obj.path;
          }
        }
        return '';
      }).filter(Boolean)
      : [];

    // Choose system prompt
    let currentSystemPrompt = '';
    if (groqMode === 'plan') {
      currentSystemPrompt = buildSystemPromptPlan(framework);
    } else if (groqMode === 'fix') {
      currentSystemPrompt = buildFixPrompt(existingFiles, framework);
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

          // ── Dependency Safety Net ─────────────────────────────────────────
          // Enforces correct, real package versions for all known packages.
          // The AI frequently invents non-existent versions (e.g. lucide-react@^1.0.3).
          // This map is the ground truth — it OVERWRITES any hallucinated version.
          const KNOWN_GOOD_VERSIONS: Record<string, { section: 'dependencies' | 'devDependencies'; version: string }> = {
            // Vite ecosystem
            'vite': { section: 'devDependencies', version: '^5.4.0' },
            '@vitejs/plugin-react': { section: 'devDependencies', version: '^4.3.1' },
            '@vitejs/plugin-react-swc': { section: 'devDependencies', version: '^3.7.0' },
            // React
            'react': { section: 'dependencies', version: '^18.3.1' },
            'react-dom': { section: 'dependencies', version: '^18.3.1' },
            '@types/react': { section: 'devDependencies', version: '^18.3.3' },
            '@types/react-dom': { section: 'devDependencies', version: '^18.3.0' },
            // TypeScript
            'typescript': { section: 'devDependencies', version: '^5.5.3' },
            // Tailwind
            'tailwindcss': { section: 'devDependencies', version: '^3.4.1' },
            'autoprefixer': { section: 'devDependencies', version: '^10.4.19' },
            'postcss': { section: 'devDependencies', version: '^8.4.38' },
            // UI
            'lucide-react': { section: 'dependencies', version: '^0.395.0' },
            'framer-motion': { section: 'dependencies', version: '^11.3.8' },
            'react-icons': { section: 'dependencies', version: '^5.2.1' },
            'clsx': { section: 'dependencies', version: '^2.1.1' },
            'class-variance-authority': { section: 'dependencies', version: '^0.7.0' },
            'tailwind-merge': { section: 'dependencies', version: '^2.4.0' },
            // Routing
            'react-router-dom': { section: 'dependencies', version: '^6.26.0' },
            // Radix UI (commonly hallucinated with bad versions)
            '@radix-ui/react-dialog': { section: 'dependencies', version: '^1.1.1' },
            '@radix-ui/react-dropdown-menu': { section: 'dependencies', version: '^2.1.1' },
            '@radix-ui/react-slot': { section: 'dependencies', version: '^1.1.0' },
            // Animation
            'gsap': { section: 'dependencies', version: '^3.12.5' },
          };

          if ((groqMode === 'execute' || groqMode === 'fix') && Array.isArray(result)) {
            const files = result as { path: string; content: string }[];
            const pkgFile = files.find(f => f.path === 'package.json' || f.path.endsWith('/package.json'));
            if (pkgFile) {
              try {
                const pkg = JSON.parse(pkgFile.content) as {
                  dependencies?: Record<string, string>;
                  devDependencies?: Record<string, string>;
                };
                pkg.dependencies ??= {};
                pkg.devDependencies ??= {};

                const allContent = files.map(f => f.content).join('\n');
                const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

                // Step 1: Fix any already-declared packages with known-bad versions
                for (const [pkg_name, { section, version }] of Object.entries(KNOWN_GOOD_VERSIONS)) {
                  if (pkg_name in allDeps) {
                    // Package exists but may have a hallucinated version — overwrite with known-good
                    if (section === 'dependencies') {
                      pkg.dependencies[pkg_name] = version;
                    } else {
                      pkg.devDependencies[pkg_name] = version;
                    }
                  }
                }

                // Step 2: Inject missing packages that are actually used in the code
                const inject = (name: string) => {
                  const known = KNOWN_GOOD_VERSIONS[name];
                  if (!known) return;
                  const { section, version } = known;
                  if (!(name in pkg.dependencies!) && !(name in pkg.devDependencies!)) {
                    if (section === 'dependencies') pkg.dependencies![name] = version;
                    else pkg.devDependencies![name] = version;
                  }
                };

                // Vite
                if (allContent.includes('@vitejs/plugin-react') || files.some(f => f.path.includes('vite.config'))) {
                  inject('@vitejs/plugin-react'); inject('vite');
                }
                // Tailwind
                if (allContent.includes('tailwindcss') || files.some(f => f.path.includes('tailwind.config'))) {
                  inject('tailwindcss'); inject('autoprefixer'); inject('postcss');
                }
                // TypeScript
                if (files.some(f => /\.(tsx?|ts)$/.test(f.path) && !f.path.endsWith('.config.ts'))) {
                  inject('typescript'); inject('@types/react'); inject('@types/react-dom');
                }
                // React
                if (allContent.includes("from 'react'") || allContent.includes('from "react"')) {
                  inject('react'); inject('react-dom');
                }
                // Conditional library injection
                if (allContent.includes('framer-motion')) inject('framer-motion');
                if (allContent.includes('lucide-react')) inject('lucide-react');
                if (allContent.includes('react-router') || allContent.includes('react-router-dom')) inject('react-router-dom');
                if (allContent.includes('react-icons')) inject('react-icons');
                if (allContent.includes('clsx')) inject('clsx');
                if (allContent.includes('tailwind-merge')) inject('tailwind-merge');
                if (allContent.includes('gsap')) inject('gsap');

                pkgFile.content = JSON.stringify(pkg, null, 2);
                console.log('[Generate] Dependency safety net applied to package.json.');
              } catch {
                console.warn('[Generate] Could not patch package.json dependencies.');
              }
            }
          }
          // ── End Dependency Safety Net ─────────────────────────────────────

          // Run quality validator on generated files (execute/fix modes)
          let warnings: Record<string, string[]> = {};
          if ((groqMode === 'execute' || groqMode === 'fix') && Array.isArray(result)) {
            const filesWithContent = result
              .filter((f: unknown): f is { path: string; content: string } =>
                typeof f === 'object' && f !== null &&
                typeof (f as { path?: unknown }).path === 'string' &&
                typeof (f as { content?: unknown }).content === 'string'
              );
            warnings = validateGeneratedFiles(filesWithContent);
            if (Object.keys(warnings).length > 0) {
              console.warn('[Generate] Code quality warnings:', JSON.stringify(warnings, null, 2));
            }
          }

          send('done', { result, warnings });
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