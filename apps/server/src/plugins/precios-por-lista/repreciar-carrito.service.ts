import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { EventBus, LoginEvent, Logger, OrderService, RequestContext, User } from '@vendure/core';
import { ListaPreciosService } from './lista-precios.service';

const LOGGER_CTX = 'RepreciarCarrito';

/**
 * Pone al día los precios del carrito cuando el cliente inicia sesión.
 *
 * Las líneas de un carrito guardan el precio con el que se agregaron. Si el visitante llenó el carrito sin
 * sesión (precio de menudeo) y luego entra con su cuenta de mayoreo, Vendure solo le asigna el carrito: no
 * recalcula nada, y la tienda le mostraría precios de lista hasta que empezara a pagar (ahí sí se recalcula).
 * Lo mismo pasa con las líneas que se fusionan desde un carrito anterior de la cuenta.
 *
 * El manejador es bloqueante: `publish` lo espera antes de que responda el login, así que la tienda nunca
 * lee el carrito a medio actualizar. Corre con el mismo `ctx` (y la misma transacción) de la mutación `login`:
 * abrir otra transacción se quedaba esperando los bloqueos de esta y colgaba el inicio de sesión. Como esa
 * petición todavía es anónima (`ctx.activeUserId` vacío), se le fija la lista del cliente que entró.
 */
@Injectable()
export class RepreciarCarritoService implements OnApplicationBootstrap {
    constructor(
        private eventBus: EventBus,
        private orderService: OrderService,
        private listaPreciosService: ListaPreciosService,
    ) {}

    onApplicationBootstrap() {
        this.eventBus.registerBlockingEventHandler({
            event: LoginEvent,
            id: 'repreciar-carrito-al-iniciar-sesion',
            handler: async ({ ctx, user }) => {
                // El Dashboard también publica `LoginEvent`; solo importan los clientes de la tienda.
                if (ctx.apiType === 'shop') {
                    await this.repreciar(ctx, user);
                }
            },
        });
    }

    async repreciar(ctx: RequestContext, user: User) {
        try {
            const activo = await this.orderService.getActiveOrderForUser(ctx, user.id);
            // Solo los carritos: un pedido que ya está en pago conserva el precio con el que se arregló.
            if (!activo || activo.state !== 'AddingItems') {
                return;
            }
            const pedido = await this.orderService.findOne(ctx, activo.id, [
                'lines',
                'lines.productVariant',
                'lines.productVariant.productVariantPrices',
                'shippingLines',
                'surcharges',
                'customer',
            ]);
            if (!pedido?.lines.length) {
                return;
            }
            this.listaPreciosService.fijarLista(ctx, await this.listaPreciosService.getListaDeUsuario(ctx, user.id));
            await this.orderService.applyPriceAdjustments(ctx, pedido, pedido.lines);
        } catch (error) {
            // Al pagar Vendure vuelve a calcular los precios, así que un fallo aquí no es motivo para tumbar el login.
            Logger.error(
                `No se pudieron actualizar los precios del carrito: ${error instanceof Error ? error.message : String(error)}`,
                LOGGER_CTX,
                error instanceof Error ? error.stack : undefined,
            );
        }
    }
}
