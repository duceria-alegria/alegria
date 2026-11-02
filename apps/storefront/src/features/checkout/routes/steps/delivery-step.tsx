'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Loader2, Store, Truck } from 'lucide-react';
import { useRouter } from '@/platform/i18n/navigation';
import { useCheckout } from '../checkout-provider';
import { setShippingMethod as setShippingMethodAction, setPickupMethod as setPickupMethodAction } from '../actions';
import {useTranslations, useLocale} from 'next-intl';
import {toIntlLocale} from '@/platform/i18n/locale-utils';

interface DeliveryStepProps {
  onComplete: () => void;
  /** List the in-store pickup methods instead of the ones that ship to an address. */
  pickup?: boolean;
}

export default function DeliveryStep({ onComplete, pickup = false }: DeliveryStepProps) {
  const t = useTranslations('Checkout');
  const locale = useLocale();
  const intlLocale = toIntlLocale(locale);
  const router = useRouter();
  const { shippingMethods, pickupMethods, order } = useCheckout();
  const methods = pickup ? pickupMethods : shippingMethods;
  const MethodIcon = pickup ? Store : Truck;
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(() => {
    const currentId = order.shippingLines?.[0]?.shippingMethod.id;
    if (currentId && methods.some((method) => method.id === currentId)) {
      return currentId;
    }
    return methods.length === 1 ? methods[0].id : null;
  });
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!selectedMethodId) return;

    setSubmitting(true);
    try {
      await (pickup ? setPickupMethodAction : setShippingMethodAction)(selectedMethodId);
      router.refresh();
      onComplete();
    } catch (error) {
      console.error('Error setting shipping method:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (methods.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{t('noShippingMethods')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="font-semibold">{pickup ? t('selectPickupMethod') : t('selectShippingMethod')}</h3>

      <RadioGroup value={selectedMethodId || ''} onValueChange={setSelectedMethodId}>
        {methods.map((method) => (
          <Label key={method.id} htmlFor={method.id} className="cursor-pointer">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <RadioGroupItem value={method.id} id={method.id} />
                  <MethodIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{method.name}</p>
                    {method.description && (
                      <div
                        className="text-sm text-muted-foreground mt-1 [&_p+p]:mt-1"
                        dangerouslySetInnerHTML={{ __html: method.description }}
                      />
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold">
                    {method.priceWithTax === 0
                      ? t('free')
                      : (method.priceWithTax / 100).toLocaleString(intlLocale, {
                          style: 'currency',
                          currency: 'USD',
                        })}
                  </p>
                </div>
              </div>
            </Card>
          </Label>
        ))}
      </RadioGroup>

      <Button
        onClick={handleContinue}
        disabled={!selectedMethodId || submitting}
        className="w-full"
      >
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('continueToPayment')}
      </Button>
    </div>
  );
}
