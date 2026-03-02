import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export type ChatPhase = 'idle' | 'thinking' | 'planning' | 'executing' | 'launching' | 'done';

interface ChatState {
  messages: ChatMessage[];
  input: string;
  isTyping: boolean;
  history: string[];
  phase: ChatPhase;
  thinkingText: string;
  selectedProvider: string;
  selectedModel: string;
}

const initialState: ChatState = {
  messages: [],
  input: '',
  isTyping: false,
  history: [],
  phase: 'idle',
  thinkingText: '',
  selectedProvider: 'groq',
  selectedModel: 'llama-3.3-70b-versatile',
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setInput: (state, action: PayloadAction<string>) => {
      state.input = action.payload;
    },
    setMessages: (state, action: PayloadAction<ChatMessage[]>) => {
      state.messages = action.payload;
    },
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload);
    },
    setIsTyping: (state, action: PayloadAction<boolean>) => {
      state.isTyping = action.payload;
    },
    addToHistory: (state, action: PayloadAction<string>) => {
      state.history.push(action.payload);
    },
    updateMessage: (state, action: PayloadAction<{ index: number; content: string }>) => {
      if (state.messages[action.payload.index]) {
        state.messages[action.payload.index].content = action.payload.content;
      }
    },
    setPhase: (state, action: PayloadAction<ChatPhase>) => {
      state.phase = action.payload;
    },
    setThinkingText: (state, action: PayloadAction<string>) => {
      state.thinkingText = action.payload;
    },
    setSelectedAI: (state, action: PayloadAction<{ provider: string; model: string }>) => {
      state.selectedProvider = action.payload.provider;
      state.selectedModel = action.payload.model;
    },
  },
});

export const { setInput, setMessages, addMessage, setIsTyping, addToHistory, updateMessage, setPhase, setThinkingText, setSelectedAI } = chatSlice.actions;
export default chatSlice.reducer;