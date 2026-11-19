/** Dígitos de un teléfono nacional mexicano (lada + número). */
export const PHONE_LENGTH = 10;

/** Un teléfono válido son exactamente 10 dígitos, sin espacios, guiones ni clave de país. */
export const PHONE_PATTERN = /^\d{10}$/;

/**
 * Deja solo los dígitos de lo que escribe o pega el cliente y corta en 10, para que no se pueda capturar un
 * teléfono más largo. Si pegan el número con la clave de país (`+52 871 251 0098`, `+52 1 871…`) se quita,
 * porque cortar a ciegas se quedaría con los primeros 10 dígitos y guardaría un número equivocado.
 * Solo se quita con la longitud exacta de un número completo, así que al teclear nunca se confunde.
 */
export function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('521')) {
    digits = digits.slice(3);
  } else if (digits.length === 12 && digits.startsWith('52')) {
    digits = digits.slice(2);
  }
  return digits.slice(0, PHONE_LENGTH);
}
