import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Check, CircleAlert, CircleX, Clock, ShoppingBag, ClipboardList, Landmark} from 'lucide-react';
import { Link } from '@/platform/i18n/navigation';
import Image from 'next/image';
import { NO_IMAGE_SRC } from '@/lib/no-image';
import {Separator} from '@/components/ui/separator';
import {Price} from '@/features/pricing/price';
import {notFound} from 'next/navigation';
import {getRouteLocale} from '@/platform/i18n/server';
import {getTranslations} from 'next-intl/server';
import {mutate, query} from '@/platform/vendure/api';
import {graphql} from '@/platform/vendure/graphql';
import {isPickupShippingMethod} from '@/features/checkout/pickup';
import {MERCADOPAGO_METHOD} from '@/features/checkout/mercadopago';
import {bankTransferDetails, isPendingBankTransfer} from '../bank-transfer';
import {LiveOrderUpdates} from '../live-order-updates';
import {MercadoPagoConfirming, RefreshCartOnPaid} from '../mercadopago-status';
import {isUnpaidOrder, mercadoPagoCharge, paymentView, type PaymentView} from '../payment-view';

const GetOrderByCodeQuery = graphql(`
    query GetOrderByCode($code: String!) {
        orderByCode(code: $code) {
            id
            code
            state
            totalWithTax
            currencyCode
            lines {
                id
                productVariant {
                    id
                    name
                    product {
                        id
                        name
                        slug
                        featuredAsset {
                            id
                            preview
                        }
                    }
                }
                quantity
                linePriceWithTax
            }
            shippingAddress {
                fullName
                streetLine1
                streetLine2
                city
                province
                postalCode
                country
            }
            shippingLines {
                shippingMethod {
                    code
                    name
                    description
                }
            }
            payments {
                method
                state
                amount
                metadata
            }
        }
    }
`);

const VerifyMercadoPagoPaymentMutation = graphql(`
    mutation VerifyMercadoPagoPayment($code: String!) {
        verificarPagoMercadoPago(codigoPedido: $code) {
            estado
        }
    }
`);

/**
 * Estado del cobro con Mercado Pago de un pedido que aún no está pagado. Al regresar de Mercado Pago el aviso
 * del servidor puede no haber llegado (o no poder llegar, como en desarrollo): esta llamada busca el pago
 * directo en Mercado Pago y lo registra si ya está aprobado. Si el servidor no responde, se trata como
 * "sin pago" en lugar de romper la página.
 */
async function verifyMercadoPagoPayment(code: string): Promise<string | undefined> {
    try {
        const {data} = await mutate(VerifyMercadoPagoPaymentMutation, {code}, {useAuthToken: true});
        return data.verificarPagoMercadoPago.estado;
    } catch {
        return undefined;
    }
}

const STATUS_HEADERS: Record<Exclude<PaymentView, 'confirmed'>, {
    icon: typeof Clock;
    title: 'mpConfirmingTitle' | 'mpNotPaidTitle' | 'mpRejectedTitle' | 'mpReviewTitle';
    text: 'mpConfirmingText' | 'mpNotPaidText' | 'mpRejectedText' | 'mpReviewText';
    tone: string;
}> = {
    confirming: {icon: Clock, title: 'mpConfirmingTitle', text: 'mpConfirmingText', tone: 'bg-primary text-primary-foreground shadow-primary/25'},
    notPaid: {icon: CircleAlert, title: 'mpNotPaidTitle', text: 'mpNotPaidText', tone: 'bg-amber-500 text-white shadow-amber-500/25'},
    rejected: {icon: CircleX, title: 'mpRejectedTitle', text: 'mpRejectedText', tone: 'bg-destructive text-white shadow-destructive/25'},
    review: {icon: CircleAlert, title: 'mpReviewTitle', text: 'mpReviewText', tone: 'bg-amber-500 text-white shadow-amber-500/25'},
};

interface OrderConfirmationProps {
    paramsPromise: Promise<{ locale: string; code: string }>;
}

