export interface ArtifactCallbackData {
    messageId: string;
    id: string;
    title: string;
}

export interface ActionCallbackData {
    messageId: string;
    content: string;
    actionId: string;
    type: 'shell' | 'file';
}
