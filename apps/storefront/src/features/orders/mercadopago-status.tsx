'use client';

import {useEffect, useRef, useState} from 'react';
import {Loader2} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/platform/i18n/navigation';
import {refreshCartCache} from './actions';
import {CONFIRMING_POLL_MAX, CONFIRMING_POLL_MS} from './payment-view';

/**
 * Mientras Mercado Pago confirma el pago, vuelve a cargar la página cada pocos segundos (cada carga consulta el
 * pago al servidor). Es el respaldo del aviso en vivo, que no existe para quien compra sin cuenta. Tras unos
 * minutos deja de insistir y avisa que está tardando. No refresca con la pestaña oculta.
 */
export function MercadoPagoConfirming() {
    const t = useTranslations('OrderConfirmation');
    const router = useRouter();
    const attempts = useRef(0);
    const [slow, setSlow] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            if (document.hidden) return;
            attempts.current += 1;
            if (attempts.current > CONFIRMING_POLL_MAX) {
                clearInterval(interval);
                setSlow(true);
                return;
            }
            router.refresh();
        }, CONFIRMING_POLL_MS);
        return () => clearInterval(interval);
    }, [router]);

    if (slow) {
        return <p className="mx-auto max-w-prose text-sm text-muted-foreground">{t('mpConfirmingSlow')}</p>;
    }
    return (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true"/>
            {t('mpConfirmingWaiting')}
        </p>
    );
}

/** No pinta nada: al ver un pedido pagado con Mercado Pago, actualiza el carrito del encabezado una vez. */
export function RefreshCartOnPaid() {
    const done = useRef(false);

    useEffect(() => {
        if (done.current) return;
        done.current = true;
        refreshCartCache().catch(() => {});
    }, []);

    return null;
}