export async function OrderConfirmation({paramsPromise}: OrderConfirmationProps) {
    const {code} = await paramsPromise;
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'OrderConfirmation'});

    const {data} = await query(GetOrderByCodeQuery, {code}, {useAuthToken: true});
    let order = data.orderByCode;

    if (!order) {
        notFound();
    }

    // Pedido sin pagar: el cliente regresó de Mercado Pago (o abrió el enlace) antes de que se registre el pago.
    let mercadoPagoStatus: string | undefined;
    if (isUnpaidOrder(order.state)) {
        mercadoPagoStatus = await verifyMercadoPagoPayment(code);
        if (mercadoPagoStatus === 'aplicado') {
            // Se acaba de registrar: se vuelve a leer el pedido para mostrarlo ya pagado.
            order = (await query(GetOrderByCodeQuery, {code}, {useAuthToken: true})).data.orderByCode ?? order;
        }
    }
    const view = paymentView(order.state, mercadoPagoStatus);
    const statusHeader = view === 'confirmed' ? undefined : STATUS_HEADERS[view];

    const mercadoPagoPayment = order.payments?.find(
        (payment) => payment.method === MERCADOPAGO_METHOD && payment.state === 'Settled',
    );
    const mercadoPagoFee = mercadoPagoPayment ? mercadoPagoCharge(mercadoPagoPayment.metadata) : undefined;

    const pendingTransfer = order.payments?.find(isPendingBankTransfer);
    const transfer = pendingTransfer ? bankTransferDetails(pendingTransfer.metadata) : undefined;

    const pickupLine = order.shippingLines.find((line) => isPickupShippingMethod(line.shippingMethod));

    return (
        <div className="container mx-auto px-4 py-16">
            <LiveOrderUpdates code={order.code}/>
            {mercadoPagoPayment && <RefreshCartOnPaid/>}
            <div className="max-w-3xl mx-auto">
                {statusHeader ? (
                    <div className="text-center mb-10 space-y-3">
                        <div className="flex justify-center mb-6">
                            <div className={`rounded-full p-5 shadow-lg ${statusHeader.tone}`}>
                                <statusHeader.icon className="h-10 w-10" strokeWidth={2.5} aria-hidden="true" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold">{t(statusHeader.title)}</h1>
                        <p className="text-muted-foreground">
                            {t('orderNumber')}{' '}
                            <span className="font-semibold text-foreground">{order.code}</span>
                        </p>
                        <p className="mx-auto max-w-prose text-sm text-muted-foreground">{t(statusHeader.text)}</p>
                        {view === 'confirming' && <MercadoPagoConfirming/>}
                        {(view === 'notPaid' || view === 'rejected') && (
                            <div className="pt-2">
                                <Button nativeButton={false} render={<Link href="/checkout" />} size="lg">
                                    {t('backToPayment')}
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center mb-10">
                        <div className="flex justify-center mb-6">
                            <div className="rounded-full bg-primary p-5 shadow-lg shadow-primary/25">
                                <Check className="h-10 w-10 text-primary-foreground" strokeWidth={3} />
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold mb-2">{t('orderConfirmed')}</h1>
                        <p className="text-muted-foreground">
                            {t('thankYou')}{' '}
                            <span className="font-semibold text-foreground">{order.code}</span>
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('emailConfirmation')}
                        </p>
                    </div>
                )}

                {pendingTransfer && transfer && (
                    <Card className="mb-6 border-primary">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Landmark className="h-5 w-5" />
                                {t('transferTitle')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground">{t('transferIntro')}</p>
                            <div className="flex justify-between items-baseline">
                                <span className="text-sm text-muted-foreground">{t('transferAmount')}</span>
                                <span className="font-bold">
                                    <Price value={pendingTransfer.amount} currencyCode={order.currencyCode}/>
                                </span>
                            </div>
                            <div className="flex justify-between items-baseline">
                                <span className="text-sm text-muted-foreground">{t('transferReference')}</span>
                                <span className="font-mono font-semibold">{transfer.reference ?? order.code}</span>
                            </div>
                            {transfer.instructions && (
                                <>
                                    <Separator/>
                                    <p className="text-sm whitespace-pre-line">{transfer.instructions}</p>
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{t('orderSummary')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {order.lines.map((line) => (
                            <div key={line.id} className="flex gap-4 items-center">
                                <div className="flex-shrink-0">
                                    <Image
                                        src={line.productVariant.product.featuredAsset?.preview ?? NO_IMAGE_SRC}
                                        alt={line.productVariant.name}
                                        width={80}
                                        height={80}
                                        className="rounded-lg object-cover h-20 w-20 object-center"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium">{line.productVariant.product.name}</p>
                                    {line.productVariant.name !== line.productVariant.product.name && (
                                        <p className="text-sm text-muted-foreground">
                                            {line.productVariant.name}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-0.5">{t('qty', {quantity: line.quantity})}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold">
                                        <Price value={line.linePriceWithTax} currencyCode={order.currencyCode}/>
                                    </p>
                                </div>
                            </div>
                        ))}

                        <Separator/>

                        <div className="flex justify-between items-baseline font-bold text-lg">
                            <span>{t('total')}</span>
                            <span className="text-xl">
                                <Price value={order.totalWithTax} currencyCode={order.currencyCode}/>
                            </span>
                        </div>

                        {mercadoPagoFee && (
                            <>
                                <div className="flex justify-between items-baseline text-sm">
                                    <span className="text-muted-foreground">{t('mpFeeLine')}</span>
                                    <span>
                                        <Price value={mercadoPagoFee.fee} currencyCode={order.currencyCode}/>
                                    </span>
                                </div>
                                <div className="flex justify-between items-baseline font-bold">
                                    <span>{t('mpTotalCharged')}</span>
                                    <span>
                                        <Price value={mercadoPagoFee.total} currencyCode={order.currencyCode}/>
                                    </span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {pickupLine && (
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle>{t('pickupTitle')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="font-medium">{pickupLine.shippingMethod.name}</p>
                            {pickupLine.shippingMethod.description && (
                                <div
                                    className="text-sm text-muted-foreground mt-1 [&_p+p]:mt-1"
                                    dangerouslySetInnerHTML={{__html: pickupLine.shippingMethod.description}}
                                />
                            )}
                        </CardContent>
                    </Card>
                )}

                {!pickupLine && order.shippingAddress && (
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle>{t('shippingAddress')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="font-medium">{order.shippingAddress.fullName}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {order.shippingAddress.streetLine1}
                                {order.shippingAddress.streetLine2 && `, ${order.shippingAddress.streetLine2}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {order.shippingAddress.city}, {order.shippingAddress.province}{' '}
                                {order.shippingAddress.postalCode}
                            </p>
                            <p className="text-sm text-muted-foreground">{order.shippingAddress.country}</p>
                        </CardContent>
                    </Card>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                    <Button nativeButton={false} render={<Link href="/" />} className="flex-1" size="lg">
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        {t('continueShopping')}
                    </Button>
                    <Button nativeButton={false} render={<Link href="/account/orders" />} variant="outline" className="flex-1" size="lg">
                        <ClipboardList className="mr-2 h-4 w-4" />
                        {t('viewOrders')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
