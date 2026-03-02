'use client';

import React, { useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Placeholder from '@tiptap/extension-placeholder';
import { common, createLowlight } from 'lowlight';

// Create lowlight instance with common languages (JS, TS, HTML, CSS, JSON, etc.)
const lowlight = createLowlight(common);

// Map file extensions to lowlight language names
function getHighlightLanguage(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
        js: 'javascript',
        jsx: 'javascript',
        ts: 'typescript',
        tsx: 'typescript',
        html: 'xml',
        htm: 'xml',
        css: 'css',
        json: 'json',
        md: 'markdown',
        py: 'python',
        rb: 'ruby',
        java: 'java',
        c: 'c',
        cpp: 'cpp',
        go: 'go',
        rs: 'rust',
        sql: 'sql',
        sh: 'bash',
        bash: 'bash',
        yml: 'yaml',
        yaml: 'yaml',
        xml: 'xml',
        svg: 'xml',
        php: 'php',
        swift: 'swift',
        kt: 'kotlin',
        scss: 'scss',
        less: 'less',
    };
    return map[ext] || 'plaintext';
}

interface CodeEditorProps {
    value: string;
    fileName: string;
    onChange: (value: string) => void;
    onSave: () => void;
    isSaving?: boolean;
}

export default function CodeEditor({
    value,
    fileName,
    onChange,
    onSave,
    isSaving,
}: CodeEditorProps) {
    const onSaveRef = useRef(onSave);
    const onChangeRef = useRef(onChange);
    const isExternalUpdate = useRef(false);

    useEffect(() => {
        onSaveRef.current = onSave;
    }, [onSave]);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    const language = getHighlightLanguage(fileName);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                // Disable default code block — we use CodeBlockLowlight
                codeBlock: false,
                // Disable rich text features — we want code editing
                heading: false,
                bold: false,
                italic: false,
                strike: false,
                bulletList: false,
                orderedList: false,
                listItem: false,
                blockquote: false,
                horizontalRule: false,
            }),
            CodeBlockLowlight.configure({
                lowlight,
                defaultLanguage: language,
            }),
            Placeholder.configure({
                placeholder: 'Start typing code…',
            }),
        ],
        content: `<pre><code class="language-${language}">${escapeHtml(value || '')}</code></pre>`,
        editorProps: {
            attributes: {
                class: 'tiptap-code-editor',
                spellcheck: 'false',
            },
            handleKeyDown: (_view, event) => {
                // Ctrl+S / Cmd+S → save
                if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                    event.preventDefault();
                    onSaveRef.current();
                    return true;
                }
                // Tab → insert 2 spaces
                if (event.key === 'Tab') {
                    event.preventDefault();
                    editor?.commands.insertContent('  ');
                    return true;
                }
                return false;
            },
        },
        onUpdate: ({ editor }) => {
            if (isExternalUpdate.current) return;
            // Extract plain text from the editor
            const text = editor.getText();
            onChangeRef.current(text);
        },
    });

    // Sync external value changes (e.g. switching files)
    useEffect(() => {
        if (!editor) return;
        const currentText = editor.getText();
        if (value !== currentText) {
            isExternalUpdate.current = true;
            editor.commands.setContent(
                `<pre><code class="language-${language}">${escapeHtml(value || '')}</code></pre>`
            );
            isExternalUpdate.current = false;
        }
    }, [value, editor, language]);

    return (
        <div className="flex flex-col flex-1 overflow-hidden bg-[#09090b] tiptap-editor-wrapper">
            <style jsx global>{`
                .tiptap-editor-wrapper {
                    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace;
                }

                .tiptap-code-editor {
                    flex: 1;
                    outline: none;
                    overflow-y: auto;
                    padding: 16px 0;
                    min-height: 100%;
                    background: #09090b;
                    color: #d4d4d8;
                    font-size: 13px;
                    line-height: 1.6;
                    caret-color: #818cf8;
                }

                .tiptap-code-editor .ProseMirror {
                    outline: none;
                    min-height: 100%;
                }

                .tiptap-code-editor pre {
                    background: transparent !important;
                    padding: 0 16px 0 60px;
                    margin: 0;
                    font-family: inherit;
                    font-size: inherit;
                    line-height: inherit;
                    counter-reset: line;
                    position: relative;
                }

                .tiptap-code-editor pre code {
                    font-family: inherit;
                    background: transparent !important;
                    color: #d4d4d8;
                }

                /* Line numbers via CSS counters */
                .tiptap-code-editor pre code .hljs-ln-line,
                .tiptap-code-editor pre code > span {
                    counter-increment: line;
                }

                /* Syntax highlighting — VS Code Dark+ inspired */
                .tiptap-code-editor .hljs-comment,
                .tiptap-code-editor .hljs-quote { color: #6b7280; font-style: italic; }

                .tiptap-code-editor .hljs-keyword,
                .tiptap-code-editor .hljs-selector-tag,
                .tiptap-code-editor .hljs-type { color: #c084fc; }

                .tiptap-code-editor .hljs-string,
                .tiptap-code-editor .hljs-title,
                .tiptap-code-editor .hljs-section { color: #86efac; }

                .tiptap-code-editor .hljs-number,
                .tiptap-code-editor .hljs-literal { color: #fbbf24; }

                .tiptap-code-editor .hljs-built_in,
                .tiptap-code-editor .hljs-builtin-name { color: #67e8f9; }

                .tiptap-code-editor .hljs-attr,
                .tiptap-code-editor .hljs-attribute { color: #93c5fd; }

                .tiptap-code-editor .hljs-name,
                .tiptap-code-editor .hljs-tag { color: #f87171; }

                .tiptap-code-editor .hljs-variable,
                .tiptap-code-editor .hljs-template-variable { color: #fca5a5; }

                .tiptap-code-editor .hljs-regexp,
                .tiptap-code-editor .hljs-link { color: #fb923c; }

                .tiptap-code-editor .hljs-symbol,
                .tiptap-code-editor .hljs-bullet { color: #a78bfa; }

                .tiptap-code-editor .hljs-meta { color: #9ca3af; }

                .tiptap-code-editor .hljs-deletion { color: #fca5a5; background: rgba(220, 38, 38, 0.15); }
                .tiptap-code-editor .hljs-addition { color: #86efac; background: rgba(34, 197, 94, 0.15); }

                .tiptap-code-editor .hljs-emphasis { font-style: italic; }
                .tiptap-code-editor .hljs-strong { font-weight: bold; }

                /* Selection */
                .tiptap-code-editor ::selection {
                    background: rgba(99, 102, 241, 0.25);
                }

                /* Placeholder */
                .tiptap-code-editor .is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    color: #3f3f46;
                    pointer-events: none;
                    height: 0;
                    font-style: italic;
                }

                /* Scrollbar */
                .tiptap-code-editor::-webkit-scrollbar { width: 6px; height: 6px; }
                .tiptap-code-editor::-webkit-scrollbar-track { background: transparent; }
                .tiptap-code-editor::-webkit-scrollbar-thumb { background: #27272a80; border-radius: 3px; }
                .tiptap-code-editor::-webkit-scrollbar-thumb:hover { background: #3f3f4680; }

                /* Active line highlight */
                .tiptap-code-editor .ProseMirror-selectednode {
                    background: #18181b;
                }

                /* Cursor */
                .tiptap-code-editor .ProseMirror-cursor {
                    border-color: #818cf8;
                }

                /* p tags inside — reset to code style */
                .tiptap-code-editor p {
                    margin: 0;
                    font-family: inherit;
                    white-space: pre-wrap;
                    word-break: break-all;
                }
            `}</style>
            <EditorContent
                editor={editor}
                className="flex-1 overflow-y-auto"
            />
            {isSaving && (
                <div className="absolute top-2 right-4 text-[10px] text-indigo-400 font-mono animate-pulse">
                    Saving…
                </div>
            )}
        </div>
    );
}

// Escape HTML entities for safe injection into pre/code blocks
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
