import { I18nError, LogLevel } from '@vendure/core';

/**
 * Rechazo de permisos con un mensaje propio. `ForbiddenError` de Vendure solo trae el texto genérico
 * ("You are not currently authorized to perform this action"), que no dice por qué; este mantiene el código
 * `FORBIDDEN` de la API pero el Dashboard muestra el motivo en español.
 */
export class SurtidoNoPermitidoError extends I18nError {
    constructor(message: string) {
        super(message, {}, 'FORBIDDEN', LogLevel.Warn);
    }
}
