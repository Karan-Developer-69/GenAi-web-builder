import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface FileEntry {
  name: string;
  path: string;
  language: string;
  isDirectory?: boolean;
}

interface EditorState {
  status: 'idle' | 'booting' | 'running' | 'error';
  previewUrl: string;
  booted: boolean;
  files: FileEntry[];
  activeFile: FileEntry | null;
  editorContent: string;
  isSaving: boolean;
  isBuilding: boolean;
  buildingProgress: number;
  buildingStatus: string;
  deviceMode: string;
  currentTab: string;
  history: string[];
  layers: { path: string; type: 'file' | 'dir' }[];
  errorData: { message: string; type: string } | null;
  isReplicating: boolean;
  viewMode: string;
  runStatus: 'idle' | 'installing' | 'running' | 'error';
}

const initialState: EditorState = {
  status: 'idle',
  previewUrl: '',
  booted: false,
  files: [],
  activeFile: null,
  editorContent: '',
  isSaving: false,
  isBuilding: false,
  buildingProgress: 0,
  buildingStatus: '',
  deviceMode: 'desktop',
  currentTab: 'code',
  history: [],
  layers: [],
  errorData: null,
  isReplicating: false,
  viewMode: 'code',
  runStatus: 'idle',
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setStatus: (state, action: PayloadAction<EditorState['status']>) => {
      state.status = action.payload;
    },
    setPreviewUrl: (state, action: PayloadAction<string>) => {
      state.previewUrl = action.payload;
    },
    setBooted: (state, action: PayloadAction<boolean>) => {
      state.booted = action.payload;
    },
    setFiles: (state, action: PayloadAction<FileEntry[]>) => {
      state.files = action.payload;
    },
    setActiveFile: (state, action: PayloadAction<FileEntry | null>) => {
      state.activeFile = action.payload;
    },
    setEditorContent: (state, action: PayloadAction<string>) => {
      state.editorContent = action.payload;
    },
    setIsBuilding: (state, action: PayloadAction<boolean>) => {
      state.isBuilding = action.payload;
    },
    setBuildingProgress: (state, action: PayloadAction<number>) => {
      state.buildingProgress = action.payload;
    },
    setBuildingStatus: (state, action: PayloadAction<string>) => {
      state.buildingStatus = action.payload;
    },
    setLayers: (state, action: PayloadAction<{ path: string; type: 'file' | 'dir' }[]>) => {
      state.layers = action.payload;
    },
    setErrorData: (state, action: PayloadAction<EditorState['errorData']>) => {
      state.errorData = action.payload;
    },
    setIsReplicating: (state, action: PayloadAction<boolean>) => {
      state.isReplicating = action.payload;
    },
    setViewMode: (state, action: PayloadAction<string>) => {
      state.viewMode = action.payload;
    },
    setRunStatus: (state, action: PayloadAction<EditorState['runStatus']>) => {
      state.runStatus = action.payload;
    },
  },
});

export const {
  setStatus,
  setPreviewUrl,
  setBooted,
  setFiles,
  setActiveFile,
  setEditorContent,
  setIsBuilding,
  setBuildingProgress,
  setBuildingStatus,
  setLayers,
  setErrorData,
  setIsReplicating,
  setViewMode,
  setRunStatus,
} = editorSlice.actions;
export default editorSlice.reducer;