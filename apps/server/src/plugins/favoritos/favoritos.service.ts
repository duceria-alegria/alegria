import { Injectable } from '@nestjs/common';
import { Customer, CustomerService, ForbiddenError, ID, ProductService, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { Favorito } from './favorito.entity';

@Injectable()
export class FavoritosService {
    constructor(
        private connection: TransactionalConnection,
        private customerService: CustomerService,
        private productService: ProductService,
    ) {}

    /** El cliente de la sesión; los favoritos son solo de clientes con sesión iniciada. */
    async clienteActivo(ctx: RequestContext): Promise<Customer> {
        const customer = ctx.activeUserId ? await this.customerService.findOneByUserId(ctx, ctx.activeUserId) : undefined;
        if (!customer) {
            throw new ForbiddenError();
        }
        return customer;
    }

    /** Ids de los productos favoritos del cliente, el más reciente primero. */
    async ids(ctx: RequestContext, customerId: ID): Promise<ID[]> {
        const filas = await this.connection.getRepository(ctx, Favorito).find({
            where: { customerId },
            order: { createdAt: 'DESC', id: 'DESC' },
        });
        return filas.map(fila => fila.productId);
    }

    /** Agrega un favorito; si ya estaba no hace nada. */
    async agregar(ctx: RequestContext, customerId: ID, productId: ID): Promise<ID[]> {
        const producto = await this.productService.findOne(ctx, productId);
        if (!producto?.enabled) {
            throw new UserInputError('error.entity-with-id-not-found', { entityName: 'Product', id: productId });
        }
        await this.connection
            .getRepository(ctx, Favorito)
            .createQueryBuilder()
            .insert()
            .values({ customerId, productId })
            .orIgnore()
            .execute();
        return this.ids(ctx, customerId);
    }

    async quitar(ctx: RequestContext, customerId: ID, productId: ID): Promise<ID[]> {
        await this.connection.getRepository(ctx, Favorito).delete({ customerId, productId });
        return this.ids(ctx, customerId);
    }
}
