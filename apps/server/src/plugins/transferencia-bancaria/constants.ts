import { PermissionDefinition } from '@vendure/core';

/** Código del método de pago "Transferencia bancaria" (también lo usa el seed y la tienda). */
export const CODIGO_TRANSFERENCIA = 'transferencia-bancaria';

/**
 * Confirmar o rechazar las transferencias de los clientes tras revisar la cuenta bancaria. SuperAdmin la
 * tiene (Vendure se la da a esa cuenta con cada permiso nuevo); a otro rol se le asigna en
 * Configuración → Roles.
 */
export const autorizarTransferencias = new PermissionDefinition({
    name: 'AutorizarTransferencias',
    description: 'Confirmar o rechazar las transferencias bancarias de los clientes',
});

// Vendure pasa los mensajes de error por i18next con formato ICU: sin llaves ni apóstrofos.
export const MENSAJE_SIN_PERMISO_TRANSFERENCIA =
    'Solo quien tiene el permiso para autorizar transferencias puede confirmar o rechazar este pago';
export const MENSAJE_TRANSFERENCIA_PENDIENTE =
    'No se puede iniciar el surtido: la transferencia del cliente todavía no está confirmada';
