import { defineDashboardExtension } from '@vendure/dashboard';
import React, { useEffect } from 'react';
import logoSvgUrl from './assets/logo.svg';
import mascotSvgUrl from './assets/mascot-cutout.svg';

// Componente del logotipo para la pantalla de inicio de sesión
function AlegríaLoginLogo() {
    return (
        <div className="flex flex-col items-center justify-center pt-2 pb-1">
            <img
                src={logoSvgUrl}
                alt="Dulcería Alegría"
                className="h-24 sm:h-28 w-auto object-contain drop-shadow-md transition-transform hover:scale-105 duration-300"
            />
        </div>
    );
}

// Encabezado amigable antes del formulario de inicio de sesión
function AlegríaLoginBeforeForm() {
    return (
        <div className="flex flex-col items-center text-center gap-1.5 pb-2">
            <h1
                className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground"
                style={{ fontFamily: "'Baloo 2', 'Nunito', cursive, sans-serif" }}
            >
                Panel de Administración
            </h1>
            <p className="text-sm text-muted-foreground font-medium max-w-xs">
                Gestiona productos, pedidos y clientes de{' '}
                <span className="font-bold text-primary">Dulcería Alegría</span>
            </p>
        </div>
    );
}

// Botón de acceso directo al Storefront en la barra superior del Dashboard
function StorefrontToolbarButton() {
    return (
        <a
            href="http://localhost:3002"
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir la tienda en línea en una nueva pestaña"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/80 transition-all shadow-xs"
        >
            <span className="text-sm" aria-hidden="true">🍬</span>
            <span className="hidden sm:inline">Ver tienda</span>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-70"
                aria-hidden="true"
            >
                <path d="M15 3h6v6" />
                <path d="M10 14 21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
        </a>
    );
}

// Proveedor global para actualizar favicon y título de página
function AlegriaBrandingProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Actualizar favicon con el ícono de la marca
        let favicon = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'shortcut icon';
            document.head.appendChild(favicon);
        }
        favicon.type = 'image/svg+xml';
        favicon.href = mascotSvgUrl;

        // Sincronizar título dinámico para reflejar Dulcería Alegría
        const updateTitle = () => {
            if (document.title.includes('Vendure')) {
                document.title = document.title.replace(/Vendure/g, 'Dulcería Alegría');
            } else if (!document.title.includes('Dulcería Alegría')) {
                document.title = document.title ? `${document.title} • Dulcería Alegría` : 'Dulcería Alegría · Admin';
            }
        };

        const observer = new MutationObserver(updateTitle);
        const titleEl = document.querySelector('title') || document.head;
        observer.observe(titleEl, { subtree: true, characterData: true, childList: true });
        updateTitle();

        return () => observer.disconnect();
    }, []);

    return <>{children}</>;
}

// Registro de las extensiones del Dashboard
defineDashboardExtension({
    login: {
        logo: {
            component: AlegríaLoginLogo,
        },
        beforeForm: {
            component: AlegríaLoginBeforeForm,
        },
    },
    toolbarItems: [
        {
            id: 'alegria-storefront-link',
            component: StorefrontToolbarButton,
            position: { itemId: 'alerts', order: 'before' },
        },
    ],
    customProviders: [
        {
            id: 'alegria-branding-provider',
            component: AlegriaBrandingProvider,
            location: 'app',
        },
    ],
});
