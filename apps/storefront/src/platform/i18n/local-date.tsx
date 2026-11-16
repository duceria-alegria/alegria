'use client';

import {useEffect, useState} from 'react';
import {formatDate, STORE_TIME_ZONE} from '@/platform/i18n/format';

interface LocalDateProps {
    /** ISO date string tal como lo entrega Vendure (UTC). */
    value: string;
    format?: 'short' | 'long';
    locale: string;
    withTime?: boolean;
}

/**
 * Fecha/hora en la zona horaria del visitante. El servidor no la conoce, así que el HTML inicial usa la zona
 * de la tienda (igual en servidor y cliente, sin errores de hidratación) y, ya en el navegador, se recalcula
 * con la zona del dispositivo.
 */
export function LocalDate({value, format = 'short', locale, withTime = false}: LocalDateProps) {
    const [timeZone, setTimeZone] = useState<string>(STORE_TIME_ZONE);

    useEffect(() => {
        setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || STORE_TIME_ZONE);
    }, []);

    return (
        <time dateTime={value} suppressHydrationWarning>
            {formatDate(value, format, locale, {withTime, timeZone})}
        </time>
    );
}
