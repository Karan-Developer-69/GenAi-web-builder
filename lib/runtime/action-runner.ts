import type { WebContainer } from '@webcontainer/api';
import type { ActionCallbackData } from './message-parser';

export class ActionRunner {
    #webcontainer: Promise<WebContainer>;

    constructor(webcontainer: Promise<WebContainer>) {
        this.#webcontainer = webcontainer;
    }

    async addAction(data: ActionCallbackData) {
        // In a full implementation, this might add to a queue
        // For now, let's just run it if it's supposed to run immediately or sequentially
    }

    async runAction(data: ActionCallbackData) {
        const wc = await this.#webcontainer;

        if (data.type === 'shell') {
            const parts = data.content.split(' ');
            const command = parts[0];
            const args = parts.slice(1);

            const process = await wc.spawn(command, args);
            // We could pipe output to a terminal store here if needed
            return process.exit;
        }

        if (data.type === 'file') {
            // Assuming content is the file content and we need a path
            // Usually ActionCallbackData would have more info, 
            // but let's stick to what's implied or needed by WorkbenchStore.
            // Wait, WorkbenchStore calls artifact.runner.runAction(data)
        }
    }
}
