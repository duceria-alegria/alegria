import { PermissionDefinition } from '@vendure/core';

/** Estado del pedido mientras alguien de la bodega lo surte (el cliente lo ve como "Atendiendo pedido"). */
export const ESTADO_PREPARANDO = 'Preparing';

declare module '@vendure/core' {
    interface OrderStates {
        Preparing: never;
    }
}

/** Estados desde los que se puede iniciar el surtido (pago autorizado o confirmado). */
export const ESTADOS_INICIABLES: readonly string[] = ['PaymentAuthorized', 'PaymentSettled'];

/** Estados a los que no se puede pasar mientras el pago no esté confirmado, cuando el pedido viene de surtido. */
export const ESTADOS_DE_ENVIO: readonly string[] = ['PartiallyShipped', 'Shipped', 'PartiallyDelivered', 'Delivered'];

/** Estados desde los que un pedido en surtido puede intentar enviarse tras una modificación. */
export const ESTADOS_TRAS_MODIFICAR: readonly string[] = ['Modifying', 'ArrangingAdditionalPayment'];

/** Campo personalizado de Order con el administrador (trabajador de bodega) que surte el pedido. */
export const CAMPO_SURTIDOR = 'surtidor';

export const prepararPedidos = new PermissionDefinition({
    name: 'PrepararPedidos',
    description: 'Iniciar el surtido de pedidos',
});

export const asignarPedidos = new PermissionDefinition({
    name: 'AsignarPedidos',
    description: 'Asignar pedidos a trabajadores',
});

// Vendure pasa los mensajes de error por i18next con el formato ICU. Su `nsSeparator` está desactivado, así
// que los ":" no son problema, pero en ICU las llaves y el apóstrofo sí tienen significado: estos textos
// no los llevan.
export const MENSAJE_SIN_PERMISO_PARA_SURTIR = 'No tienes permiso para iniciar el surtido de pedidos';
export const MENSAJE_ASIGNADO_A_OTRO = 'Este pedido está asignado a otro trabajador';
export const MENSAJE_PAGO_SIN_CONFIRMAR =
    'No se puede enviar ni entregar el pedido hasta que su pago esté confirmado';
export const MENSAJE_VUELTA_A_SURTIDO_INVALIDA =
    'El pedido solo puede volver a "Atendiendo pedido" si estaba en ese estado antes de modificarse';
export const MENSAJE_ESTADO_CAMBIO = 'El pedido cambió de estado mientras se procesaba, vuelve a intentarlo';
