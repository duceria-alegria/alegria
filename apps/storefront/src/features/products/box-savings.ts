interface BoxPricedVariant {
    id: string;
    priceWithTax: number;
    customFields?: {piezasPorCaja?: number | null} | null;
}

export interface BoxSavings {
    pieceVariantId: string;
    boxVariantId: string;
    /** How many pieces come in the box. */
    pieces: number;
    /** Price of one loose piece, in minor currency units. */
    piecePrice: number;
    /** What each piece costs when bought in the box (box price ÷ pieces), in minor currency units. */
    boxPricePerPiece: number;
    /** What is saved by buying the box instead of the same number of loose pieces, in minor units. */
    saving: number;
    /** `saving` as a whole percentage of the price of the loose pieces. */
    percent: number;
}

/**
 * Compares a product's box variant against its loose-piece variant for the prices the current
 * customer sees. The Shop API only returns the box to wholesale customers, so for anyone else
 * there is no box to compare and this returns null. It also returns null when the box is not
 * actually cheaper per piece, so the store never advertises a saving that does not exist.
 */
export function getBoxSavings(variants: BoxPricedVariant[]): BoxSavings | null {
    const boxOf = (variant: BoxPricedVariant) => variant.customFields?.piezasPorCaja ?? 0;
    const box = variants.find((variant) => boxOf(variant) >= 2);
    const piece = variants.find((variant) => boxOf(variant) === 0);
    if (!box || !piece) return null;

    const pieces = boxOf(box);
    const loosePrice = pieces * piece.priceWithTax;
    const saving = loosePrice - box.priceWithTax;
    if (saving <= 0) return null;

    return {
        pieceVariantId: piece.id,
        boxVariantId: box.id,
        pieces,
        piecePrice: piece.priceWithTax,
        boxPricePerPiece: box.priceWithTax / pieces,
        saving,
        percent: Math.round((saving / loosePrice) * 100),
    };
}
