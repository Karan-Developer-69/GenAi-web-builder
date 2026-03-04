import { repairTruncatedJSON, validateFiles, normalizeFiles, parsePlanFromTags, parseFilesFromTags, parseFilesFromMarkdown } from "./validators";
import { multiAI } from "./multi-ai";

/**
 * Call the local AI server (streaming SSE).
 * Accumulates all tokens → returns raw text for the frontend to parse tags.
 */
export const aiCall = async (
    prompt: string,
    currentSystemPrompt = '',
    onChunk?: (text: string) => void,
    provider?: string,
    model?: string,
): Promise<string> => {
    const res = await multiAI.chat([
        { role: 'system' as const, content: currentSystemPrompt },
        ...(prompt ? [{ role: 'user' as const, content: prompt }] : []),
    ], { stream: true, provider, model });

    if (!res.ok || !res.body) {
        const errorText = await res.text();
        throw new Error(errorText);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const jsonStr = trimmed.slice(6);
            try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.done) {
                    const content = parsed.choices?.[0]?.message?.content ?? accumulated;
                    return content;
                }
                if (parsed.token) {
                    accumulated += parsed.token;
                    if (onChunk) onChunk(accumulated);
                }
            } catch {
                // ignore malformed chunk
            }
        }
    }

    return accumulated;
};

/**
 * Call Groq API (non-streaming).
 * Now supports XML-like tags primarily, with JSON repair fallback.
 */
export const groqCall = async (
    prompt: string,
    model = "openai/gpt-oss-120b",
    currentSystemPrompt = '',
    mode: 'plan' | 'execute' | 'fix' = 'plan',
    retries = 1,
    provider?: string,
): Promise<{ tasks: import('./validators').Task[]; theme: import('./validators').Theme } | { path: string; content: string }[]> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await multiAI.chat([
                { role: 'system' as const, content: currentSystemPrompt },
                ...(prompt ? [{ role: 'user' as const, content: prompt }] : []),
            ], { stream: false, provider, model });

            const data = await res.json();
            const rawContent = data.choices[0]?.message?.content || '';

            if (mode === 'plan') {
                // Stage 1: Tag-based parsing (primary path — format enforced by system prompt)
                const plan = parsePlanFromTags(rawContent);
                if (plan.tasks.length > 0) return plan;

                // Stage 2: JSON repair fallback (for providers that ignore tag instructions)
                try {
                    const repaired = repairTruncatedJSON(rawContent);
                    const parsed = JSON.parse(repaired);
                    if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
                        return {
                            tasks: parsed.tasks,
                            theme: parsed.theme || plan.theme,
                        };
                    }
                } catch {
                    // JSON repair failed — continue to next fallback
                }

                // Stage 3: Plain-text numbered list extraction
                // e.g. "1. Initial Project Setup\n2. Build UI Components\n..."
                const numberedLines = rawContent
                    .split('\n')
                    .map((l: string) => l.trim())
                    .filter((l: string) => /^\d+[\.\)]\s+\S/.test(l));

                if (numberedLines.length > 0) {
                    return {
                        theme: plan.theme,
                        tasks: numberedLines.map((line: string, idx: number) => ({
                            id: idx + 1,
                            task: line.replace(/^\d+[\.\)]\s+/, '').trim(),
                            description: '',
                        })),
                    };
                }

                // Stage 4: Synthetic fallback — model returned prose/code instead of a plan.
                // We generate a sensible default plan from the raw content rather than failing entirely.
                // This guarantees the user always sees progress even when the AI misbehaves.
                console.warn('[groqCall] Plan parsing exhausted all strategies — synthesizing default plan. Raw snippet:', rawContent.slice(0, 200));
                return {
                    theme: {
                        name: 'Custom Theme',
                        colors: { primary: '#6366f1', background: '#0f0f14', text: '#f4f4f5' },
                        font: 'Inter, sans-serif',
                    },
                    tasks: [
                        { id: 1, task: 'Initial Project Setup', description: 'Create all base project files and configuration.' },
                        { id: 2, task: 'Core UI Components', description: 'Build the main reusable UI components.' },
                        { id: 3, task: 'Pages & Layout', description: 'Assemble pages with navigation and responsive layout.' },
                        { id: 4, task: 'Interactivity & Polish', description: 'Add animations, interactions, and final styling.' },
                    ],
                };
            }

            // Execute mode: try tag-based file extraction first
            const files = parseFilesFromTags(rawContent);
            if (files.length > 0) {
                validateFiles(files);
                return files;
            }

            // Fallback 2: JSON extraction
            try {
                const repaired = repairTruncatedJSON(rawContent);
                const parsed = JSON.parse(repaired);
                const rawFiles = parsed.files || (Array.isArray(parsed) ? parsed : []);
                if (rawFiles && rawFiles.length > 0) {
                    const normalized = normalizeFiles(rawFiles);
                    if (normalized.length > 0) {
                        validateFiles(normalized);
                        return normalized;
                    }
                }
            } catch {
                // Ignore JSON parse errors and continue to markdown fallback
            }

            // Fallback 3: Markdown Code Blocks extraction
            // Looks for bolded filenames followed by code blocks
            const mdFiles = parseFilesFromMarkdown(rawContent);
            if (mdFiles.length > 0) {
                validateFiles(mdFiles);
                return mdFiles;
            }

            // Fallback 4: Desperation single-block extraction
            // If the model wrote EXACTLY ONE code block but no filename, we salvage it as App.tsx
            const singleBlockRegex = /```(?:[a-zA-Z]*)\n([\s\S]*?)\n```/;
            const singleMatch = singleBlockRegex.exec(rawContent);
            if (singleMatch) {
                console.warn('[groqCall] Extremely degraded output. Salvaging a single code block.');
                const ext = rawContent.includes('export default') || rawContent.includes('import React') ? 'tsx' : 'ts';
                const filename = `src/GeneratedComponent.${ext}`;
                const syntheticFiles = [{ path: filename, content: singleMatch[1].trim() }];
                validateFiles(syntheticFiles);
                return syntheticFiles;
            }

            throw new Error(`[groqCall] execute mode failed to parse any files. Raw preview: ${rawContent.slice(0, 150)}`);
        } catch (err) {
            if (attempt < retries) {
                console.warn(`[groqCall] Attempt ${attempt + 1} failed, retrying...`, err);
                continue;
            }
            throw err;
        }
    }
    // Unreachable — loop always throws on final attempt, but TS requires explicit terminal statement.
    throw new Error("[groqCall] Exhausted all retries.");
};