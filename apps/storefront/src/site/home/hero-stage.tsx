'use client';

import Image from 'next/image';
import {useEffect, useRef} from 'react';
import type {CSSProperties} from 'react';

interface Orb {
    /** Tailwind position classes inside the stage. */
    position: string;
    /** Tailwind size class. */
    size: string;
    /** Theme color token, e.g. `--color-brand-pink`. */
    color: string;
    /** Distance from the card plane in px: >0 floats in front, <0 sits behind the card. */
    depth: number;
    /** Idle float amplitude (px), duration (s) and phase (s). */
    float: number;
    duration: number;
    delay: number;
    /** Out-of-focus foreground/background orbs sell the depth of field. */
    blur?: boolean;
}

const ORBS: Orb[] = [
    // In front of the mascot, soft focus
    {position: '-left-[3%] bottom-[10%]', size: 'size-[68px]', color: '--color-brand-pink', depth: 160, float: 14, duration: 7.5, delay: -2, blur: true},
    {position: '-right-[2%] top-[38%]', size: 'size-[54px]', color: '--color-brand-cyan', depth: 140, float: 12, duration: 6.5, delay: -4, blur: true},
    // Around the mascot
    {position: 'left-[6%] top-[10%]', size: 'size-[32px]', color: '--color-brand-pink', depth: 105, float: 10, duration: 5.5, delay: -1},
    {position: 'right-[9%] top-[7%]', size: 'size-[40px]', color: '--color-brand-orange', depth: 95, float: 12, duration: 6.2, delay: -3},
    {position: 'right-[13%] bottom-[9%]', size: 'size-[28px]', color: '--color-brand-pink', depth: 85, float: 9, duration: 5.2, delay: -2.5},
    {position: 'left-[17%] bottom-[28%]', size: 'size-[22px]', color: '--color-brand-cyan', depth: 70, float: 8, duration: 4.8, delay: -0.5},
    {position: 'left-[44%] top-[2%]', size: 'size-[18px]', color: '--color-brand-yellow-deep', depth: 60, float: 7, duration: 4.4, delay: -3.5},
    // Behind the card, peeking out of its edges
    {position: '-left-[7%] -top-[7%]', size: 'size-[104px]', color: '--color-brand-yellow-deep', depth: -60, float: 9, duration: 8, delay: -1.5},
    {position: '-bottom-[8%] -right-[6%]', size: 'size-[132px]', color: '--color-brand-purple-deep', depth: -80, float: 10, duration: 9, delay: -5},
    {position: '-right-[3%] -top-[5%]', size: 'size-[44px]', color: '--color-brand-blue', depth: -35, float: 8, duration: 6.8, delay: -2},
];

/**
 * Layered 3D hero: the card tilts toward the pointer while every layer (mascot, candy balls) moves
 * by its own depth, so the mascot and balls seem to float in front of the card. Motion is written to
 * CSS variables on the stage from one rAF loop, so React never re-renders on pointer moves.
 */
export function HeroStage({alt}: {alt: string}) {
    const stageRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (reduceMotion.matches) return;

        const target = {x: 0, y: 0, scroll: 0};
        const current = {x: 0, y: 0, scroll: 0};
        let lastPointerAt = -Infinity;
        let visible = true;
        let frame = 0;
        let last = performance.now();

        const onPointerMove = (event: PointerEvent) => {
            if (event.pointerType === 'touch') return;
            target.x = (event.clientX / window.innerWidth - 0.5) * 2;
            target.y = (event.clientY / window.innerHeight - 0.5) * 2;
            lastPointerAt = performance.now();
        };
        const onScroll = () => {
            target.scroll = Math.min(Math.max(window.scrollY / 700, 0), 1);
        };

        const tick = (now: number) => {
            frame = 0;
            if (!visible || document.hidden) return;

            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;

            // With no pointer (touch devices, idle desktop) the stage sways on its own.
            if (now - lastPointerAt > 2500) {
                const t = now / 1000;
                target.x = Math.sin(t * 0.6) * 0.55;
                target.y = Math.cos(t * 0.45) * 0.4;
            }

            const ease = 1 - Math.exp(-dt * 5);
            current.x += (target.x - current.x) * ease;
            current.y += (target.y - current.y) * ease;
            current.scroll += (target.scroll - current.scroll) * ease;

            stage.style.setProperty('--px', current.x.toFixed(4));
            stage.style.setProperty('--py', current.y.toFixed(4));
            stage.style.setProperty('--sy', current.scroll.toFixed(4));
            frame = requestAnimationFrame(tick);
        };

        const start = () => {
            if (frame) return;
            last = performance.now();
            frame = requestAnimationFrame(tick);
        };

        const observer = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible) start();
        });
        observer.observe(stage);

        window.addEventListener('pointermove', onPointerMove, {passive: true});
        window.addEventListener('scroll', onScroll, {passive: true});
        document.addEventListener('visibilitychange', start);
        onScroll();
        start();

        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('scroll', onScroll);
            document.removeEventListener('visibilitychange', start);
        };
    }, []);

    return (
        <div ref={stageRef} className="hero-stage relative aspect-[5/4] w-full">
            <div className="hero-tilt absolute inset-0">
                <div className="absolute inset-0 overflow-hidden rounded-[32px] bg-brand-yellow-pale shadow-[0_40px_70px_-28px_rgba(75,29,110,0.45)]">
                    <div aria-hidden="true" className="hero-layer absolute inset-0" style={{'--d': -20} as CSSProperties}>
                        <span className="absolute -right-[12%] -top-[18%] size-[62%] rounded-full bg-pastel-pink"/>
                        <span className="absolute -bottom-[22%] -left-[14%] size-[66%] rounded-full bg-pastel-cyan"/>
                        <span className="absolute left-[8%] top-[6%] size-[24%] rounded-full bg-pastel-orange"/>
                    </div>
                    <div aria-hidden="true" className="hero-sheen pointer-events-none absolute inset-0"/>
                </div>

                <div aria-hidden="true" className="hero-layer absolute inset-0" style={{'--d': 25} as CSSProperties}>
                    <span className="absolute bottom-[2%] left-1/2 h-[9%] w-[62%] -translate-x-1/2 rounded-full bg-brand-outline/30 blur-xl"/>
                </div>

                {ORBS.map((orb) => (
                    <div
                        key={orb.position}
                        aria-hidden="true"
                        className={`hero-layer absolute ${orb.position} ${orb.size}`}
                        style={{'--d': orb.depth} as CSSProperties}
                    >
                        <span
                            className={`hero-orb hero-float block size-full rounded-full ${orb.blur ? 'blur-[2.5px]' : ''}`}
                            style={{
                                '--orb': `var(${orb.color})`,
                                '--float': `${orb.float}px`,
                                '--dur': `${orb.duration}s`,
                                '--delay': `${orb.delay}s`,
                            } as CSSProperties}
                        />
                    </div>
                ))}

                <div className="hero-layer absolute inset-x-0 -top-[9%] bottom-[5%] flex items-center justify-center" style={{'--d': 75} as CSSProperties}>
                    <Image
                        src="/brand/mascot-cutout.svg"
                        alt={alt}
                        width={629}
                        height={618}
                        preload
                        sizes="(max-width: 640px) 88vw, 520px"
                        className="hero-float h-full w-auto max-w-none drop-shadow-[0_22px_18px_rgba(43,19,64,0.3)] [--dur:7s] [--float:10px]"
                    />
                </div>
            </div>
        </div>
    );
}
