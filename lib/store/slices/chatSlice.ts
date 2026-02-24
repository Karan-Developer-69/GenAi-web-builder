import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatState {
  messages: ChatMessage[];
  input: string;
  isTyping: boolean;
  history: string[];
}

const initialState: ChatState = {
  messages: [],
  input: '',
  isTyping: false,
  history: [],
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
  },
});

export const { setInput, setMessages, addMessage, setIsTyping, addToHistory } = chatSlice.actions;
export default chatSlice.reducer;