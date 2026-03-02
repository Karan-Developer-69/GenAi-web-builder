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

const PROVIDERS = [
    {
        id: 'groq',
        name: 'Groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        getApiKey: () => process.env.GROQ_API_KEY,
        model: 'llama-3.3-70b-versatile',
    },
    {
        id: 'cerebras',
        name: 'Cerebras',
        baseUrl: 'https://api.cerebras.ai/v1',
        getApiKey: () => process.env.CEREBRAS_API_KEY,
        model: 'gpt-oss-120b',
    },
    {
        id: 'gemini',
        name: 'Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        getApiKey: () => process.env.GEMINI_API_KEY,
        model: 'gemini-3-flash-preview', // Trying 8b variant as it's often more available
    },
    {
        id: 'mistral',
        name: 'Mistral',
        baseUrl: 'https://api.mistral.ai/v1',
        getApiKey: () => process.env.MISTRAL_API_KEY,
        model: 'codestral-latest',
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        getApiKey: () => process.env.OPENROUTER_API_KEY,
        model: 'openai/gpt-oss-120b:free',
    },
    {
        id: 'github',
        name: 'GitHub',
        baseUrl: 'https://models.inference.ai.azure.com',
        getApiKey: () => process.env.GITHUB_AI_API_KEY,
        model: 'openai/gpt-4o',
    },
    {
        id: 'ollama',
        name: 'Ollama',
        baseUrl: 'http://localhost:11434/v1',
        getApiKey: () => 'ollama',
        model: 'llama3',
    }
];

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
        let rotation: any[] = [];

        if (options.provider) {
            // Manual selection
            const manual = PROVIDERS.find(p => p.id === options.provider);
            if (manual) {
                rotation = [{ ...manual, model: options.model || manual.model, apiKey: manual.getApiKey() }];
            }
        }

        if (rotation.length === 0) {
            // Random or Rotation sequence
            const available = PROVIDERS.map(p => ({ ...p, apiKey: p.getApiKey() })).filter(p => !!p.apiKey);

            // Randomize starting point
            const randomIndex = Math.floor(Math.random() * available.length);
            rotation = [
                ...available.slice(randomIndex),
                ...available.slice(0, randomIndex)
            ];
        }

        for (const provider of rotation) {
            try {
                console.log(`[MultiAI] Attempting ${provider.name} (${options.model || provider.model})...`);

                const res = await fetch(`${provider.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${provider.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: options.model || provider.model,
                        messages,
                        stream: options.stream,
                        temperature: 0.3,
                        max_tokens: 16384,
                    }),
                });

                if (res.ok) {
                    if (!options.provider) this.saveState(provider.id);
                    return res;
                }

                const error = await res.text();
                console.warn(`[MultiAI] ${provider.name} failed:`, error);
            } catch (err) {
                console.error(`[MultiAI] ${provider.name} error:`, err);
            }
        }

        throw new Error('All AI providers failed');
    }
}

export const multiAI = new MultiAI();
