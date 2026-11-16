'use client';

import {useEffect} from 'react';
import {useRouter} from '@/platform/i18n/navigation';
import {LiveOrderUpdates} from './live-order-updates';

// Estados en los que el pedido sigue avanzando sin que el cliente haga nada (pago -> surtido -> envío).
const IN_PROGRESS_STATES = ['PaymentAuthorized', 'PaymentSettled', 'Preparing'];
const REFRESH_INTERVAL_MS = 60_000;

interface OrderAutoRefreshProps {
    code: string;
    state: string;
}

/**
 * Mantiene al día la página del pedido. Lo normal es el aviso en vivo (`LiveOrderUpdates`): el cambio se ve
 * al instante. Como respaldo, por si la conexión en vivo no está disponible (proxy que la corta, sesión
 * vencida...), vuelve a cargar la página cada 60 s mientras el pedido está en un estado que puede cambiar.
 * No refresca con la pestaña oculta; al volver a verla, el siguiente ciclo la actualiza. No renderiza nada.
 */
export function OrderAutoRefresh({code, state}: OrderAutoRefreshProps) {
    const router = useRouter();
    const shouldRefresh = IN_PROGRESS_STATES.includes(state);

    useEffect(() => {
        if (!shouldRefresh) return;
        const interval = setInterval(() => {
            if (!document.hidden) router.refresh();
        }, REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [router, shouldRefresh]);

    return <LiveOrderUpdates code={code}/>;
}
