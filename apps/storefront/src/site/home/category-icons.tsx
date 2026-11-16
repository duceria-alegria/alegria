const ICONS = {
    gomitas: (
        <>
            <circle cx="12" cy="10" r="5"/>
            <circle cx="7.5" cy="5.5" r="2"/>
            <circle cx="16.5" cy="5.5" r="2"/>
            <path d="M7 21c0-3 2-5.5 5-5.5s5 2.5 5 5.5"/>
        </>
    ),
    paletas: (
        <>
            <circle cx="12" cy="9" r="6"/>
            <path d="M12 15v6"/>
            <path d="M9 9a3 3 0 0 1 3-3"/>
        </>
    ),
    chocolates: (
        <>
            <rect x="5" y="3" width="14" height="18" rx="2"/>
            <path d="M5 9h14M5 15h14M12 3v18"/>
        </>
    ),
    caramelos: (
        <>
            <ellipse cx="12" cy="12" rx="5" ry="4"/>
            <path d="M7 12L2.5 8.5v7z"/>
            <path d="M17 12l4.5-3.5v7z"/>
        </>
    ),
    picositos: (
        <>
            <path d="M15 6c3 0 5 3 3 7-2 4-6 7-12 7 3-2 5-4 5-8 0-4 1-6 4-6z"/>
            <path d="M15 6l1.5-3"/>
        </>
    ),
    tamarindos: (
        <>
            <path d="M3.5 16C6 8 13 4.5 20.5 5.5 19.5 13 13 20 3.5 16z"/>
            <path d="M8 13.5l2.5-3M12 12.5l2.5-3.5"/>
        </>
    ),
    frituras: (
        <>
            <path d="M6 3h12l-1 18H7z"/>
            <path d="M6 7h12M6 17h12"/>
            <circle cx="12" cy="12" r="2"/>
        </>
    ),
    chicles: (
        <>
            <rect x="3" y="8" width="18" height="8" rx="1.5"/>
            <path d="M8 8v8M13 8v8"/>
        </>
    ),
    cacahuates: (
        <>
            <circle cx="9" cy="15" r="4.5"/>
            <circle cx="15" cy="9" r="4.5"/>
            <path d="M10.5 10.5l3 3"/>
        </>
    ),
    gelatinas: (
        <>
            <path d="M6 20h12l1.5-11h-15z"/>
            <path d="M8 9c0-3 1.8-5 4-5s4 2 4 5"/>
        </>
    ),
    desechables: (
        <>
            <path d="M6 4h12l-1.5 16h-9z"/>
            <path d="M6.6 9h10.8"/>
        </>
    ),
    regalos: (
        <>
            <rect x="4" y="10" width="16" height="10" rx="1"/>
            <rect x="3" y="7" width="18" height="3" rx="1"/>
            <path d="M12 7v13"/>
            <path d="M12 7c-2.5 0-4-3-2.2-3.8C11.5 2.5 12 5 12 7zM12 7c2.5 0 4-3 2.2-3.8C12.5 2.5 12 5 12 7z"/>
        </>
    ),
};

type IconKey = keyof typeof ICONS;

const ICON_ORDER = Object.keys(ICONS) as IconKey[];

/** Icon for a collection: matched by slug, otherwise cycled by position so every tile still gets one. */
export function CategoryIcon({slug, index}: {slug: string; index: number}) {
    const key = Object.hasOwn(ICONS, slug) ? (slug as IconKey) : ICON_ORDER[index % ICON_ORDER.length];

    return (
        <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {ICONS[key]}
        </svg>
    );
}
