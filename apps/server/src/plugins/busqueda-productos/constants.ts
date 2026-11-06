import { PermissionDefinition } from '@vendure/core';

export const BUSQUEDA_OPTIONS = Symbol('BUSQUEDA_PRODUCTOS_OPTIONS');

/**
 * Quién puede ver la pantalla "Qué buscan los clientes" del Dashboard. El superadministrador ya la
 * tiene; a los demás roles se les asigna en Configuración → Roles.
 */
export const verBusquedasClientes = new PermissionDefinition({
    name: 'VerBusquedasClientes',
    description: 'Ver lo que buscan los clientes en la tienda',
});

/** Valores que `vendure-config.ts` lee del entorno y le pasa al plugin con `init()`. */
export interface BusquedaProductosOptions {
    /**
     * Secreto compartido con la tienda para registrar búsquedas (`SEARCH_LOG_SECRET`). Sin él la
     * mutación `registrarBusqueda` rechaza todo: nadie más debe poder escribir en el registro.
     */
    searchLogSecret?: string;
    /** Días que se conservan las búsquedas registradas (por defecto 365). */
    searchLogRetentionDays?: number;
}

export const DEFAULT_SEARCH_LOG_RETENTION_DAYS = 365;
