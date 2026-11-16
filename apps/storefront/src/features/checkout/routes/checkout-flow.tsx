'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import ContactStep from './steps/contact-step';
import ShippingStep from './steps/shipping-step';
import DeliveryStep from './steps/delivery-step';
import PaymentStep from './steps/payment-step';
import ReviewStep from './steps/review-step';
import OrderSummary from './order-summary';
import { DeliveryMode, useCheckout } from './checkout-provider';
import {useTranslations} from 'next-intl';

type CheckoutStep = 'contact' | 'shipping' | 'delivery' | 'payment' | 'review';

export default function CheckoutFlow() {
  const t = useTranslations('Checkout');
  const { order, isGuest, deliveryMode, setDeliveryMode } = useCheckout();

  const getStepOrder = (): CheckoutStep[] => {
    // Pickup needs no address or shipping method step: choosing the pickup method
    // happens inside the 'shipping' step.
    const fulfilmentSteps: CheckoutStep[] = deliveryMode === 'pickup' ? ['shipping'] : ['shipping', 'delivery'];
    const contactSteps: CheckoutStep[] = isGuest ? ['contact'] : [];
    return [...contactSteps, ...fulfilmentSteps, 'payment', 'review'];
  };

  const stepOrder = getStepOrder();

  const getInitialState = () => {
    const completed = new Set<CheckoutStep>();
    let current: CheckoutStep = stepOrder[0];

    if (isGuest) {
      if (order.customer?.emailAddress) {
        completed.add('contact');
        current = 'shipping';
      }
    }

    if (deliveryMode === 'pickup') {
      if (order.shippingLines && order.shippingLines.length > 0 && (!isGuest || completed.has('contact'))) {
        completed.add('shipping');
        current = 'payment';
      }
      return { completed, current };
    }

    if (order.shippingAddress?.streetLine1 && order.shippingAddress?.country) {
      if (!isGuest || completed.has('contact')) {
        completed.add('shipping');
        current = 'delivery';
      }
    }

    if (order.shippingLines && order.shippingLines.length > 0) {
      if (completed.has('shipping')) {
        completed.add('delivery');
        current = 'payment';
      }
    }

    return { completed, current };
  };

  const initialState = getInitialState();
  const [currentStep, setCurrentStep] = useState<CheckoutStep>(initialState.current);
  const [completedSteps, setCompletedSteps] = useState<Set<CheckoutStep>>(initialState.completed);

  const handleStepComplete = (step: CheckoutStep) => {
    setCompletedSteps(prev => new Set([...prev, step]));

    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const handleModeChange = (mode: DeliveryMode) => {
    setDeliveryMode(mode);
    // The fulfilment steps changed, so everything after contact has to be confirmed again.
    setCompletedSteps(prev => new Set<CheckoutStep>(prev.has('contact') ? ['contact'] : []));
    setCurrentStep('shipping');
  };

  const canAccessStep = (step: CheckoutStep): boolean => {
    const stepIndex = stepOrder.indexOf(step);

    if (stepIndex === 0) return true;

    const previousStep = stepOrder[stepIndex - 1];
    return completedSteps.has(previousStep);
  };

  const getStepNumber = (step: CheckoutStep): number => {
    return stepOrder.indexOf(step) + 1;
  };

  const stepLabels: Record<CheckoutStep, string> = {
    contact: t('steps.contact'),
    shipping: deliveryMode === 'pickup' ? t('steps.pickup') : t('steps.address'),
    delivery: t('steps.delivery'),
    payment: t('steps.payment'),
    review: t('steps.review'),
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        {/* Step Progress Indicator */}
        <div className="mb-8 hidden sm:block">
          <div className="flex items-center justify-between">
            {stepOrder.map((step, index) => (
              <div key={step} className="flex items-center flex-1 last:flex-0">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-all duration-300 ${
                      completedSteps.has(step)
                        ? 'bg-primary text-primary-foreground shadow-[var(--shadow-button)]'
                        : currentStep === step
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/25 shadow-[var(--shadow-button)]'
                        : 'bg-white text-primary ring-2 ring-primary/30 shadow-[var(--shadow-tile)]'
                    }`}
                  >
                    {completedSteps.has(step) ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      getStepNumber(step)
                    )}
                  </div>
                  <span className={`text-xs font-medium whitespace-nowrap ${
                    completedSteps.has(step) || currentStep === step
                      ? 'text-primary'
                      : 'text-primary/70'
                  }`}>
                    {stepLabels[step]}
                  </span>
                </div>
                {index < stepOrder.length - 1 && (
                  <div className="flex-1 mx-2 mb-5">
                    <div className={`h-1 w-full rounded-full transition-colors duration-300 ${
                      completedSteps.has(step) ? 'bg-primary' : 'bg-primary/20'
                    }`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <Accordion
          value={[currentStep]}
          onValueChange={(value) => {
            const step = value[0] as CheckoutStep | undefined;
            if (step && canAccessStep(step)) {
              setCurrentStep(step);
            }
          }}
          className="space-y-4"
        >
          {isGuest && (
            <AccordionItem value="contact" className="border border-primary/15 rounded-xl bg-white/85 px-6 shadow-[var(--shadow-tile)]">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                    completedSteps.has('contact')
                      ? 'bg-green-500 text-white'
                      : currentStep === 'contact'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white text-primary ring-2 ring-primary/30'
                  }`}>
                    {completedSteps.has('contact') ? '✓' : getStepNumber('contact')}
                  </div>
                  <span className="text-lg font-semibold">{t('contactInformation')}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-1.5 pt-4 pb-5">
                <ContactStep
                  onComplete={() => handleStepComplete('contact')}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem
            value="shipping"
            className="border border-primary/15 rounded-xl bg-white/85 px-6 shadow-[var(--shadow-tile)]"
            disabled={!canAccessStep('shipping')}
          >
            <AccordionTrigger
              className="hover:no-underline"
              disabled={!canAccessStep('shipping')}
            >
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                  completedSteps.has('shipping')
                    ? 'bg-green-500 text-white'
                    : currentStep === 'shipping'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white text-primary ring-2 ring-primary/30'
                }`}>
                  {completedSteps.has('shipping') ? '✓' : getStepNumber('shipping')}
                </div>
                <span className="text-lg font-semibold">
                  {deliveryMode === 'pickup' ? t('pickupInStore') : t('shippingAddress')}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-1.5 pt-4 pb-5">
              <ShippingStep
                onComplete={() => handleStepComplete('shipping')}
                onModeChange={handleModeChange}
              />
            </AccordionContent>
          </AccordionItem>

          {deliveryMode === 'ship' && (
            <AccordionItem
              value="delivery"
              className="border border-primary/15 rounded-xl bg-white/85 px-6 shadow-[var(--shadow-tile)]"
              disabled={!canAccessStep('delivery')}
            >
              <AccordionTrigger
                className="hover:no-underline"
                disabled={!canAccessStep('delivery')}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                    completedSteps.has('delivery')
                      ? 'bg-green-500 text-white'
                      : currentStep === 'delivery'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white text-primary ring-2 ring-primary/30'
                  }`}>
                    {completedSteps.has('delivery') ? '✓' : getStepNumber('delivery')}
                  </div>
                  <span className="text-lg font-semibold">{t('deliveryMethod')}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-1.5 pt-4 pb-5">
                <DeliveryStep
                  onComplete={() => handleStepComplete('delivery')}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem
            value="payment"
            className="border border-primary/15 rounded-xl bg-white/85 px-6 shadow-[var(--shadow-tile)]"
            disabled={!canAccessStep('payment')}
          >
            <AccordionTrigger
              className="hover:no-underline"
              disabled={!canAccessStep('payment')}
            >
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                  completedSteps.has('payment')
                    ? 'bg-green-500 text-white'
                    : currentStep === 'payment'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white text-primary ring-2 ring-primary/30'
                }`}>
                  {completedSteps.has('payment') ? '✓' : getStepNumber('payment')}
                </div>
                <span className="text-lg font-semibold">{t('paymentMethod')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-1.5 pt-4 pb-5">
              <PaymentStep
                onComplete={() => handleStepComplete('payment')}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="review"
            className="border border-primary/15 rounded-xl bg-white/85 px-6 shadow-[var(--shadow-tile)]"
            disabled={!canAccessStep('review')}
          >
            <AccordionTrigger
              className="hover:no-underline"
              disabled={!canAccessStep('review')}
            >
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                  currentStep === 'review'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white text-primary ring-2 ring-primary/30'
                }`}>
                  {getStepNumber('review')}
                </div>
                <span className="text-lg font-semibold">{t('reviewAndPlaceOrder')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-1.5 pt-4 pb-5">
              <ReviewStep
                onEditStep={setCurrentStep}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="lg:col-span-1">
        <OrderSummary />
      </div>
    </div>
  );
}
