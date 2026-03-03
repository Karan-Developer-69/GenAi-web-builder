"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiSend } from 'react-icons/fi';
import { TypeAnimation } from 'react-type-animation';
import { ModelSelector } from '@/components/ModelSelector';

const FRAMEWORKS = [
  { id: 'react', label: 'React', icon: '⚛️', desc: 'Vite + React + Tailwind' },
  { id: 'nextjs', label: 'Next.js', icon: '⬛', desc: 'Next.js 14 App Router' },
  { id: 'python', label: 'Python', icon: '🐍', desc: 'FastAPI + HTML' },
];

export default function Page() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [hasError, setHasError] = useState(false);
  const [framework, setFramework] = useState('react');

  const handleGenerate = () => {
    if (!prompt.trim()) {
      setHasError(true);
      setTimeout(() => setHasError(false), 600);
      return;
    }
    router.push(`/editor?prompt=${encodeURIComponent(prompt)}&framework=${framework}`);
  };

  const suggestionChips = [
    "SaaS  productivity app",
    "Photography portfolio",
    "Minimalist store for watches",
    "Restaurant site booking form"
  ];

  return (
    <div className="min-h-screen bg-[#000000] text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white flex flex-col relative overflow-hidden">

      {/* ── Background Effects ── */}
      <div className="absolute inset-0 z-0 pointer-events-none flex justify-center">
        {/* Subtle top glow */}
        <div className="absolute top-0 w-[800px] h-[500px] bg-[radial-gradient(ellipse_50%_50%_at_50%_0%,rgba(120,119,198,0.15),rgba(255,255,255,0))]"></div>
        {/* Very faint grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      </div>

      {/* ── Header ── */}
      <header className="w-full flex justify-between items-center px-6 py-6 md:px-12 relative z-20">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => router.push('/')}
        >
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center transform transition-transform duration-300 group-hover:scale-105">
            <span className="text-black font-bold text-lg leading-none">L</span>
          </div>
          <span className="font-semibold text-lg tracking-tight text-zinc-200 group-hover:text-white transition-colors">
            Lysis
          </span>
        </div>

        <div className="text-sm font-medium text-zinc-500">
          v4.0 Synergy
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col  items-center justify-center px-4 md:px-6 relative z-10 w-full  mx-auto -mt-10">

        {/* Hero Section */}
        <div className="text-center mb-10 h-50  w-full flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/50 border border-zinc-800/50 text-zinc-400 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            Elite-Tier Neural Engines
          </div>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter mb-6 text-white leading-[1.1]">
            What do you want <br className="hidden md:block" />
            <span className="text-zinc-500">to build today?</span>
          </h1>
        </div>

        {/* Framework & Model Selector */}
        <div className="w-full max-w-2xl mb-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-600 font-medium mr-1">STACK</span>
            {FRAMEWORKS.map((fw) => (
              <button
                key={fw.id}
                onClick={() => setFramework(fw.id)}
                title={fw.desc}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200
                  ${framework === fw.id
                    ? 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.15)]'
                    : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
              >
                <span>{fw.icon}</span>
                <span>{fw.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 font-medium mr-1">BRAIN</span>
            <ModelSelector />
          </div>
        </div>

        {/* Input Command Center */}
        <div className="w-full max-w-2xl relative group">
          {/* Glowing border effect on focus */}
          <div className="absolute -inset-[1px] bg-[#0a0a0a] rounded-sm opacity-100 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none overflow-hidden"></div>

          <div className={`relative  h-40 rounded-sm border transition-colors duration-300 flex flex-col 
            ${hasError ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-zinc-800 group-focus-within:border-zinc-700'}
          `}>
            {
              !prompt && <TypeAnimation
                sequence={['I am Lysis.', 1000, 'What do you want to build today?', 1000]}
                wrapper="span"
                speed={50}
                className="w-full h-4/6 top-2 absolute bg-transparent px-5 py-2 text-zinc-500 placeholder-zinc-600 outline-none resize-none text-md "
                repeat={Infinity}
              />
            }
            <textarea
              className="w-full h-4/6 top-2 absolute bg-transparent px-5 py-2 text-zinc-100 placeholder-zinc-600 outline-none resize-none text-md "
              value={prompt}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setPrompt(e.target.value);
                if (hasError) setHasError(false);
              }}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              autoFocus
            />

            {/* Bottom Input Actions */}
            <div className="absolute bottom-4 left-6 right-4 flex justify-between items-center pointer-events-none">
              <div className="text-xs text-zinc-600 font-medium hidden sm:block">
                Press <kbd className="px-1.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-500 font-sans text-[10px] ml-1">Enter</kbd> to generate
              </div>

              <button
                onClick={handleGenerate}
                className="ml-auto cursor-pointer pointer-events-auto w-10 h-10 bg-white hover:bg-zinc-200 text-black rounded-sm flex items-center justify-center transition-all duration-200 active:scale-95 shadow-xl"
              >
                <FiSend className="text-lg" />
              </button>
            </div>
          </div>
        </div>

        {/* Suggestion Chips */}
        <div className="w-full max-w-2xl h-25 py-lg items-center flex flex-wrap sm:justify-center gap-1  realtive">
          {suggestionChips.map((chip, i) => (
            <button
              key={i}
              className="px-4  py-2 rounded-full bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 text-xs sm:text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all duration-200 text-center"
              onClick={() => {
                setPrompt(chip);
                setHasError(false);
              }}
            >
              {chip}
            </button>
          ))}
        </div>

      </main>

      {/* ── Footer ── */}
      <footer className="w-full py-8 text-center relative z-10">
        <p className="text-zinc-600 text-sm font-medium">
          No account required · Generates production-ready code
        </p>
      </footer>

    </div>
  );
}
