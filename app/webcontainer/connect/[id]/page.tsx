'use client';

import { useEffect } from 'react';

/**
 * Required by the WebContainer API.
 *
 * When the WebContainer needs cross-origin isolation for preview windows,
 * it opens a popup at /webcontainer/connect/[id]. This page acts as a
 * message-passing relay between the WebContainer host and the preview iframe.
 *
 * The logic is inlined here because `setupConnect` is not a public export
 * of @webcontainer/api — it lives in the internal dist/connect.js file.
 */
function runSetupConnect() {
    const currentURL = new URL(window.location.href);
    if (!currentURL.pathname.startsWith('/webcontainer/connect/')) return;
    if (!window.opener) return;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function findMessagePorts(data: any): Transferable[] {
        if (!data || typeof data !== 'object') return [];
        const result: Transferable[] = [];
        for (const key in data) {
            const value = data[key];
            if (Object.prototype.toString.call(value) === '[object MessagePort]') {
                result.push(value);
            } else {
                result.push(...findMessagePorts(value));
            }
        }
        return result;
    }

    window.addEventListener('message', (event) => {
        if (event.data === 'close') { window.close(); return; }
        const transferables = findMessagePorts(event.data);
        if (event.source === window.opener) {
            iframe.contentWindow?.postMessage(event.data, '*', transferables);
        } else {
            window.opener.postMessage(event.data, '*', transferables);
        }
    });

    // Point the relay iframe at the editor host origin
    const editorOrigin = new URL(window.location.origin);
    editorOrigin.pathname = currentURL.pathname;
    iframe.src = editorOrigin.toString();
    document.body.appendChild(iframe);
}

export default function WebContainerConnectPage() {
    useEffect(() => {
        runSetupConnect();
    }, []);

    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100vh', background: '#0d1117',
            color: '#8b949e', fontFamily: 'system-ui, sans-serif', fontSize: 14,
        }}>
            Connecting WebContainer preview…
        </div>
    );
}
