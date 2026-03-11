export const AI_MODELS = [
    { id: 'groq', name: 'Groq', models: ['qwen/qwen3-32b', 'openai/gpt-oss-120b'] },
    { id: 'cerebras', name: 'Cerebras', models: ['gpt-oss-120b', 'zai-glm-4.6'] },
    { id: 'mistral', name: 'Mistral', models: ['codestral-latest', 'mistral-large-latest'] },
    { id: 'openrouter', name: 'OpenRouter', models: ['openai/gpt-4o', 'stepfun/step-3.5-flash:free', 'qwen/qwen3-coder:free'] },
    { id: 'github', name: 'GitHub', models: ['gpt-4o', 'phi-4'] },
];

export const DEFAULT_FILES_BY_FRAMEWORK: Record<string, { path: string; content: string }[]> = {
    react: [
        {
            path: 'package.json',
            content: JSON.stringify({
                name: "lysis-react-project",
                private: true,
                version: "0.0.0",
                type: "module",
                scripts: { dev: "vite", build: "tsc && vite build", preview: "vite preview" },
                dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
                devDependencies: { "@types/react": "^18.2.0", "@types/react-dom": "^18.2.0", "@vitejs/plugin-react": "^4.0.0", typescript: "^5.0.0", vite: "^4.4.0", tailwindcss: "^3.3.0", postcss: "^8.4.0", autoprefixer: "^10.4.0" }
            }, null, 2)
        }
    ],
    nextjs: [
        {
            path: 'package.json',
            content: JSON.stringify({
                name: "lysis-nextjs-project",
                version: "0.1.0",
                private: true,
                scripts: { dev: "next dev", build: "next build", start: "next start", lint: "next lint" },
                dependencies: { react: "^18", "react-dom": "^18", next: "14.2.0" },
                devDependencies: { typescript: "^5", "@types/node": "^20", "@types/react": "^18", "@types/react-dom": "^18", postcss: "^8", tailwindcss: "^3" }
            }, null, 2)
        }
    ],
    python: [
        {
            path: 'requirements.txt',
            content: "fastapi\nuvicorn\njinja2\npython-multipart"
        }
    ]
};
