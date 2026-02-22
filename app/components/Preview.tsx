'use client';

import React, { useState } from 'react';

interface PreviewProps {
    iframeRef: React.RefObject<HTMLIFrameElement | null>;
    url: string;
    loading: boolean;
    onRestartServer?: () => void;
    onClearContainer?: () => void;
    onInstallDeps?: () => void;
}

export default function Preview({ iframeRef, url, loading, onRestartServer, onClearContainer, onInstallDeps }: PreviewProps) {
    const [manualUrl, setManualUrl] = useState('');

    const displayUrl = url || 'Waiting for server…';
    console.log("Url => ",displayUrl)
    const handleNav = (e: React.FormEvent) => {
        e.preventDefault();
        if (iframeRef.current && manualUrl) {
            iframeRef.current.src = manualUrl;
        }
    };

    const handleRefresh = () => {
        if (iframeRef.current) {
            // eslint-disable-next-line no-self-assign
            iframeRef.current.src = iframeRef.current.src;
        }
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                background: 'var(--bg-secondary)',
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
                    background: 'var(--bg-secondary)',
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

                {/* URL bar */}
                <form onSubmit={handleNav} style={{ flex: 1, display: 'flex' }}>
                    <input
                        value={manualUrl || url}
                        onChange={e => setManualUrl(e.target.value)}
                        placeholder={displayUrl}
                        style={{
                            flex: 1,
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 6,
                            padding: '4px 10px',
                            color: 'var(--text-primary)',
                            fontSize: 12,
                            fontFamily: 'var(--font-mono)',
                            outline: 'none',
                        }}
                        onFocus={e => {
                            (e.target as HTMLInputElement).style.borderColor = 'var(--border-active)';
                        }}
                        onBlur={e => {
                            (e.target as HTMLInputElement).style.borderColor = 'var(--border-color)';
                        }}
                    />
                </form>

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

            {/* iframe */}
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
                            background: 'var(--bg-primary)',
                            zIndex: 10,
                            gap: 16,
                        }}
                    >
                        <div
                            style={{
                                width: 42,
                                height: 42,
                                border: '3px solid var(--border-color)',
                                borderTop: '3px solid var(--accent)',
                                borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite',
                            }}
                        />
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            Booting WebContainer…
                        </span>
                    </div>
                )}
                <iframe
                    ref={iframeRef}
                    allow="cross-origin-isolated"
                    style={{
                        width: '100%',
                        height: '100vh',
                        border: 'none',
                        background: '#013778ff',
                        opacity: loading ? 0 : 1,
                        transition: 'opacity 0.3s ease',
                    }}
                />
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
