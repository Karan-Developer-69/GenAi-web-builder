"use client";

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Brain } from 'lucide-react';
import { RootState } from '../lib/store/store';
import { setSelectedAI } from '../lib/store/slices/chatSlice';
import { AI_MODELS } from '../utils/constants';

export const ModelSelector = () => {
    const dispatch = useDispatch();
    const selectedProvider = useSelector((state: RootState) => state.chat.selectedProvider);
    const selectedModel = useSelector((state: RootState) => state.chat.selectedModel);

    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const [provider, model] = e.target.value.split(':');
        dispatch(setSelectedAI({ provider, model }));
    };

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all duration-200">
            <Brain className="size-3.5 text-indigo-400" />
            <select
                value={`${selectedProvider}:${selectedModel}`}
                onChange={handleModelChange}
                className="bg-transparent text-[11px] font-medium text-zinc-400 outline-none cursor-pointer hover:text-zinc-200 transition-colors max-w-[120px] truncate rounded-md border-none"
            >
                {AI_MODELS.map(p => (
                    <optgroup key={p.id} label={p.name} className="bg-zinc-900  text-zinc-300">
                        {p.models.map(m => (
                            <option key={m} value={`${p.id}:${m}`}>
                                {m}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </select>
        </div>
    );
};
