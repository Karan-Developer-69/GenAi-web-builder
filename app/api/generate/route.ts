import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/* ───────────────── JSON REPAIR ───────────────── */
function repairTruncatedJSON(raw: string): string {
  let json = raw.trim();

  // Remove markdown blocks
  if (json.startsWith('```')) {
    json = json.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
  }

  // Attempt to parse directly
  try {
    JSON.parse(json);
    return json;
  } catch { }

  // If it's intended to be an array or object
  const objects: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;

  for (let i = 0; i < json.length; i++) {
    const c = json[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (c === '{' || c === '[') {
      if (depth === 0) start = i;
      depth++;
    }
    if (c === '}' || c === ']') {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(json.slice(start, i + 1));
        start = -1;
      }
    }
  }

  if (objects.length > 0) {
    return objects[0]; // Return the first complete object/array found
  }

  throw new Error('No valid JSON structure found');
}

/* ─────────────── STRICT VALIDATION ─────────────── */
function validateFiles(files: { path: string; content: string }[]) {
  if (!Array.isArray(files)) throw new Error('Expected files array');

  const paths = files.map(f => f.path);
  const mustExist = ['index.html', 'package.json', 'src/App.tsx'];

  for (const req of mustExist) {
    if (!paths.includes(req)) {
      throw new Error(`Critical missing file: ${req}. The build system requires this to boot.`);
    }
  }
}

/* ───────────────── MAIN HANDLER ───────────────── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, mode = 'execute', plan, messages = [] } = body;

    // Support both direct prompt and chat messages
    const inputEmpty = !prompt?.trim() && messages.length === 0;
    if (inputEmpty) {
      return NextResponse.json({ error: 'Prompt or messages required' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY missing' }, { status: 500 });
    }

    const systemPromptPlan = `
You are Lysis AI v6.0 — a senior product designer + frontend architect.
TASK: Create a design system and project plan.

OUTPUT FORMAT (STRICT JSON):
{
  "theme": {
    "name": "string",
    "colors": { "primary": "#HEX", "background": "#HEX", "text": "#HEX" },
    "font": "string"
  },
  "tasks": [
    { "id": 1, "task": "Step Title", "description": "..." }
  ]
}
`;

    const systemPromptExecute = `
You are Lysis AI v6.0 — a senior frontend engineer.
Follow the DESIGN SYSTEM and PLAN provided.

PLAN & DESIGN:
${JSON.stringify(plan, null, 2)}

ABSOLUTE RULES:
- Tailwind CSS ONLY.
- Standard React (Vite/Lucide).
- You MUST return a JSON object with a "files" key containing the file array.
- MANDATORY FILES: index.html, package.json, src/App.tsx, src/main.tsx, src/styles/globals.css

OUTPUT FORMAT (STRICT JSON):
{
  "files": [
    { "path": "package.json", "content": "..." },
    { "path": "index.html", "content": "..." },
    { "path": "src/App.tsx", "content": "..." },
    ...
  ]
}
`;

    const currentSystemPrompt = mode === 'plan' ? systemPromptPlan : systemPromptExecute;
    const model = 'openai/gpt-oss-120b';

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 8000,
        stream: false,
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: currentSystemPrompt },
          ...messages,
          ...(prompt ? [{ role: 'user', content: prompt }] : []),
        ],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: errorText }, { status: res.status });
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content ?? '{}';
    const repaired = repairTruncatedJSON(rawContent);
    const parsed = JSON.parse(repaired);

    /* ───────────── RESPONSE ROUTING ───────────── */
    if (mode === 'plan') {
      return NextResponse.json({ tasks: parsed.tasks, theme: parsed.theme });
    }

    // Execution Mode
    const files = parsed.files || (Array.isArray(parsed) ? parsed : []);
    validateFiles(files);

    return NextResponse.json({ files });

  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json(
      { error: 'Generation failed', detail: err.message },
      { status: 500 }
    );
  }
}