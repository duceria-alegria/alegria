'use client';

import { createContext, useContext, ReactNode, useState } from 'react';
import { CheckoutOrder } from './types';
import { isPickupShippingMethod } from '../pickup';
import { MercadoPagoOption, mercadoPagoFee } from '../mercadopago';

interface CustomerAddress {
  id: string;
  fullName?: string | null;
  company?: string | null;
  streetLine1: string;
  streetLine2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country: { id: string; code: string; name: string };
  phoneNumber?: string | null;
  defaultShippingAddress?: boolean | null;
  defaultBillingAddress?: boolean | null;
}

interface Country {
  id: string;
  code: string;
  name: string;
}

interface ShippingMethod {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  priceWithTax: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isEligible: boolean;
  eligibilityMessage?: string | null;
}

export type DeliveryMode = 'ship' | 'pickup';

interface CheckoutContextType {
  order: CheckoutOrder;
  addresses: CustomerAddress[];
  countries: Country[];
  /** Eligible methods that ship to an address (everything except pickup). */
  shippingMethods: ShippingMethod[];
  /** Eligible in-store pickup methods. Empty when the shop offers no pickup. */
  pickupMethods: ShippingMethod[];
  deliveryMode: DeliveryMode;
  setDeliveryMode: (mode: DeliveryMode) => void;
  paymentMethods: PaymentMethod[];
  selectedPaymentMethodCode: string | null;
  setSelectedPaymentMethodCode: (code: string | null) => void;
  /** Formas de pagar dentro de Mercado Pago (vacío si no se ofrece). */
  mercadoPagoOptions: MercadoPagoOption[];
  selectedMercadoPagoOption: MercadoPagoOption | null;
  setSelectedMercadoPagoOptionId: (id: string) => void;
  /** Comisión y total a pagar cuando la opción elegida de Mercado Pago lleva comisión; si no, `null`. */
  paymentFee: {fee: number; total: number} | null;
  isGuest: boolean;
}

const CheckoutContext = createContext<CheckoutContextType | null>(null);

interface CheckoutProviderProps {
  children: ReactNode;
  order: CheckoutOrder;
  addresses: CustomerAddress[];
  countries: Country[];
  shippingMethods: ShippingMethod[];
  paymentMethods: PaymentMethod[];
  mercadoPagoOptions: MercadoPagoOption[];
  isGuest: boolean;
}

export function CheckoutProvider({
  children,
  order,
  addresses,
  countries,
  shippingMethods,
  paymentMethods,
  mercadoPagoOptions,
  isGuest,
}: CheckoutProviderProps) {
  const [selectedPaymentMethodCode, setSelectedPaymentMethodCode] = useState<string | null>(
    paymentMethods.length === 1 ? paymentMethods[0].code : null
  );
  const [mercadoPagoOptionId, setSelectedMercadoPagoOptionId] = useState<string | null>(null);
  // Si la elegida ya no existe (el servidor recalculó las opciones) se vuelve a la primera.
  const selectedMercadoPagoOption =
    mercadoPagoOptions.find((option) => option.id === mercadoPagoOptionId) ?? mercadoPagoOptions[0] ?? null;
  const paymentFee = mercadoPagoFee(selectedPaymentMethodCode, selectedMercadoPagoOption);
  const pickupMethods = shippingMethods.filter(isPickupShippingMethod);
  const deliveryMethods = shippingMethods.filter((method) => !isPickupShippingMethod(method));
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(() => {
    const currentMethod = order.shippingLines?.[0]?.shippingMethod;
    const isPickupOrder = !!currentMethod && isPickupShippingMethod(currentMethod);
    // Only resume in pickup mode while the shop still offers pickup; otherwise the
    // customer would be stuck with no way back to delivery.
    return isPickupOrder && pickupMethods.length > 0 ? 'pickup' : 'ship';
  });

  return (
    <CheckoutContext.Provider
      value={{
        order,
        addresses,
        countries,
        shippingMethods: deliveryMethods,
        pickupMethods,
        deliveryMode,
        setDeliveryMode,
        paymentMethods,
        selectedPaymentMethodCode,
        setSelectedPaymentMethodCode,
        mercadoPagoOptions,
        selectedMercadoPagoOption,
        setSelectedMercadoPagoOptionId,
        paymentFee,
        isGuest,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error('useCheckout must be used within CheckoutProvider');
  }
  return context;
}
