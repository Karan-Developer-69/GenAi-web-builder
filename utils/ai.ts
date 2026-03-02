import { repairTruncatedJSON, validateFiles, normalizeFiles, parsePlanFromTags, parseFilesFromTags } from "./validators";
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
): Promise<any> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await multiAI.chat([
                { role: 'system' as const, content: currentSystemPrompt },
                ...(prompt ? [{ role: 'user' as const, content: prompt }] : []),
            ], { stream: false, provider, model });

            const data = await res.json();
            const rawContent = data.choices[0]?.message?.content || '';

            if (mode === 'plan') {
                // Try tag-based parsing first
                const plan = parsePlanFromTags(rawContent);
                if (plan.tasks.length > 0) return plan;

                // Fallback to JSON repair
                const repaired = repairTruncatedJSON(rawContent);
                const parsed = JSON.parse(repaired);
                return {
                    tasks: parsed.tasks || [],
                    theme: parsed.theme || ''
                };
            }

            // Execute mode: try tag-based file extraction first
            const files = parseFilesFromTags(rawContent);
            if (files.length > 0) {
                validateFiles(files);
                return files;
            }

            // Fallback to JSON extraction
            const repaired = repairTruncatedJSON(rawContent);
            const parsed = JSON.parse(repaired);
            const rawFiles = parsed.files || (Array.isArray(parsed) ? parsed : []);
            const normalized = normalizeFiles(rawFiles);
            validateFiles(normalized);

            return normalized;
        } catch (err) {
            if (attempt < retries) {
                console.warn(`[groqCall] Attempt ${attempt + 1} failed, retrying...`, err);
                continue;
            }
            throw err;
        }
    }
};