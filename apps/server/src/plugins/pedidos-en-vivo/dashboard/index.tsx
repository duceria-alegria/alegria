import {
    defineDashboardExtension,
    LS_KEY_SELECTED_CHANNEL_TOKEN,
    LS_KEY_SESSION_TOKEN,
    useAuth,
} from '@vendure/dashboard';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
// Módulo virtual que genera el plugin de Vite del Dashboard (el mismo que usa su cliente de la API).
// @ts-ignore: sus tipos solo existen dentro del paquete del Dashboard.
import { uiConfig } from 'virtual:vendure-ui-config';

type CambioDePedido = { id: string; code: string; state: string };

const REINTENTO_INICIAL_MS = 1_000;
const REINTENTO_MAXIMO_MS = 30_000;

/** Misma regla que el cliente de la API del Dashboard: con `auto` la API es el origen que sirve el Dashboard. */
function urlDelFlujo(): string {
    const host =
        uiConfig.api.host !== 'auto'
            ? uiConfig.api.host
            : `${globalThis.location.protocol}//${globalThis.location.hostname}`;
    const puertoActual = globalThis.location.port ? `:${globalThis.location.port}` : '';
    const puerto = uiConfig.api.port === 'auto' ? puertoActual : `:${uiConfig.api.port}`;
    return `${host}${puerto}/pedidos-en-vivo/admin`;
}

function cabeceras(): Headers {
    const headers = new Headers({ Accept: 'text/event-stream' });
    const sesion = localStorage.getItem(LS_KEY_SESSION_TOKEN);
    const canal = localStorage.getItem(LS_KEY_SELECTED_CHANNEL_TOKEN);
    if (sesion) {
        headers.set('Authorization', `Bearer ${sesion}`);
    }
    if (canal) {
        headers.set(uiConfig.api.channelTokenKey, canal);
    }
    return headers;
}

const esperar = (ms: number, senal: AbortSignal) =>
    new Promise<void>(resolver => {
        const temporizador = setTimeout(resolver, ms);
        senal.addEventListener('abort', () => (clearTimeout(temporizador), resolver()), { once: true });
    });

/**
 * Mantiene abierto el flujo de eventos y llama a `alCambiar` con cada pedido que cambia. No se usa
 * `EventSource` porque no puede mandar `Authorization` (el Dashboard guarda el token de sesión en
 * localStorage). Si se cae la conexión reintenta con espera creciente y avisa con `alReconectar` para que
 * se recupere lo que pasó mientras estuvo caída.
 */
async function escuchar(
    senal: AbortSignal,
    alCambiar: (cambio: CambioDePedido) => void,
    alReconectar: () => void,
) {
    let espera = REINTENTO_INICIAL_MS;
    let primeraVez = true;
    while (!senal.aborted) {
        try {
            const respuesta = await fetch(urlDelFlujo(), {
                headers: cabeceras(),
                credentials: 'include',
                signal: senal,
            });
            // Sin sesión o sin permiso para ver pedidos: reintentar no sirve de nada.
            if (respuesta.status >= 400 && respuesta.status < 500) {
                return;
            }
            if (!respuesta.ok || !respuesta.body) {
                throw new Error(`HTTP ${respuesta.status}`);
            }
            if (!primeraVez) {
                alReconectar();
            }
            primeraVez = false;
            espera = REINTENTO_INICIAL_MS;

            const lector = respuesta.body.pipeThrough(new TextDecoderStream()).getReader();
            let pendiente = '';
            for (;;) {
                const { value, done } = await lector.read();
                if (done) {
                    break;
                }
                pendiente += value;
                let fin: number;
                while ((fin = pendiente.indexOf('\n\n')) >= 0) {
                    const bloque = pendiente.slice(0, fin);
                    pendiente = pendiente.slice(fin + 2);
                    // Las líneas que empiezan con ":" son comentarios (el latido): no traen datos.
                    const datos = bloque
                        .split('\n')
                        .filter(linea => linea.startsWith('data:'))
                        .map(linea => linea.slice(5).trim())
                        .join('\n');
                    if (datos) {
                        try {
                            alCambiar(JSON.parse(datos));
                        } catch {
                            // Un aviso mal formado no debe tirar la conexión.
                        }
                    }
                }
            }
        } catch {
            if (senal.aborted) {
                return;
            }
        }
        await esperar(espera, senal);
        espera = Math.min(espera * 2, REINTENTO_MAXIMO_MS);
    }
}

/**
 * Refresca lo que muestra el Dashboard de un pedido. Sin `orderId` (al reconectar) refresca todos los pedidos.
 * Solo se vuelven a pedir las consultas que están en pantalla; el resto queda marcado como vencido.
 */
function refrescarPedido(queryClient: QueryClient, orderId?: string) {
    return queryClient.invalidateQueries({
        predicate: ({ queryKey: [clave, segundo, tercero] }) =>
            clave === 'PaginatedListDataTable' ||
            clave === 'transferencias-pendientes' ||
            (clave === 'DetailPage' &&
                segundo === 'order' &&
                (orderId === undefined || (tercero as { id?: string })?.id === orderId)) ||
            ((clave === 'OrderHistory' || clave === 'orderPreModifyingState' || clave === 'surtidor-del-pedido') &&
                (orderId === undefined || segundo === orderId)),
    });
}

function PedidosEnVivoProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }
        const control = new AbortController();
        void escuchar(
            control.signal,
            cambio => void refrescarPedido(queryClient, String(cambio.id)),
            () => void refrescarPedido(queryClient),
        );
        return () => control.abort();
    }, [isAuthenticated, queryClient]);

    return <>{children}</>;
}

defineDashboardExtension({
    customProviders: [{ id: 'pedidos-en-vivo', component: PedidosEnVivoProvider, location: 'app' }],
});
