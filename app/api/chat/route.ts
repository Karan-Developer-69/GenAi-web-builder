import { NextRequest } from 'next/server';
import { multiAI } from '@/utils/multi-ai';

export async function POST(req: NextRequest) {
    try {
        const { messages } = await req.json();

        // NOTE: multiAI.chat() automatically injects CODE_GENERATION_SYSTEM_PROMPT
        // as the first system message, which already covers strict coding rules + UI requirements.
        // We only pass user/assistant messages here — no additional system message needed.
        const res = await multiAI.chat(
            // Filter to only user/assistant messages; the global system prompt handles the rest
            (messages as Array<{ role: string; content: string }>)
                .filter((m) => m.role !== 'system')
                .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            { stream: true }
        );

        if (!res.ok) {
            const error = await res.json();
            return new Response(JSON.stringify(error), { status: res.status });
        }

        // Pass the stream directly — do NOT buffer
        return new Response(res.body, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no', // Disable nginx buffering for real-time SSE
            },
        });

    } catch (err: unknown) {
        console.error('[Chat API] Error:', err);
        const genericMsg = 'Internal server error';
        const detail = process.env.NODE_ENV !== 'production'
            ? (err instanceof Error ? err.message : String(err))
            : genericMsg;
        return new Response(JSON.stringify({ error: genericMsg, detail }), { status: 500 });
    }
}
