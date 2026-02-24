import { WebContainer } from '@webcontainer/api';

let webcontainerPromise: Promise<WebContainer> | undefined;

export const webcontainer = new Promise<WebContainer>((resolve) => {
    if (typeof window === 'undefined') {
        return;
    }

    if (!webcontainerPromise) {
        webcontainerPromise = WebContainer.boot();
    }

    resolve(webcontainerPromise);
});
