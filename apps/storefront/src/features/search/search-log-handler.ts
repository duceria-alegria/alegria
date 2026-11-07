import {cookies} from 'next/headers';
import {NextRequest} from 'next/server';
import {routing} from '@/platform/i18n/routing';
import {mutate} from '@/platform/vendure/api';
import {RegisterSearchMutation} from '@/features/search/graphql';

// Cookie propia con un id aleatorio para distinguir visitantes que no han iniciado sesión. No se
// guarda la IP ni nada que identifique a la persona; quien sí inició sesión queda ligado a su
// cuenta en el servidor.
const VISITOR_COOKIE = 'alegria_vid';
const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const VISITOR_ID = /^[A-Za-z0-9-]{8,64}$/;
const CRAWLER_USER_AGENT = /bot|crawler|spider|crawling|slurp/i;
const MAX_TERM_LENGTH = 200;

const noContent = () => new Response(null, {status: 204});

/**
 * Recibe de la tienda (con `navigator.sendBeacon`) una búsqueda que el cliente dejó asentada y se
 * la pasa a Vendure junto con el secreto compartido. Sin `SEARCH_LOG_SECRET` no hace nada. Registrar
 * es de "mejor esfuerzo": un fallo aquí nunca debe notarse al buscar.
 */
export async function POST(request: NextRequest) {
    const secret = process.env.SEARCH_LOG_SECRET?.trim();
    if (!secret || CRAWLER_USER_AGENT.test(request.headers.get('user-agent') ?? '')) {
        return noContent();
    }

    const body = (await request.json().catch(() => null)) as {term?: unknown; total?: unknown; locale?: unknown} | null;
    const term = typeof body?.term === 'string' ? body.term.slice(0, MAX_TERM_LENGTH) : '';
    const total = typeof body?.total === 'number' && Number.isFinite(body.total) ? Math.max(0, Math.trunc(body.total)) : null;
    if (!term.trim() || total === null) {
        return new Response(null, {status: 400});
    }
    const locale = (routing.locales as readonly string[]).includes(String(body?.locale)) ? String(body?.locale) : routing.defaultLocale;

    const cookieStore = await cookies();
    let visitorId = cookieStore.get(VISITOR_COOKIE)?.value;
    if (!visitorId || !VISITOR_ID.test(visitorId)) {
        visitorId = crypto.randomUUID();
        cookieStore.set(VISITOR_COOKIE, visitorId, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
            path: '/',
        });
    }

    try {
        await mutate(
            RegisterSearchMutation,
            {input: {term, resultCount: total, visitorId}},
            {useAuthToken: true, languageCode: locale, fetch: {headers: {'x-search-log-key': secret}, cache: 'no-store'}},
        );
    } catch {
        // Nunca debe afectar a quien busca.
    }
    return noContent();
}
