---
type: minor
areas:
  - checkout
  - orders
  - tooling
---

## Intent

Offer Mercado Pago as a payment method in the checkout. The customer chooses how to pay inside Mercado Pago (card or SPEI) and sees the Mercado Pago fee, which only applies to wholesale price lists, before paying. The order is not closed in the storefront: the customer is sent to Mercado Pago and returns to the order page, which shows whether the payment is being confirmed, was not completed, was rejected, is under review or is confirmed.

## Invariants

- Mercado Pago is hidden from the payment step unless the server returns payment options for the active order, so stores without the server plugin or without credentials show no broken option.
- Other payment methods keep placing the order exactly as before.
- The customer always sees the fee and the total to pay before leaving for Mercado Pago, in the order summary and in the review step. Retail price-list customers see no fee.
- The order stays open until the server confirms the payment with Mercado Pago; the storefront never marks an order as paid by itself.
- The order page never shows "order confirmed" for an order that has no registered payment.
- After a Mercado Pago payment is confirmed the cart badge in the header is refreshed.
- Returning to the order page checks the payment with the server, so the order confirms even if the server webhook has not arrived yet.

## Integration guidance

Add the `mercadopago` module (`MERCADOPAGO_METHOD`, `visiblePaymentMethods`, `mercadoPagoFee`) and the `GetMercadoPagoOptions` / `CreateMercadoPagoPayment` operations next to the existing checkout code, load the options in the checkout page, and keep the selected option in the checkout context. `placeOrder` takes the chosen Mercado Pago option and redirects to the payment URL returned by the server instead of calling `addPaymentToOrder`. Keep downstream payment-step styling, but preserve the fee rows in the order summary. On the order page keep the pending, not-paid, rejected and review states (`payment-view.ts`) and the polling and cart refresh components, and regenerate `graphql-env.d.ts` against a server that has the Mercado Pago plugin.

## Verification

- With the server plugin configured, choose Mercado Pago in the payment step and confirm card and SPEI appear, with the fee only for a wholesale customer.
- Confirm the summary and review step show the fee and the total to pay, and that the button reads "Pay with Mercado Pago".
- Place the order and confirm the browser goes to Mercado Pago; pay with a Mercado Pago test card and confirm the order page moves from "Confirming your payment" to "Order confirmed" and shows the fee.
- Return from Mercado Pago without paying and confirm the order page offers to go back to payment.
- Without credentials on the server, confirm Mercado Pago does not appear in the payment step.
- Run the storefront checks, type check and tests.
