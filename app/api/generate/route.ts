import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/* ───────────────── JSON REPAIR ───────────────── */
function repairTruncatedJSON(raw: string): string {
  let json = raw.trim();

  if (json.startsWith('```')) {
    json = json.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
  }

  try {
    JSON.parse(json);
    return json;
  } catch {}

  const objects: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;

  for (let i = 0; i < json.length; i++) {
    const c = json[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (c === '\\' && inString) {
      escape = true;
      continue;
    }

    if (c === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (c === '{') {
      if (depth === 1) start = i;
      depth++;
    }

    if (c === '}') {
      depth--;
      if (depth === 1 && start !== -1) {
        objects.push(json.slice(start, i + 1));
        start = -1;
      }
    }
  }

  if (!objects.length) throw new Error('No valid JSON objects found');
  return `[${objects.join(',')}]`;
}

/* ─────────────── STRICT VALIDATION ─────────────── */
function validateFiles(files: { path: string; content: string }[]) {
  const paths = files.map(f => f.path);

  const mustExist = [
    'index.html',
    'package.json',
    'src/main.tsx',
    'src/App.tsx',
    'src/styles/globals.css',
  ];

  for (const req of mustExist) {
    if (!paths.includes(req)) {
      throw new Error(`Missing required file: ${req}`);
    }
  }

  for (const p of paths) {
    if (p.startsWith('styles/')) {
      throw new Error(`Illegal root styles folder: ${p}`);
    }
    if (p === 'main.tsx') {
      throw new Error(`main.tsx must be inside src/`);
    }
  }
}

/* ───────────────── MAIN HANDLER ───────────────── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = body.prompt;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt empty' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY missing' }, { status: 500 });
    }

    const systemPrompt = `
You are Lysis AI v5.0 — a deterministic Vite + React project generator.

RULES (ABSOLUTE):
- Tailwind CSS ONLY
- globals.css ONLY at src/styles/globals.css
- NO CSS elsewhere
- main.tsx ONLY at src/main.tsx
- index.html MUST load /src/main.tsx
- NEVER guess paths
- NEVER output markdown

OUTPUT:
Return ONLY JSON array:
[{ "path": "string", "content": "string" }]

If any rule breaks → regenerate internally.
Last character MUST be ]
`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        temperature: 0.3,
        max_tokens: 6000,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: await res.text() }, { status: res.status });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '';

    const repaired = repairTruncatedJSON(raw);
    const files = JSON.parse(repaired);

    validateFiles(files);

    return NextResponse.json({ files });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'Generation failed',
        detail: err.message,
      },
      { status: 500 }
    );
  }
}