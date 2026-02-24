import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TerminalLine {
  id: string;
  content: string;
  type: string;
}

interface TerminalState {
  lines: TerminalLine[];
}

const initialState: TerminalState = {
  lines: [],
};

let lineIdCounter = 0;

const terminalSlice = createSlice({
  name: 'terminal',
  initialState,
  reducers: {
    appendLine: (state, action: PayloadAction<{ content: string; type: string }>) => {
      state.lines.push({
        id: `${Date.now()}-${lineIdCounter++}`,
        content: action.payload.content,
        type: action.payload.type,
      });
    },
    updateLastLine: (state, action: PayloadAction<{ content: string; type: string }>) => {
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
      state.lines = [];
    },
  },
});

export const { appendLine, updateLastLine, clearLines } = terminalSlice.actions;
export default terminalSlice.reducer;