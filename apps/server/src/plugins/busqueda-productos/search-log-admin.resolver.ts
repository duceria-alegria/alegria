import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow } from '@vendure/core';
import { verBusquedasClientes } from './constants';
import { SearchLogService } from './search-log.service';

@Resolver()
export class SearchLogAdminResolver {
    constructor(private readonly searchLogService: SearchLogService) {}

    /** Alimenta la pantalla "Qué buscan los clientes" del Dashboard. Solo devuelve agregados. */
    @Query()
    @Allow(verBusquedasClientes.Permission)
    reporteBusquedas(@Args('dias') dias?: number, @Args('limite') limite?: number) {
        return this.searchLogService.report(dias ?? 30, limite ?? 20);
    }
}
