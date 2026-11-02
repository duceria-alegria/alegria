export function SectionHeading({children, className}: {children: React.ReactNode; className?: string}) {
    return (
        <div className={className}>
            <h2 className="font-display text-[length:clamp(28px,3.6vw,40px)] font-extrabold leading-[1.1]">
                {children}
            </h2>
            <svg width="64" height="12" viewBox="0 0 64 12" aria-hidden="true" className="mt-1.5 block text-brand-yellow">
                <path d="M3 3 Q32 13 61 3" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            </svg>
        </div>
    );
}
