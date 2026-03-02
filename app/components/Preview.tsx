'use client';

import { Shimmer } from "@/components/ai-elements/shimmer";

interface PreviewProps {
    url: string;
    loading: boolean;
    onRestartServer?: () => void;
    onClearContainer?: () => void;
    onInstallDeps?: () => void;
}

export default function Preview({ url, loading, onRestartServer, onClearContainer, onInstallDeps }: PreviewProps) {
    const displayUrl = url || 'Waiting for server…';

    const handleRefresh = () => {
        // Refresh handled by EditorView or via window.location.reload()
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                background: '#212121',
                overflow: 'hidden',
                borderLeft: '1px solid var(--border-color)',
                minWidth: 0,
            }}
        >
            {/* Toolbar */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 10px',
                    background: '#000',
                    borderBottom: '1px solid var(--border-color)',
                    minHeight: 40,
                }}
            >
                {/* Traffic lights */}
                {['#f85149', '#d29922', '#3fb950'].map((c, i) => (
                    <div
                        key={i}
                        style={{ width: 12, height: 12, borderRadius: '50%', background: c, flexShrink: 0 }}
                    />
                ))}

                {/* Refresh */}
                <button
                    onClick={handleRefresh}
                    disabled={!url}
                    title="Refresh preview"
                    style={{
                        background: 'none',
                        border: 'none',
                        color: url ? 'var(--text-secondary)' : 'var(--text-muted)',
                        cursor: url ? 'pointer' : 'not-allowed',
                        fontSize: 16,
                        padding: 4,
                        borderRadius: 4,
                        marginLeft: 4,
                        flexShrink: 0,
                    }}
                >
                    ⟳
                </button>

                {/* Restart Server */}
                {onRestartServer && (
                    <button
                        onClick={onRestartServer}
                        disabled={loading}
                        title="Restart dev server"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: !loading ? 'var(--text-secondary)' : 'var(--text-muted)',
                            cursor: !loading ? 'pointer' : 'not-allowed',
                            fontSize: 14,
                            padding: 4,
                            borderRadius: 4,
                            marginLeft: 4,
                            flexShrink: 0,
                        }}
                    >
                        🔄
                    </button>
                )}

                {/* Install Dependencies */}
                {onInstallDeps && (
                    <button
                        onClick={onInstallDeps}
                        disabled={loading}
                        title="Install dependencies"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: !loading ? 'var(--text-secondary)' : 'var(--text-muted)',
                            cursor: !loading ? 'pointer' : 'not-allowed',
                            fontSize: 14,
                            padding: 4,
                            borderRadius: 4,
                            marginLeft: 4,
                            flexShrink: 0,
                        }}
                    >
                        📦
                    </button>
                )}

                {/* Clear Container */}
                {onClearContainer && (
                    <button
                        onClick={onClearContainer}
                        disabled={loading}
                        title="Clear container"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: !loading ? 'var(--text-secondary)' : 'var(--text-muted)',
                            cursor: !loading ? 'pointer' : 'not-allowed',
                            fontSize: 14,
                            padding: 4,
                            borderRadius: 4,
                            marginLeft: 4,
                            flexShrink: 0,
                        }}
                    >
                        🗑️
                    </button>
                )}

                {/* URL bar (Read-only for popup) */}
                <div style={{ flex: 1, display: 'flex' }}>
                    <div
                        style={{
                            flex: 1,
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 6,
                            padding: '4px 10px',
                            color: 'var(--text-secondary)',
                            fontSize: 12,
                            fontFamily: 'var(--font-mono)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {url || displayUrl}
                    </div>
                </div>

                {/* Live indicator */}
                {url && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 11,
                            color: 'var(--green)',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                        }}
                    >
                        <span
                            style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                background: 'var(--green)',
                                display: 'inline-block',
                                animation: 'pulse 2s infinite',
                            }}
                        />
                        LIVE
                    </div>
                )}

                {/* Open in new tab */}
                {url && (
                    <a
                        href={url}
                        target="_blank"
                        title="Open preview in new tab"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 10px',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 6,
                            color: 'var(--text-secondary)',
                            textDecoration: 'none',
                            fontSize: 11,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLAnchorElement).style.background = 'var(--accent-dim)';
                            (e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)';
                            (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--accent)';
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-elevated)';
                            (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)';
                            (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-color)';
                        }}
                    >
                        <span style={{ fontSize: 13 }}>↗</span>
                        New Tab
                    </a>
                )}
            </div>

            {/* Popup Status Indicator */}
            <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
                {loading && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#121212',
                            zIndex: 10,
                            gap: 16,
                        }}
                    >
                        <Shimmer duration={3} spread={3} as="h1" className="font-bold text-6xl">
                            Preview 
                        </Shimmer>
                        <Shimmer duration={3} spread={3}    >
                            Please wait for the preview to load
                        </Shimmer>
                    </div>
                )}

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    background: 'var(--bg-primary)',
                }}>
                    {url && (
                       <iframe src={url} className='w-full h-full'
                            allow='geolocation; ch-ua-full-version-list; cross-origin-isolated; screen-wake-lock; on-device-speech-recognition; publickey-credentials-get; ch-ua-arch; compute-pressure; ch-prefers-reduced-transparency; deferred-fetch; usb; ch-save-data; publickey-credentials-create; cardano; deferred-fetch-minimal; ch-downlink; ch-ua-form-factors; payment; ch-ua; ch-ua-model; ch-ect; autoplay; ethereum; camera; accelerometer; ch-ua-platform-version; idle-detection; ch-viewport-height; captured-surface-control; local-fonts; ch-ua-platform; midi; ch-ua-full-version; xr-spatial-tracking; clipboard-read; gamepad; display-capture; keyboard-map; aria-notify; local-network; ch-ua-high-entropy-values; ch-width; ch-prefers-reduced-motion; encrypted-media; gyroscope; serial; ch-rtt; ch-ua-mobile; window-management; unload; solana; ch-dpr; ch-prefers-color-scheme; ch-ua-wow64; fullscreen; identity-credentials-get; hid; ch-ua-bitness; storage-access; sync-xhr; ch-device-memory; ch-viewport-width; picture-in-picture; magnetometer; loopback-network; clipboard-write; microphone'
                       ></iframe>
                    )}
                </div>
            </div>

            <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
        </div>
    );
}
