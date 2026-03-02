# Project Structure

Yeh ek **Next.js + WebContainer** based AI-powered code editor project hai jahan user AI se baat karke code generate kar sakta hai aur usse real-time browser mein run kar sakta hai.

---

## Recommended Folder Structure

```
.
├── app/                          # Next.js App Router (pages & API)
│   ├── layout.tsx                # Root layout (providers)
│   ├── page.tsx                  # Home / landing page
│   ├── globals.css               # Global styles
│   ├── chat/
│   │   └── page.tsx              # Chat interface page
│   ├── editor/
│   │   ├── page.tsx              # Editor page
│   │   └── components/           # Editor-specific components
│   │       ├── Sidebar.tsx       # File explorer sidebar
│   │       ├── TopBar.tsx        # Top navigation bar
│   │       ├── Workspace.tsx     # Main workspace layout
│   │       └── EditorView.tsx    # Code editor view
│   ├── webcontainer/
│   │   └── connect/[id]/
│   │       └── page.tsx          # WebContainer session connect page
│   └── api/                      # Backend API routes
│       ├── chat/route.ts         # Chat API (AI streaming)
│       └── generate/route.ts     # Code generation API
│
├── components/                   # Reusable shared components
│   ├── ReduxProvider.tsx         # Redux store provider wrapper
│   └── ui/                       # Base UI components (shadcn/radix)
│       ├── button.tsx
│       ├── input.tsx
│       ├── dialog.tsx
│       ├── badge.tsx
│       ├── textarea.tsx
│       ├── select.tsx
│       ├── tooltip.tsx
│       ├── scroll-area.tsx
│       ├── dropdown-menu.tsx
│       ├── hover-card.tsx
│       ├── collapsible.tsx
│       ├── command.tsx
│       ├── spinner.tsx
│       ├── input-group.tsx
│       └── file-tree.tsx         # File tree UI component
│
├── app/components/               # Page-level shared components
│   ├── CodeEditor.tsx            # TipTap editor wrapper
│   ├── Terminal.tsx              # Terminal emulator component
│   └── Preview.tsx               # Live preview iframe
│
├── lib/                          # Core application logic & state
│   ├── webcontainer.ts           # WebContainer initialization
│   ├── utils.ts                  # General utility functions
│   └── store/                    # Redux store
│       ├── store.ts              # Store configuration
│       └── slices/               # Redux slices
│           ├── chatSlice.ts      # Chat state
│           ├── editorSlice.ts    # Editor state
│           └── terminalSlice.ts  # Terminal state
│
├── utils/                        # Pure utility/helper functions
│   ├── ai.ts                     # AI helper utilities
│   └── validators.ts             # Input validation functions
│
├── types/                        # TypeScript type definitions
│   └── terminal.ts               # Terminal related types
│
├── webcontainer/                 # WebContainer logic
│   └── container.ts              # Container setup & management
│
├── public/                       # Static assets
│   ├── globe.svg
│   ├── window.svg
│   ├── file.svg
│   ├── next.svg
│   └── vercel.svg
│
├── middleware.ts                  # Next.js middleware
│   (Next.js config files: next.config.ts, tsconfig.json, components.json etc.)
├── postcss.config.mjs             # PostCSS / Tailwind config
├── eslint.config.mjs              # ESLint configuration
└── components.json                # shadcn/ui configuration
```

---

## Folder Responsibilities (Short Summary)

| Folder | Kya karta hai |
|--------|---------------|
| `app/` | Next.js pages aur API routes — routing ka poora structure yahan hai |
| `app/editor/` | Code editor interface — Sidebar, Workspace, EditorView |
| `app/api/` | Backend endpoints — AI chat aur code generation |
| `components/ui/` | Reusable base UI components (buttons, inputs etc.) |
| `app/components/` | Page-level components — CodeEditor, Terminal, Preview |
| `lib/store/` | Redux state management — editor, chat, terminal ka state |
| `lib/` | App ka core logic — webcontainer setup, store |
| `utils/` | Pure helper functions — AI utils, validators |
| `types/` | TypeScript interfaces aur types |
| `webcontainer/` | Browser mein Node.js run karne ka logic (WebContainer API) |
| `public/` | Static assets (SVGs, images) |

---

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **State Management:** Redux Toolkit
- **Styling:** Tailwind CSS + shadcn/ui
- **AI Integration:** Anthropic / OpenAI streaming API
- **Runtime:** WebContainer API (browser mein Node.js)
- **Editor:** CodeMirror / Monaco Editor

---

## Key Flows

**AI Code Generation Flow:**
```
User (Chat) → /api/chat → AI Model → message-parser.ts → action-runner.ts → WebContainer → Preview
```

**Editor Flow:**
```
Sidebar (File Tree) → EditorView (CodeEditor) → lib/store/editorSlice → WebContainer (hot reload)
```