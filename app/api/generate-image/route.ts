import { NextRequest, NextResponse } from 'next/server';

const AI_HORDE_URL = "https://stablehorde.net/api/v2";
const ANON_KEY = "0000000000";

export async function POST(req: NextRequest) {
    try {
        const { prompt, params } = await req.json();

        const response = await fetch(`${AI_HORDE_URL}/generate/async`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': ANON_KEY,
                'Client-Agent': 'CoderAi:1.0:IndieDev',
            },
            body: JSON.stringify({
                prompt,
                params,
                models: ["stable_diffusion"],
            }),
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (_err) {
        return NextResponse.json({ error: 'Failed to initiate generation' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    try {
        const response = await fetch(`${AI_HORDE_URL}/generate/status/${id}`, {
            headers: {
                'apikey': ANON_KEY,
                'Client-Agent': 'CoderAi:1.0:IndieDev',
            }
        });
        const data = await response.json();
        return NextResponse.json(data);
    } catch (_err) {
        return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
    }
}
