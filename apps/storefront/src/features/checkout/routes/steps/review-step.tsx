'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, Truck, CreditCard, Edit, Mail, Store } from 'lucide-react';
import { useCheckout } from '../checkout-provider';
import { placeOrder as placeOrderAction } from '../actions';
import { Price } from '@/features/pricing/price';
import { isPickupShippingMethod } from '../../pickup';
import {useTranslations} from 'next-intl';

interface ReviewStepProps {
  onEditStep: (step: 'contact' | 'shipping' | 'delivery' | 'payment') => void;
}

export default function ReviewStep({ onEditStep }: ReviewStepProps) {
  const t = useTranslations('Checkout');
  const { order, paymentMethods, selectedPaymentMethodCode, isGuest, deliveryMode } = useCheckout();
  const [loading, setLoading] = useState(false);

  const selectedPaymentMethod = paymentMethods.find(
    (method) => method.code === selectedPaymentMethodCode
  );

  const isPickup = deliveryMode === 'pickup';
  const shippingLine = order.shippingLines?.[0];
  // The order's shipping line must match the chosen mode: a customer who switched modes
  // after picking a method may still have the other mode's method on the order.
  const fulfilmentReady = !!shippingLine && (
    isPickup
      ? isPickupShippingMethod(shippingLine.shippingMethod)
      : !isPickupShippingMethod(shippingLine.shippingMethod) && !!order.shippingAddress
  );
  const cardCount = (isGuest ? 1 : 0) + (isPickup ? 1 : 2) + 1;
  const gridColumns = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
  }[cardCount];

  const handlePlaceOrder = async () => {
    if (!selectedPaymentMethodCode) return;

    setLoading(true);
    try {
      await placeOrderAction(selectedPaymentMethodCode);
    } catch (error) {
      if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
        throw error;
      }
      console.error('Error placing order:', error);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="font-semibold text-lg">{t('reviewYourOrder')}</h3>

      <div className={`grid grid-cols-1 gap-6 ${gridColumns}`}>
        {isGuest && order.customer && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <h4 className="font-medium">{t('contact')}</h4>
            </div>
            <div className="text-sm space-y-3">
              <div>
                <p className="font-medium">
                  {order.customer.firstName} {order.customer.lastName}
                </p>
                <p className="text-muted-foreground">{order.customer.emailAddress}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditStep('contact')}
              >
                <Edit className="h-4 w-4 mr-1" />
                {t('edit')}
              </Button>
            </div>
          </div>
        )}

        {isPickup ? (
          /* Pickup (no address, no separate delivery method) */
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-muted-foreground" />
              <h4 className="font-medium">{t('pickupInStore')}</h4>
            </div>
            {shippingLine ? (
              <div className="text-sm space-y-3">
                <div>
                  <p className="font-medium">{shippingLine.shippingMethod.name}</p>
                  {shippingLine.shippingMethod.description && (
                    <div
                      className="text-muted-foreground mt-1 [&_p+p]:mt-1"
                      dangerouslySetInnerHTML={{ __html: shippingLine.shippingMethod.description }}
                    />
                  )}
                  <p className="text-muted-foreground">
                    {shippingLine.priceWithTax === 0
                      ? t('free')
                      : <Price value={shippingLine.priceWithTax} currencyCode={order.currencyCode} />}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditStep('shipping')}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  {t('edit')}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noDeliveryMethod')}</p>
            )}
          </div>
        ) : (
          <>
          {/* Shipping Address */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <h4 className="font-medium">{t('shippingAddress')}</h4>
            </div>
            {order.shippingAddress ? (
              <div className="text-sm space-y-3">
                <div>
                  <p className="font-medium">{order.shippingAddress.fullName}</p>
                  <p className="text-muted-foreground">
                    {order.shippingAddress.streetLine1}
                    {order.shippingAddress.streetLine2 && `, ${order.shippingAddress.streetLine2}`}
                  </p>
                  <p className="text-muted-foreground">
                    {order.shippingAddress.city}, {order.shippingAddress.province} {order.shippingAddress.postalCode}
                  </p>
                  <p className="text-muted-foreground">{order.shippingAddress.country}</p>
                  <p className="text-muted-foreground">{order.shippingAddress.phoneNumber}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditStep('shipping')}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  {t('edit')}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noShippingAddress')}</p>
            )}
          </div>

          {/* Delivery Method */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-muted-foreground" />
              <h4 className="font-medium">{t('deliveryMethod')}</h4>
            </div>
            {order.shippingLines && order.shippingLines.length > 0 ? (
              <div className="text-sm space-y-3">
                <div>
                  <p className="font-medium">{order.shippingLines[0].shippingMethod.name}</p>
                  <p className="text-muted-foreground">
                    {order.shippingLines[0].priceWithTax === 0
                      ? t('free')
                      : <Price value={order.shippingLines[0].priceWithTax} currencyCode={order.currencyCode} />}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditStep('delivery')}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  {t('edit')}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noDeliveryMethod')}</p>
            )}
          </div>
          </>
        )}

        {/* Payment Method */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <h4 className="font-medium">{t('paymentMethod')}</h4>
          </div>
          {selectedPaymentMethod ? (
            <div className="text-sm space-y-3">
              <div>
                <p className="font-medium">{selectedPaymentMethod.name}</p>
                {selectedPaymentMethod.description && (
                  <p className="text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: selectedPaymentMethod.description }} />
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditStep('payment')}
              >
                <Edit className="h-4 w-4 mr-1" />
                {t('edit')}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noPaymentMethod')}</p>
          )}
        </div>
      </div>

      <Button
        onClick={handlePlaceOrder}
        disabled={loading || !fulfilmentReady || !selectedPaymentMethodCode}
        size="lg"
        className="w-full"
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('placeOrder')}
      </Button>

      {(!fulfilmentReady || !selectedPaymentMethodCode) && (
        <p className="text-sm text-destructive text-center">
          {t('completeAllSteps')}
        </p>
      )}
    </div>
  );
}
