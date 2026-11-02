import gql from 'graphql-tag';
import { OnApplicationBootstrap } from '@nestjs/common';
import { Administrator, I18nService, LanguageCode, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { asignarPedidos, CAMPO_SURTIDOR, prepararPedidos } from './constants';
import { FlujoBodegaResolver } from './flujo-bodega.resolver';
import { flujoBodegaFulfillmentProcess } from './flujo-bodega.fulfillment-process';
import { flujoBodegaProcess } from './flujo-bodega.process';
import { FlujoBodegaService } from './flujo-bodega.service';

const es = (value: string) => [{ languageCode: LanguageCode.es, value }];

const adminApiSchema = gql`
    extend type Mutation {
        "Un trabajador con permiso inicia el surtido (solo con pago autorizado o confirmado): el pedido pasa a Preparing y, si nadie lo tenía, queda a su nombre."
        iniciarSurtido(orderId: ID!): Order!
        "Asigna el pedido a un trabajador de bodega. Con administratorId null, o sin indicarlo, el pedido queda sin surtidor."
        asignarSurtidor(orderId: ID!, administratorId: ID): Order!
    }

    extend type Administrator {
        "Fecha en que se eliminó (borrado lógico). Null si la cuenta sigue activa."
        deletedAt: DateTime
    }
`;

/**
 * Flujo de bodega: agrega el estado `Preparing` ("Atendiendo pedido") al pedido, un surtidor asignable
 * (`Order.surtidor`) y dos permisos: `PrepararPedidos` (iniciar el surtido) y `AsignarPedidos` (asignar
 * el pedido a otro trabajador). Ver `seed-roles-bodega.ts` para los roles Surtidor y Encargado.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [FlujoBodegaService],
    adminApiExtensions: { schema: adminApiSchema, resolvers: [FlujoBodegaResolver] },
    configuration: config => {
        config.orderOptions.process = [...(config.orderOptions.process ?? []), flujoBodegaProcess];
        config.shippingOptions.process = [
            ...(config.shippingOptions.process ?? []),
            flujoBodegaFulfillmentProcess,
        ];
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions ?? []),
            prepararPedidos,
            asignarPedidos,
        ];
        config.customFields.Order = [
            ...(config.customFields.Order ?? []),
            {
                name: CAMPO_SURTIDOR,
                type: 'relation' as const,
                entity: Administrator,
                label: es('Surtidor'),
                description: es('Trabajador de bodega que surte el pedido'),
                // El cliente no ve quién surte su pedido, y el campo solo cambia con las mutaciones
                // `iniciarSurtido` y `asignarSurtidor` (no con `setOrderCustomFields`).
                public: false,
                readonly: true,
                nullable: true,
                onDelete: 'SET NULL',
                // El selector genérico del Dashboard no sirve aquí: lista administradores (exige
                // ReadAdministrator, que el Surtidor no tiene) y no muestra al asignado. La extensión del
                // Dashboard muestra el surtidor en su propio bloque y lo asigna con "Asignar surtidor".
                ui: { dashboard: false },
            },
        ];
        return config;
    },
    dashboard: './dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class FlujoBodegaPlugin implements OnApplicationBootstrap {
    constructor(private i18nService: I18nService) {}

    onApplicationBootstrap() {
        // El core no trae el texto de `FulfillmentStateTransitionError.message` y el Dashboard muestra ese campo
        // al fallar un cambio de estado del envío (se vería la clave cruda). Se usa el detalle del error, que
        // incluye el motivo en español de `flujo-bodega.fulfillment-process.ts`. Los idiomas sin traducción
        // propia usan el inglés.
        this.i18nService.addTranslation('en', {
            errorResult: { FULFILLMENT_STATE_TRANSITION_ERROR: '{ transitionError }' },
        });
    }
}
