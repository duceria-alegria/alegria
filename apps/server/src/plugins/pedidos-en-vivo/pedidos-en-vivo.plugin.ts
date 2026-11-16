import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PedidosEnVivoController } from './pedidos-en-vivo.controller';
import { PedidosEnVivoService } from './pedidos-en-vivo.service';

/**
 * Cambios de pedidos al instante, sin recargar: el servidor avisa por SSE (`GET /pedidos-en-vivo/admin` y
 * `/pedidos-en-vivo/tienda`) cuando cambia un pedido. La extensión del Dashboard (`dashboard/index.tsx`)
 * refresca listas y fichas; la tienda lo recibe por su ruta `/api/pedidos-en-vivo`.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [PedidosEnVivoService],
    controllers: [PedidosEnVivoController],
    dashboard: './dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class PedidosEnVivoPlugin {}
