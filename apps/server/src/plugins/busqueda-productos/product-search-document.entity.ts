import { EntityId, ID, LanguageCode } from '@vendure/core';
import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Texto de búsqueda ya normalizado de un producto en un idioma. Es un derivado del catálogo: lo
 * mantiene `ProductSearchDocumentService` y se puede borrar y reconstruir cuando sea. Los índices
 * de trigramas viven en la migración (TypeORM no sabe declarar `gin_trgm_ops`).
 */
@Entity()
export class ProductSearchDocument {
    constructor(input?: Partial<ProductSearchDocument>) {
        if (input) {
            Object.assign(this, input);
        }
    }

    @EntityId({ primary: true })
    productId: ID;

    @PrimaryColumn({ type: 'varchar' })
    languageCode: LanguageCode;

    @Column({ type: 'text' })
    nameNormalized: string;

    @Column({ type: 'text' })
    skusNormalized: string;

    @Column({ type: 'text' })
    documentNormalized: string;

    @Column({ type: 'text', default: '' })
    documentPhonetic: string;

    /** `SEARCH_TEXT_VERSION` con la que se generó este documento (si cambia, se reconstruye solo). */
    @Column({ type: 'int', default: 0 })
    textVersion: number;

    @UpdateDateColumn()
    updatedAt: Date;
}
