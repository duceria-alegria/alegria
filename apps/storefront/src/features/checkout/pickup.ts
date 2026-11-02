/**
 * In-store pickup is modelled as a regular Vendure shipping method with no address
 * requirement. A shipping method counts as pickup when its code is `pickup` or starts
 * with `pickup-` (e.g. `pickup`, `pickup-sucursal-centro`), so several pickup
 * locations can coexist.
 */
const PICKUP_CODE_PATTERN = /^pickup(-|$)/;

export function isPickupShippingMethod(method: {code: string}): boolean {
    return PICKUP_CODE_PATTERN.test(method.code);
}
