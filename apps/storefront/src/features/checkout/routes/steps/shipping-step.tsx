'use client';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Store, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DeliveryMode, useCheckout } from '../checkout-provider';
import ShippingAddressStep from './shipping-address-step';
import DeliveryStep from './delivery-step';

interface ShippingStepProps {
  onComplete: () => void;
  onModeChange: (mode: DeliveryMode) => void;
}

/**
 * First fulfilment step. Without pickup methods it is just the address form. With them,
 * the customer first chooses between delivery to an address and in-store pickup; pickup
 * needs no address, so it picks the pickup method right here.
 */
export default function ShippingStep({ onComplete, onModeChange }: ShippingStepProps) {
  const t = useTranslations('Checkout');
  const { pickupMethods, deliveryMode } = useCheckout();

  if (pickupMethods.length === 0) {
    return <ShippingAddressStep onComplete={onComplete} />;
  }

  const options: { mode: DeliveryMode; label: string; Icon: typeof Truck }[] = [
    { mode: 'ship', label: t('shipToAddress'), Icon: Truck },
    { mode: 'pickup', label: t('pickupInStore'), Icon: Store },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="font-semibold">{t('howToReceive')}</h3>
        <RadioGroup
          value={deliveryMode}
          onValueChange={(value) => {
            if (value !== deliveryMode) onModeChange(value as DeliveryMode);
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          {options.map(({ mode, label, Icon }) => (
            <Label key={mode} htmlFor={`delivery-mode-${mode}`} className="cursor-pointer">
              <Card className={`p-4 ${deliveryMode === mode ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={mode} id={`delivery-mode-${mode}`} />
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <p className="font-medium">{label}</p>
                </div>
              </Card>
            </Label>
          ))}
        </RadioGroup>
      </div>

      {deliveryMode === 'pickup' ? (
        <DeliveryStep pickup onComplete={onComplete} />
      ) : (
        <ShippingAddressStep onComplete={onComplete} />
      )}
    </div>
  );
}
