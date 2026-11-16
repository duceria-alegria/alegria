'use client';

import {useEffect} from 'react';
import {useRouter} from '@/platform/i18n/navigation';

interface LiveOrderUpdatesProps {
    /** Solo reacciona a los cambios de este pedido. Sin código reacciona a cualquier pedido del cliente. */
    code?: string;
}

/**
 * Vuelve a cargar la página en cuanto cambia el pedido (o cualquiera de los del cliente, sin `code`), sin
 * esperar a un ciclo de sondeo. Escucha `/api/pedidos-en-vivo`, que reenvía los eventos del servidor.
 * Con la pestaña oculta no refresca: guarda el aviso y refresca al volver a verla. Si se cae la conexión,
 * el navegador reconecta solo y, al volver, refresca por si hubo cambios mientras tanto. No renderiza nada.
 */
export function LiveOrderUpdates({code}: LiveOrderUpdatesProps) {
    const router = useRouter();

    useEffect(() => {
        let pendiente = false;
        let reconectando = false;

        const refrescar = () => {
            if (document.hidden) {
                pendiente = true;
            } else {
                pendiente = false;
                router.refresh();
            }
        };

        const source = new EventSource('/api/pedidos-en-vivo');
        source.addEventListener('pedido', event => {
            try {
                const cambio = JSON.parse((event as MessageEvent<string>).data) as {code?: string};
                if (!code || cambio.code === code) refrescar();
            } catch {
                // Un aviso mal formado se ignora.
            }
        });
        source.addEventListener('open', () => {
            if (reconectando) refrescar();
            reconectando = false;
        });
        source.addEventListener('error', () => {
            reconectando = true;
        });

        const alVolver = () => {
            if (!document.hidden && pendiente) refrescar();
        };
        document.addEventListener('visibilitychange', alVolver);

        return () => {
            source.close();
            document.removeEventListener('visibilitychange', alVolver);
        };
    }, [code, router]);

    return null;
}
