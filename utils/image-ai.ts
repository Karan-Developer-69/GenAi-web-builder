/**
 * AI Horde Image Generation Utility
 * Uses the community-powered AI Horde API with a shared anonymous key.
 */

const AI_HORDE_URL = "https://stablehorde.net/api/v2";
const ANON_KEY = "0000000000";

export async function generateImage(prompt: string): Promise<string> {
    try {
        // 1. Initiate async generation
        const genRes = await fetch("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt,
                params: {
                    steps: 20,
                    n: 1,
                    sampler_name: "k_euler",
                    width: 512,
                    height: 512,
                    cfg_scale: 7.5,
                }
            })
        });

        if (!genRes.ok) throw new Error("Failed to initiate image generation");
        const { id } = await genRes.json();

        // 2. Poll for status
        let attempts = 0;
        const maxAttempts = 30; // 30 * 2s = 60s max wait

        while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000));
            attempts++;

            const statusRes = await fetch(`/api/generate-image?id=${id}`);
            if (!statusRes.ok) continue;

            const status = await statusRes.json();

            if (status.done && status.generations?.[0]?.img) {
                // Returns the image URL (base64 or direct link depending on provider, usually URL)
                return status.generations[0].img;
            }

            if (status.faulted) {
                throw new Error("AI Horde generation faulted");
            }
        }

        throw new Error("Image generation timed out");
    } catch (err) {
        console.error("[image-ai] Error:", err);
        return `https://placehold.co/600x400?text=Image+Generation+Failed`;
    }
}
