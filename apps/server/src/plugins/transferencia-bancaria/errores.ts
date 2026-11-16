import { I18nError, LogLevel } from '@vendure/core';

/**
 * Rechazo de permisos con un mensaje propio: el `ForbiddenError` de Vendure solo trae el texto genérico en
 * inglés. Conserva el código `FORBIDDEN`, pero el Dashboard muestra el motivo en español.
 */
export class TransferenciaNoPermitidaError extends I18nError {
    constructor(message: string) {
        super(message, {}, 'FORBIDDEN', LogLevel.Warn);
    }
}
