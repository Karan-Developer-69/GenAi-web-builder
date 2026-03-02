export interface RunnerPayload {
    files: { path: string; content: string }[];
}

export interface RunnerMessage {
    type: 'log' | 'error' | 'info';
    content?: string;
    message?: string;
}

export class PythonRunnerClient {
    private socket: WebSocket | null = null;
    private baseUrl: string;

    constructor(baseUrl: string = 'ws://localhost:8001/ws/run') {
        this.baseUrl = baseUrl;
    }

    async run(payload: RunnerPayload, onMessage: (msg: RunnerMessage) => void): Promise<void> {
        this.stop(); // Close previous connection if any
        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(this.baseUrl);

                this.socket.onopen = () => {
                    console.log('[PythonRunner] Connected to backend');
                    this.socket?.send(JSON.stringify(payload));
                };

                this.socket.onmessage = (event) => {
                    const data: RunnerMessage = JSON.parse(event.data);
                    onMessage(data);
                };

                this.socket.onerror = (error) => {
                    console.error('[PythonRunner] WebSocket error:', error);
                    onMessage({ type: 'error', message: 'WebSocket connection failed' });
                    reject(error);
                };

                this.socket.onclose = () => {
                    console.log('[PythonRunner] Disconnected from backend');
                    resolve();
                };
            } catch (err) {
                reject(err);
            }
        });
    }

    stop() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

export const pythonRunner = new PythonRunnerClient();
