'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { normalizePhone } from '@/lib/phone';

/**
 * Campo de teléfono: teclado numérico y solo admite dígitos, hasta 10 (ver `normalizePhone`). Se limpia el
 * valor del campo antes de avisar al formulario, así `react-hook-form` (`register`) y los formularios
 * controlados reciben siempre el valor ya limpio.
 */
function PhoneInput({ onChange, ...props }: React.ComponentProps<'input'>) {
  return (
    <Input
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      {...props}
      onChange={(event) => {
        event.target.value = normalizePhone(event.target.value);
        onChange?.(event);
      }}
    />
  );
}

export { PhoneInput };
