import { configureStore } from '@reduxjs/toolkit';
import editorReducer from './slices/editorSlice';
import chatReducer from './slices/chatSlice';
import terminalReducer from './slices/terminalSlice';

export const store = configureStore({
  reducer: {
    editor: editorReducer,
    chat: chatReducer,
    terminal: terminalReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;