import { NextRequest } from 'next/server';
import { multiAI } from '@/utils/multi-ai';

export async function POST(req: NextRequest) {
    try {
        const { messages } = await req.json();
        const systemPrompt = `
You are Lysis AI v7.0 — a hyper-intelligent frontend architect.
Follow these rules for EVERY response:

1. THINK FIRST: Start your response with a <thinking> tag containing your internal reasoning, architectural decisions, and potential edge cases.
2. PLAN NEXT: Follow with a <plan> tag containing a serialized checklist of steps to accomplish the user's request. Format as:
   - [ ] Task 1
   - [ ] Task 2
3. EXECUTE: Finally, provide the main response content (code, explanation, etc.).

STRICT TAG FORMAT:
<thinking>
... your thoughts ...
</thinking>
<plan>
- [ ] Task ...
</plan>

Aesthetics: "Obsidian Synergy" / "Lysis Deep" (Dark, minimalist, blue-primary accents).
Technology: React, Next.js, Tailwind CSS, Lucide icons.
`;

        const res = await multiAI.chat([
            { role: 'system' as const, content: systemPrompt },
            ...messages,
        ], { stream: true });

        if (!res.ok) {
            const error = await res.json();
            return new Response(JSON.stringify(error), { status: res.status });
        }

        // Proxy the stream
        return new Response(res.body, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (err: unknown) {
        // Always log full error server-side for debugging
        console.error('Chat API Error:', err);
        const genericMsg = 'Internal server error';
        // Expose detailed message only in non-production for diagnostics
        const detail = process.env.NODE_ENV !== 'production'
            ? (err instanceof Error ? err.message : String(err))
            : genericMsg;
        return new Response(JSON.stringify({ error: genericMsg, detail }), { status: 500 });
    }
}
