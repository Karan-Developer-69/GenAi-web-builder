import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TerminalLine } from '@/types/terminal';

interface TerminalState {
  lines: TerminalLine[];
  userLines: TerminalLine[];
  activeTab: 'system' | 'user';
}

const initialState: TerminalState = {
  lines: [],
  userLines: [],
  activeTab: 'system',
};

const MAX_LINES = 500;
let lineIdCounter = 0;

const terminalSlice = createSlice({
  name: 'terminal',
  initialState,
  reducers: {
    appendLine: (state, action: PayloadAction<{ content: string; type: TerminalLine['type'] }>) => {
      state.lines.push({
        id: `${Date.now()}-${lineIdCounter++}`,
        content: action.payload.content,
        type: action.payload.type,
      });
      if (state.lines.length > MAX_LINES) {
        state.lines.shift();
      }
    },
    appendUserLine: (state, action: PayloadAction<{ content: string; type: TerminalLine['type'] }>) => {
      state.userLines.push({
        id: `${Date.now()}-${lineIdCounter++}`,
        content: action.payload.content,
        type: action.payload.type,
      });
      if (state.userLines.length > MAX_LINES) {
        state.userLines.shift();
      }
    },
    updateLastLine: (state, action: PayloadAction<{ content: string; type: TerminalLine['type'] }>) => {
      if (state.lines.length > 0) {
        const lastIndex = state.lines.length - 1;
        state.lines[lastIndex] = {
          ...state.lines[lastIndex],
          content: action.payload.content,
          type: action.payload.type,
        };
      }
    },
    clearLines: (state) => {
      if (state.activeTab === 'system') {
        state.lines = [];
      } else {
        state.userLines = [];
      }
    },
    setActiveTab: (state, action: PayloadAction<'system' | 'user'>) => {
      state.activeTab = action.payload;
    },
  },
});

export const { appendLine, appendUserLine, updateLastLine, clearLines, setActiveTab } = terminalSlice.actions;
export default terminalSlice.reducer;