import fs from 'fs';
import path from 'path';

export interface AIResponse {
    content: string;
    provider: string;
    model: string;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

const STATE_FILE = path.join(process.cwd(), 'lib/ai/state.json');

// ─── Provider Registry ────────────────────────────────────────────────────────
const PROVIDERS = [
    {
        id: 'groq',
        name: 'Groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        getApiKey: () => process.env.GROQ_API_KEY,
        model: 'llama-3.3-70b-versatile', // Fast, reliable, 128K ctx
    },
    {
        id: 'cerebras',
        name: 'Cerebras',
        baseUrl: 'https://api.cerebras.ai/v1',
        getApiKey: () => process.env.CEREBRAS_API_KEY,
        model: 'zai-glm-4.6', // ~1000 tok/s, #1 BFCL tool-calling, comparable to Sonnet 4.5
    },
    {
        id: 'gemini',
        name: 'Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        getApiKey: () => process.env.GEMINI_API_KEY,
        model: 'gemini-2.5-flash', // Stable GA, 1M ctx, fast & excellent at code
    },
    {
        id: 'mistral',
        name: 'Mistral',
        baseUrl: 'https://api.mistral.ai/v1',
        getApiKey: () => process.env.MISTRAL_API_KEY,
        model: 'codestral-latest', // Codestral 25.08 — purpose-built for code, 256K ctx
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        getApiKey: () => process.env.OPENROUTER_API_KEY,
        model: 'qwen/qwen3-coder-480b-a35b-instruct:free', // Best free coding model, 262K ctx
    },
    {
        id: 'github',
        name: 'GitHub',
        baseUrl: 'https://models.inference.ai.azure.com',
        getApiKey: () => process.env.GITHUB_AI_API_KEY,
        model: 'gpt-4o', // Valid GitHub Models endpoint (no openai/ prefix)
    },
    {
        id: 'ollama',
        name: 'Ollama',
        baseUrl: 'http://localhost:11434/v1',
        getApiKey: () => 'ollama',
        model: 'qwen2.5-coder:7b', // Far superior to llama3 for code generation
    }
];

// ─── Code Generation System Prompt ───────────────────────────────────────────
/**
 * Injected as the first system message in every chat() call.
 * Prevents hallucinated imports, non-existent packages, and incomplete code.
 */
const CODE_GENERATION_SYSTEM_PROMPT = `You are an expert full-stack developer and Lysis AI v7.1 — building production-ready websites in React, Next.js, and Python.

STRICT RULES — YOU MUST FOLLOW ALL OF THESE:

1. IMPORTS: Every import must be for a package that actually exists on npm or PyPI. Never import from a path or package unless you also define or install it. Always include ALL necessary import statements at the top of every file.

2. DEPENDENCIES: Only use packages that exist and are widely used. Before using any library, verify it is real. Do NOT hallucinate package names. If you need a UI library, use: shadcn/ui, lucide-react, tailwindcss, radix-ui, or react-icons — all of which are real and widely available.

3. FILES & COMPONENTS: Never reference a component, file, or module that you have not also defined or explicitly told the user to create. Every import path must correspond to a file that exists.

4. PACKAGE.JSON: If you modify package.json, you MUST list the exact, real package name and a valid semver version. Do not invent package names or versions.

5. NEXT.JS CONVENTIONS: Use the App Router (app/ directory) by default. Use 'use client' only when necessary. Server components do not use useState or event handlers.

6. CODE COMPLETENESS: Every function, component, and class must be fully implemented. No placeholder comments like "// TODO" or "// implement this". No incomplete code blocks.

7. NO HALLUCINATION: If you are uncertain about an API, package, or method — do not guess. Use only what you know to be correct.

## YOUR DESIGN PHILOSOPHY
Before writing any code, think like a creative director:
1. CONTEXT FIRST: What is this page/component for? Who uses it? What emotion should it evoke?
2. PICK A BOLD AESTHETIC: Choose ONE clear direction and commit fully. Options include:
   - Luxury & refined (tight spacing, gold accents, editorial typography)
   - Dark & futuristic (deep blacks, neon glows, glassmorphism)
   - Organic & warm (earthy tones, rounded forms, handcrafted feel)
   - Brutalist & raw (stark contrast, oversized type, intentional roughness)
   - Playful & energetic (bold colors, bouncy animations, expressive type)
   - Magazine/editorial (asymmetric grids, strong hierarchy, photo-forward)
   - Retro-futuristic (CRT textures, phosphor greens, scanline effects)
3. ONE UNFORGETTABLE DETAIL: Every design must have ONE thing people remember — a hover effect, a color moment, a layout surprise, a micro-animation.

## TECHNICAL REQUIREMENTS

### Typography
- NEVER use Inter, Roboto, Arial, or system fonts
- Import from Google Fonts — pick fonts with CHARACTER (e.g., Playfair Display, Syne, DM Serif Display, Space Mono, Unbounded, Clash Display, Cabinet Grotesk)
- Pair a display/heading font with a refined body font
- Use font-size scale with intention: massive hero text, clear hierarchy

### Color & Theme
- Commit to a palette: 1-2 dominant colors + 1 sharp accent
- NEVER default to purple gradients on white — be unexpected
- Dark themes or light themes both work — but NEVER neutral gray soup

### Layout & Composition
- Break the grid intentionally — overlapping elements, diagonal cuts, asymmetry
- Use generous whitespace OR controlled density — never mediocre middle ground
- Hero sections must have VISUAL WEIGHT — not just centered text on a gradient
- Mobile responsive by default

### Animation & Motion
- MUST use Framer Motion or GSAP for all animations. Static layouts are strictly forbidden.
- Page load: staggered reveals with animation-delay (fade+slide or scale)
- Hover states: transform, color shift, underline animations
- At least ONE scroll-triggered or interaction effect

### Backgrounds & Atmosphere
- NEVER plain solid color backgrounds on important sections
- Use: gradient meshes, subtle noise textures, geometric SVG patterns, radial glows, layered pseudo-elements
- Create DEPTH — shadows, z-index layering, blur effects

## WHAT TO NEVER DO
❌ Generic card grid with drop shadows and blue buttons
❌ Hero: centered H1 + subtext + CTA button on white/gray bg
❌ Navbar: Logo left, links right, hamburger — with no personality
❌ Footer: 4 columns of links on dark gray — lifeless
❌ Purple-to-pink gradients as "modern design"
❌ Inter or Roboto as the font
❌ Placeholder lorem ipsum with no visual hierarchy
❌ Same layout pattern repeated across sections


8. DEPENDENCY COMPLETENESS: Every package you import or use in ANY file MUST be listed in package.json.\n   For Vite+React projects:\n   - In vite.config.ts: always import from '@vitejs/plugin-react' → it MUST be in devDependencies\n   - NEVER write a vite.config.ts that is NOT accompanied by a package.json that includes @vitejs/plugin-react\n   - tailwindcss, postcss, autoprefixer must be in devDependencies if used\n   - framer-motion, lucide-react etc. must be in dependencies if imported\n\nYou will be placing your file output inside <files><file path="...">...</file></files> XML tags.\nDO NOT wrap file contents in markdown backticks inside these tags. Write raw code directly.`;

// ─── MultiAI Class ────────────────────────────────────────────────────────────
class MultiAI {
    private activeProviderId: string = 'groq';

