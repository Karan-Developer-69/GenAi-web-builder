'use client';

import React, { useEffect, useRef } from 'react';

export default function GlobalEffects() {
    const cursorDotRef = useRef<HTMLDivElement>(null);
    const cursorRingRef = useRef<HTMLDivElement>(null);
    const mousePos = useRef({ x: 0, y: 0 });
    const ringPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        // 1. Custom Cursor
        const onMouseMove = (e: MouseEvent) => {
            mousePos.current = { x: e.clientX, y: e.clientY };
            if (cursorDotRef.current) {
                cursorDotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
            }
        };

        const animateRing = () => {
            const lerp = 0.15;
            ringPos.current.x += (mousePos.current.x - ringPos.current.x) * lerp;
            ringPos.current.y += (mousePos.current.y - ringPos.current.y) * lerp;

            if (cursorRingRef.current) {
                cursorRingRef.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0)`;
            }
            requestAnimationFrame(animateRing);
        };

        window.addEventListener('mousemove', onMouseMove);
        const animationId = requestAnimationFrame(animateRing);

        // 2. Hover Interactions
        const onMouseEnter = () => {
            if (cursorDotRef.current) cursorDotRef.current.style.width = '12px';
            if (cursorDotRef.current) cursorDotRef.current.style.height = '12px';
            if (cursorRingRef.current) {
                cursorRingRef.current.style.width = '50px';
                cursorRingRef.current.style.height = '50px';
                cursorRingRef.current.style.borderColor = 'var(--blue-primary)';
            }
        };

        const onMouseLeave = () => {
            if (cursorDotRef.current) cursorDotRef.current.style.width = '8px';
            if (cursorDotRef.current) cursorDotRef.current.style.height = '8px';
            if (cursorRingRef.current) {
                cursorRingRef.current.style.width = '32px';
                cursorRingRef.current.style.height = '32px';
                cursorRingRef.current.style.borderColor = 'var(--blue-glow)';
            }
        };

        const interactiveElements = document.querySelectorAll('button, a, input, textarea, [role="button"]');
        interactiveElements.forEach(el => {
            el.addEventListener('mouseenter', onMouseEnter);
            el.addEventListener('mouseleave', onMouseLeave);
        });

        // 3. Scroll Reveal
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.1 });

        const revealElements = document.querySelectorAll('.reveal');
        revealElements.forEach(el => revealObserver.observe(el));

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            cancelAnimationFrame(animationId);
            interactiveElements.forEach(el => {
                el.removeEventListener('mouseenter', onMouseEnter);
                el.removeEventListener('mouseleave', onMouseLeave);
            });
            revealElements.forEach(el => revealObserver.unobserve(el));
        };
    }, []);

    return (
        <>
            <div
                ref={cursorDotRef}
                style={{
                    position: 'fixed', top: -4, left: -4, width: 8, height: 8,
                    background: 'var(--blue-primary)', borderRadius: '50%', pointerEvents: 'none',
                    zIndex: 9999, transition: 'width 0.15s, height 0.15s',
                    willChange: 'transform'
                }}
            />
            <div
                ref={cursorRingRef}
                style={{
                    position: 'fixed', top: -16, left: -16, width: 32, height: 32,
                    border: '1px solid var(--blue-glow)', borderRadius: '50%', pointerEvents: 'none',
                    zIndex: 9998, transition: 'width 0.15s, height 0.15s, border-color 0.15s',
                    willChange: 'transform'
                }}
            />
            <style>{`
        .reveal {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .stagger-1 { transition-delay: 0s; }
        .stagger-2 { transition-delay: 0.1s; }
        .stagger-3 { transition-delay: 0.2s; }
        .stagger-4 { transition-delay: 0.3s; }
        .stagger-5 { transition-delay: 0.4s; }
        .stagger-6 { transition-delay: 0.5s; }
      `}</style>
        </>
    );
}
