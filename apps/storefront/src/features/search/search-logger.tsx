'use client';

import {useEffect, useRef} from 'react';
import {useLocale} from 'next-intl';

// Una búsqueda cuenta como "asentada" cuando lleva este tiempo sin cambiar en pantalla: así no se
// registra cada letra que el cliente teclea con la búsqueda en vivo.
const SETTLE_MS = 1500;
// Si el cliente se va antes de este tiempo (o es el doble montaje del modo desarrollo), no se
// registra al salir: lo más probable es que fuera una búsqueda a medias.
const MIN_DWELL_MS = 200;

function sendSearch(payload: {term: string; total: number; locale: string}) {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/search-log', new Blob([body], {type: 'application/json'}));
    } else {
        void fetch('/api/search-log', {method: 'POST', body, keepalive: true, headers: {'Content-Type': 'application/json'}});
    }
}

/**
 * No pinta nada: avisa a /api/search-log lo que se buscó y cuántos productos salieron (incluido 0,
 * que es lo más valioso: lo que los clientes no encuentran). Se manda cuando la búsqueda se asienta,
 * al cerrar la pestaña, o al abrir un resultado antes de que pase el tiempo.
 */
export function SearchLogger({term, total}: {term: string; total: number}) {
    const locale = useLocale();
    const sent = useRef('');
    const pending = useRef<{send: () => void; since: number} | null>(null);

    // Declarado antes que el efecto principal: al desmontar, los limpiadores corren en este orden,
    // y este necesita ver todavía la búsqueda pendiente.
    useEffect(() => () => {
        const waiting = pending.current;
        if (waiting && Date.now() - waiting.since > MIN_DWELL_MS) {
            waiting.send();
        }
    }, []);

    useEffect(() => {
        const clean = term.trim();
        if (!clean || sent.current === clean) return;
        const send = () => {
            pending.current = null;
            sent.current = clean;
            sendSearch({term: clean, total, locale});
        };
        const timer = setTimeout(send, SETTLE_MS);
        pending.current = {send, since: Date.now()};
        window.addEventListener('pagehide', send);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('pagehide', send);
            if (pending.current?.send === send) pending.current = null;
        };
    }, [term, total, locale]);

    return null;
}