    constructor() {
        this.loadState();
    }

    private loadState() {
        try {
            if (fs.existsSync(STATE_FILE)) {
                const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
                if (data.activeProviderId && PROVIDERS.some(p => p.id === data.activeProviderId)) {
                    this.activeProviderId = data.activeProviderId;
                    console.log(`[MultiAI] Loaded active provider: ${this.activeProviderId}`);
                }
            }
        } catch (err) {
            console.warn('[MultiAI] Failed to load state:', err);
        }
    }

    private saveState(providerId: string) {
        try {
            const dir = path.dirname(STATE_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(STATE_FILE, JSON.stringify({ activeProviderId: providerId }), 'utf-8');
            this.activeProviderId = providerId;
        } catch (err) {
            console.warn('[MultiAI] Failed to save state:', err);
        }
    }

    async chat(messages: ChatMessage[], options: { stream?: boolean; provider?: string; model?: string } = {}): Promise<Response> {
        // Merge the global CODE_GENERATION_SYSTEM_PROMPT with any caller-provided system message.
        // Strategy:
        //   - If the caller already has a system message → append our rules to it (caller context wins, our rules reinforce).
        //   - If no system message is provided → inject CODE_GENERATION_SYSTEM_PROMPT as the sole system message.
        // This prevents the critical bug where stripping caller system messages would cause plan/execute/fix 
        // prompts to be lost, making the model ignore output format instructions entirely.

        const callerSystem = messages.find(m => m.role === 'system');
        const nonSystemMessages = messages.filter(m => m.role !== 'system');

        const mergedSystemContent = callerSystem
            ? `${callerSystem.content}\n\n---\n\n${CODE_GENERATION_SYSTEM_PROMPT}`
            : CODE_GENERATION_SYSTEM_PROMPT;

        const messagesWithSystem: ChatMessage[] = [
            { role: 'system', content: mergedSystemContent },
            ...nonSystemMessages,
        ];

        type ProviderEntry = typeof PROVIDERS[number] & { apiKey?: string };
        let rotation: ProviderEntry[] = [];

        if (options.provider) {
            // Manual provider selection — respect model override if provided
            const manual = PROVIDERS.find(p => p.id === options.provider);
            if (manual) {
                rotation = [{ ...manual, model: options.model || manual.model, apiKey: manual.getApiKey() }];
            }
        }

        if (rotation.length === 0) {
            // Build available provider list, then randomise starting point for load balancing
            const available = PROVIDERS.map(p => ({ ...p, apiKey: p.getApiKey() })).filter(p => !!p.apiKey);

            if (available.length === 0) {
                throw new Error('[MultiAI] No AI providers are configured. Please set at least one API key in your .env file.');
            }

            const randomIndex = Math.floor(Math.random() * available.length);
            rotation = [
                ...available.slice(randomIndex),
                ...available.slice(0, randomIndex),
            ];
        }

        for (const provider of rotation) {
            try {
                const effectiveModel = options.model || provider.model;
                console.log(`[MultiAI] Attempting ${provider.name} (${effectiveModel})...`);

                const res = await fetch(`${provider.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${provider.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: effectiveModel,
                        messages: messagesWithSystem,
                        stream: options.stream ?? false,
                        temperature: 0.3,
                        max_tokens: 16384,
                    }),
                });

                if (res.ok) {
                    if (!options.provider) this.saveState(provider.id);
                    return res;
                }

                const error = await res.text();
                console.warn(`[MultiAI] ${provider.name} failed (HTTP ${res.status}):`, error);
            } catch (err) {
                console.error(`[MultiAI] ${provider.name} network error:`, err);
            }
        }

        throw new Error('[MultiAI] All AI providers failed. Check API keys and network connectivity.');
    }
}

export const multiAI = new MultiAI();
