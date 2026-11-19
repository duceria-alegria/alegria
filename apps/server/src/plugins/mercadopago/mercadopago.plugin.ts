import gql from 'graphql-tag';
import { PluginCommonModule, ScheduledTask, VendurePlugin } from '@vendure/core';
import { PreciosPorListaPlugin } from '../precios-por-lista/precios-por-lista.plugin';
import { MercadoPagoCobro } from './cobro.entity';
import { mercadoPagoHandler } from './mercadopago.handler';
import { MercadoPagoController } from './mercadopago.controller';
import { MercadoPagoResolver } from './mercadopago.resolver';
import { MercadoPagoService } from './mercadopago.service';
import { MERCADOPAGO_OPTIONS, MercadoPagoOptions } from './options';

const shopApiSchema = gql`
    type OpcionPagoMercadoPago {
        "Identificador de la forma de pago: se manda a crearPagoMercadoPago."
        id: String!
        nombre: String!
        descripcion: String!
        "Total del pedido, sin comisión."
        montoPedido: Money!
        "Comisión de Mercado Pago que se suma al pedido; 0 si el cliente paga con la lista pública."
        comision: Money!
        "Lo que se cobra en Mercado Pago: pedido + comisión."
        total: Money!
        cobraComision: Boolean!
    }

    type EnlacePagoMercadoPago {
        "Página de Mercado Pago a la que hay que mandar al cliente."
        urlPago: String!
        montoPedido: Money!
        comision: Money!
        total: Money!
    }

    type EstadoPagoMercadoPago {
        "sin_pago | creado | pendiente | aplicado | rechazado | revision"
        estado: String!
    }

    extend type Query {
        "Formas de pago con Mercado Pago del carrito activo, con la comisión de cada una. Vacío si está apagado."
        opcionesPagoMercadoPago: [OpcionPagoMercadoPago!]!
    }

    extend type Mutation {
        "Genera el enlace de pago de Mercado Pago del pedido activo (en ArrangingPayment). No cambia el pedido: se paga cuando Mercado Pago confirma."
        crearPagoMercadoPago(opcion: String!): EnlacePagoMercadoPago!
        "Al regresar de Mercado Pago: busca el pago en Mercado Pago, lo registra si ya está aprobado y devuelve el estado."
        verificarPagoMercadoPago(codigoPedido: String!): EstadoPagoMercadoPago!
    }
`;

/** Respaldo por si un aviso del webhook se pierde: revisa los pagos que siguen pendientes. */
const conciliarTask = new ScheduledTask({
    id: 'conciliar-mercadopago',
    description: 'Revisa en Mercado Pago los cobros pendientes por si se perdió un aviso del webhook',
    schedule: cron => cron.every(5).minutes(),
    preventOverlap: true,
    async execute({ injector }) {
        const { revisados, cambiados } = await injector.get(MercadoPagoService).conciliar();
        return { result: `Se revisaron ${revisados} cobros y cambiaron ${cambiados}` };
    },
});

/**
 * Pagos con Mercado Pago (Checkout Pro). Flujo:
 *  1. El cliente elige "Mercado Pago" y una forma de pago (tarjeta / SPEI): `opcionesPagoMercadoPago`
 *     le muestra la comisión de cada una (solo clientes de mayoreo; el precio de lista no paga comisión).
 *  2. `crearPagoMercadoPago` crea la preferencia en Mercado Pago, guarda el intento en `mercadopago_cobro` y
 *     devuelve el enlace; la tienda redirige al cliente. El pedido sigue en ArrangingPayment.
 *  3. Mercado Pago avisa a `POST /pagos/mercadopago/webhook` (firmado). El servicio consulta el pago y, si
 *     está aprobado, lo registra con `addPaymentToOrder` (el handler lo vuelve a verificar): el pedido
 *     pasa a "Pago confirmado". El cliente al regresar llama `verificarPagoMercadoPago` por si el aviso
 *     tarda, y una tarea programada concilia los que se pierdan.
 *
 * Solo contado: el crédito lo maneja la dulcería directo con el cliente. Ver `mercadopago.handler.ts` para el
 * blindaje de `addPaymentToOrder`. El método se da de alta con `seed-metodo-mercadopago.ts`.
 */
@VendurePlugin({
    imports: [PluginCommonModule, PreciosPorListaPlugin],
    entities: [MercadoPagoCobro],
    providers: [MercadoPagoService, { provide: MERCADOPAGO_OPTIONS, useFactory: () => MercadoPagoPlugin.options }],
    controllers: [MercadoPagoController],
    shopApiExtensions: { schema: shopApiSchema, resolvers: [MercadoPagoResolver] },
    configuration: config => {
        config.paymentOptions.paymentMethodHandlers = [
            ...(config.paymentOptions.paymentMethodHandlers ?? []),
            mercadoPagoHandler,
        ];
        config.schedulerOptions.tasks = [...(config.schedulerOptions.tasks ?? []), conciliarTask];
        return config;
    },
    compatibility: '^3.0.0',
})
export class MercadoPagoPlugin {
    static options: MercadoPagoOptions;

    static init(options: MercadoPagoOptions): typeof MercadoPagoPlugin {
        this.options = options;
        return MercadoPagoPlugin;
    }
}
