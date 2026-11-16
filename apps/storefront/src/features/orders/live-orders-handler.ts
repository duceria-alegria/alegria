import {getAuthToken} from '@/platform/vendure/auth-token';

const VENDURE_API_URL = process.env.VENDURE_SHOP_API_URL || process.env.NEXT_PUBLIC_VENDURE_SHOP_API_URL;
const VENDURE_CHANNEL_TOKEN = process.env.VENDURE_CHANNEL_TOKEN || process.env.NEXT_PUBLIC_VENDURE_CHANNEL_TOKEN || '__default_channel__';
const VENDURE_CHANNEL_TOKEN_HEADER = process.env.VENDURE_CHANNEL_TOKEN_HEADER || 'vendure-token';

/**
 * Pasa al navegador el flujo de eventos de los pedidos del cliente (`/pedidos-en-vivo/tienda` del servidor).
 * El token de sesión vive en una cookie de la tienda, que el navegador no puede mandar directo al servidor
 * (otro origen), así que esta ruta lo agrega y reenvía el flujo tal cual, sin guardarlo en búfer.
 */
export async function GET(request: Request) {
    const token = await getAuthToken();
    if (!token || !VENDURE_API_URL) {
        return new Response(null, {status: 401});
    }

    let upstream: Response;
    try {
        upstream = await fetch(`${new URL(VENDURE_API_URL).origin}/pedidos-en-vivo/tienda`, {
            headers: {
                Accept: 'text/event-stream',
                Authorization: `Bearer ${token}`,
                [VENDURE_CHANNEL_TOKEN_HEADER]: VENDURE_CHANNEL_TOKEN,
            },
            cache: 'no-store',
            // Cuando el navegador cierra la conexión, también se cierra la del servidor.
            signal: request.signal,
        });
    } catch {
        return new Response(null, {status: 502});
    }

    if (!upstream.ok || !upstream.body) {
        // 401/403 se pasan tal cual: el navegador no debe reintentar con una sesión que no sirve.
        const status = upstream.status === 401 || upstream.status === 403 ? upstream.status : 502;
        return new Response(null, {status});
    }

    return new Response(upstream.body, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no',
        },
    });
}
