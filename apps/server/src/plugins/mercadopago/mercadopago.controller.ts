import {
    Body,
    Controller,
    HttpCode,
    InternalServerErrorException,
    Logger as NestLogger,
    Post,
    Req,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';
import { Allow, Permission } from '@vendure/core';
import { firmaValida } from './firma';
import { MercadoPagoError } from './mercadopago.api';
import { MercadoPagoService } from './mercadopago.service';
import { idPagoValido } from './referencia';

interface Peticion {
    query: Record<string, unknown>;
    headers: Record<string, string | string[] | undefined>;
}

const cabecera = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const texto = (valor: unknown) => (typeof valor === 'string' ? valor : typeof valor === 'number' ? String(valor) : undefined);

/**
 * Avisos de Mercado Pago (`POST /pagos/mercadopago/webhook`). Es público (Mercado Pago no tiene sesión de
 * Vendure) y se protege con la firma `x-signature`. Aun con firma válida no se cree el contenido: el pago
 * se consulta a la API de Mercado Pago. Responde 200 cuando el aviso ya no necesita reintento y 5xx cuando sí
 * (Mercado Pago reintenta los 5xx).
 */
@Controller('pagos/mercadopago')
export class MercadoPagoController {
    private readonly log = new NestLogger('MercadoPago');

    constructor(private readonly servicio: MercadoPagoService) {}

    @Post('webhook')
    @HttpCode(200)
    @Allow(Permission.Public)
    async webhook(@Req() req: Peticion, @Body() body: { type?: unknown } | undefined) {
        const secreto = this.servicio.webhookSecret;
        if (!secreto || !this.servicio.configurado) {
            throw new ServiceUnavailableException('Mercado Pago no está configurado');
        }
        // El id que se firma es el de la URL (`?data.id=`), no el del cuerpo.
        const dataId = texto(req.query['data.id']);
        const valida = firmaValida({
            firma: cabecera(req.headers['x-signature']),
            requestId: cabecera(req.headers['x-request-id']),
            dataId,
            secreto,
        });
        if (!valida) {
            throw new UnauthorizedException('Firma inválida');
        }
        const tipo = texto(req.query.type) ?? texto(req.query.topic) ?? texto(body?.type);
        if (tipo !== 'payment') {
            return { ok: true, ignorado: `tipo ${tipo ?? 'desconocido'}` };
        }
        if (!idPagoValido(dataId)) {
            return { ok: true, ignorado: 'id de pago inválido' };
        }
        try {
            const resultado = await this.servicio.sincronizarPago(dataId);
            return { ok: true, estado: resultado?.estado ?? 'ignorado' };
        } catch (error) {
            // 404: ese pago no existe en la cuenta (p. ej. la notificación de prueba del panel); reintentar no sirve.
            if (error instanceof MercadoPagoError && error.status === 404) {
                this.log.warn(`Aviso del pago ${dataId}: Mercado Pago no lo encontró`);
                return { ok: true, ignorado: 'pago no encontrado' };
            }
            this.log.error(`Falló el aviso del pago ${dataId}: ${(error as Error).message}`);
            throw new InternalServerErrorException('No se pudo procesar el aviso');
        }
    }
}
