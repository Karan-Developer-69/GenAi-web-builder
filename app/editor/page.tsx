import { Suspense } from 'react';
import EditorView from './components/EditorView';
export default function EditorPage() {
    return (
        
        <Suspense fallback={<div className="h-screen bg-white flex items-center justify-center text-[#2563eb] font-bold">Loading Lysis Synergy...</div>}>
            <EditorView />
        </Suspense>
    );
}
