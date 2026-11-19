'use client';

import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';
import { useCheckout } from '../checkout-provider';
import { MERCADOPAGO_METHOD } from '../../mercadopago';
import { Price } from '@/features/pricing/price';
import {useTranslations} from 'next-intl';

interface PaymentStepProps {
  onComplete: () => void;
}

export default function PaymentStep({ onComplete }: PaymentStepProps) {
  const t = useTranslations('Checkout');
  const {
    order,
    paymentMethods,
    selectedPaymentMethodCode,
    setSelectedPaymentMethodCode,
    mercadoPagoOptions,
    selectedMercadoPagoOption,
    setSelectedMercadoPagoOptionId,
  } = useCheckout();

  const handleContinue = () => {
    if (!selectedPaymentMethodCode) return;
    onComplete();
  };

  if (paymentMethods.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{t('noPaymentMethods')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="font-semibold">{t('selectPaymentMethod')}</h3>

      <RadioGroup value={selectedPaymentMethodCode || ''} onValueChange={setSelectedPaymentMethodCode}>
        {paymentMethods.map((method) => (
          <div key={method.code} className="space-y-2">
            <Label htmlFor={method.code} className="cursor-pointer">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={method.code} id={method.code} />
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{method.name}</p>
                    {method.description && (
                      <p className="text-sm text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: method.description }} />
                    )}
                  </div>
                </div>
              </Card>
            </Label>

            {method.code === MERCADOPAGO_METHOD && selectedPaymentMethodCode === MERCADOPAGO_METHOD && (
              <fieldset className="space-y-2 pl-4 sm:pl-8">
                <legend className="mb-2 text-sm font-medium">{t('mercadoPagoChoose')}</legend>
                {mercadoPagoOptions.map((option) => {
                  const checked = selectedMercadoPagoOption?.id === option.id;
                  return (
                    <label
                      key={option.id}
                      htmlFor={`mercadopago-${option.id}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
                    >
                      <input
                        type="radio"
                        id={`mercadopago-${option.id}`}
                        name="mercadopago-option"
                        value={option.id}
                        checked={checked}
                        onChange={() => setSelectedMercadoPagoOptionId(option.id)}
                        className="mt-1 h-4 w-4 accent-primary"
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-medium">{option.nombre}</span>
                        <span className="block text-xs text-muted-foreground">{option.descripcion}</span>
                      </span>
                      <span className="text-right text-sm">
                        {option.cobraComision ? (
                          <>
                            <span className="block text-xs text-muted-foreground">
                              {t('mercadoPagoFee')} <Price value={option.comision} currencyCode={order.currencyCode} />
                            </span>
                            <span className="block font-semibold">
                              {t('mercadoPagoTotalToPay')} <Price value={option.total} currencyCode={order.currencyCode} />
                            </span>
                          </>
                        ) : (
                          <span className="text-xs font-medium text-green-700">{t('mercadoPagoNoFee')}</span>
                        )}
                      </span>
                    </label>
                  );
                })}
                {mercadoPagoOptions.some((option) => option.cobraComision) && (
                  <p className="text-xs text-muted-foreground">{t('mercadoPagoFeeNote')}</p>
                )}
                <p className="text-xs text-muted-foreground">{t('mercadoPagoRedirectNote')}</p>
              </fieldset>
            )}
          </div>
        ))}
      </RadioGroup>

      <Button
        onClick={handleContinue}
        disabled={!selectedPaymentMethodCode}
        className="w-full"
      >
        {t('continueToReview')}
      </Button>
    </div>
  );
}
