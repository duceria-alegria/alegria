import { Controller, Get, Req, Res } from '@nestjs/common';
import { Allow, Ctx, CustomerService, Permission, RequestContext } from '@vendure/core';
import { Peticion, PedidosEnVivoService, Respuesta } from './pedidos-en-vivo.service';

/**
 * Flujos SSE de cambios en pedidos. Se autentican como la Admin API y la Shop API: con `Authorization:
 * Bearer <token de sesión>` o con la cookie de sesión.
 */
@Controller('pedidos-en-vivo')
export class PedidosEnVivoController {
    constructor(
        private servicio: PedidosEnVivoService,
        private customerService: CustomerService,
    ) {}

    /** Todos los pedidos, para el Dashboard. Requiere poder ver pedidos. */
    @Get('admin')
    @Allow(Permission.ReadOrder)
    admin(@Req() req: Peticion, @Res() res: Respuesta) {
        this.servicio.abrir(
            req,
            res,
            () => true,
            ({ orderId, code, state }) => ({ id: orderId, code, state }),
        );
    }

    /** Solo los pedidos del cliente con sesión iniciada, para la tienda. */
    @Get('tienda')
    @Allow(Permission.Owner)
    async tienda(@Ctx() ctx: RequestContext, @Req() req: Peticion, @Res() res: Respuesta) {
        const cliente = ctx.activeUserId
            ? await this.customerService.findOneByUserId(ctx, ctx.activeUserId)
            : undefined;
        if (!cliente) {
            res.status(401);
            res.end();
            return;
        }
        const idCliente = String(cliente.id);
        this.servicio.abrir(
            req,
            res,
            evento => evento.customerId === idCliente,
            ({ code, state }) => ({ code, state }),
        );
    }
}
