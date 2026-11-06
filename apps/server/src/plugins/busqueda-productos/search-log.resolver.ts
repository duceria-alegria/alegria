import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, CustomerService, ForbiddenError, LogLevel, Permission, RequestContext } from '@vendure/core';
import { SearchLogService } from './search-log.service';

interface RegistrarBusquedaInput {
    term: string;
    resultCount: number;
    visitorId: string;
}

@Resolver()
export class SearchLogResolver {
    constructor(
        private readonly searchLogService: SearchLogService,
        private readonly customerService: CustomerService,
    ) {}

    /**
     * La llama la tienda (no el navegador del cliente) cuando una búsqueda se asienta. Es pública
     * a nivel de permisos de Vendure, pero exige el secreto compartido en `x-search-log-key`; si la
     * petición trae la sesión del cliente, la búsqueda queda ligada a su cuenta.
     */
    @Mutation()
    @Allow(Permission.Public)
    async registrarBusqueda(@Ctx() ctx: RequestContext, @Args('input') input: RegistrarBusquedaInput): Promise<boolean> {
        if (!this.searchLogService.isAuthorized(ctx.req?.headers['x-search-log-key'])) {
            throw new ForbiddenError(LogLevel.Verbose);
        }
        const customer = ctx.activeUserId ? await this.customerService.findOneByUserId(ctx, ctx.activeUserId) : undefined;
        return this.searchLogService.record({
            term: input.term,
            resultCount: input.resultCount,
            visitorId: input.visitorId,
            languageCode: ctx.languageCode,
            customerId: customer?.id ?? null,
        });
    }
}
