import gql from 'graphql-tag';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { autorizarTransferencias } from './constants';
import { transferenciaBancariaHandler } from './transferencia-bancaria.handler';
import { TransferenciaBancariaResolver } from './transferencia-bancaria.resolver';
import { TransferenciaBancariaService } from './transferencia-bancaria.service';

const adminApiSchema = gql`
    type TransferenciaPendiente {
        paymentId: ID!
        orderId: ID!
        "Código del pedido: es el concepto con el que el cliente debe transferir."
        orderCode: String!
        orderState: String!
        cliente: String
        correo: String
        monto: Money!
        currencyCode: CurrencyCode!
        "Cuándo hizo el pedido."
        creadoEn: DateTime!
    }

    extend type Query {
        "Transferencias que esperan confirmación, las más antiguas primero. Requiere AutorizarTransferencias."
        transferenciasPendientes: [TransferenciaPendiente!]!
    }

    extend type Mutation {
        "El dinero llegó: el pago pasa a confirmado y el pedido a Pago confirmado. Requiere AutorizarTransferencias."
        confirmarTransferencia(paymentId: ID!): Order!
        "El dinero no llegó: cancela el pago y el pedido (libera el inventario). Requiere AutorizarTransferencias."
        rechazarTransferencia(paymentId: ID!, motivo: String): Order!
    }
`;

/**
 * Método de pago por transferencia bancaria sin pasarela: el pedido queda en "Pago autorizado" y el dueño (o
 * quien tenga `AutorizarTransferencias`) lo confirma al ver el dinero en la cuenta. Ver
 * `transferencia-bancaria.handler.ts`. La pantalla "Transferencias por confirmar" del Dashboard lista lo
 * pendiente. El flujo de bodega no deja iniciar el surtido mientras la transferencia no esté confirmada.
 *
 * El método de pago se da de alta en Configuración → Métodos de pago (o con `seed-metodo-transferencia.ts`).
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [TransferenciaBancariaService],
    adminApiExtensions: { schema: adminApiSchema, resolvers: [TransferenciaBancariaResolver] },
    configuration: config => {
        config.paymentOptions.paymentMethodHandlers = [
            ...(config.paymentOptions.paymentMethodHandlers ?? []),
            transferenciaBancariaHandler,
        ];
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions ?? []),
            autorizarTransferencias,
        ];
        return config;
    },
    dashboard: './dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class TransferenciaBancariaPlugin {}
