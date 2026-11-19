---
type: patch
areas:
  - account
  - checkout
  - tooling
---

## Intent

Require a 10-digit phone number in every address form (checkout shipping step and account addresses) and stop customers from typing more than 10 digits, which is the usual length of a Mexican phone number.

## Invariants

- The phone field accepts digits only and never holds more than 10, whether typed or pasted.
- A number pasted with the country code (`+52 871 251 0098`) keeps its 10 national digits instead of being cut to the wrong digits.
- Fields that were required stay required, and optional fields stay optional but must have exactly 10 digits when filled in.
- The error message is translated in every supported language.
- Existing saved addresses and phone numbers are not changed or revalidated when selected.

## Integration guidance

Use `PhoneInput` from `components/ui/phone-input` for address phone fields together with the `PHONE_PATTERN` rule from `lib/phone`, so typing, pasting and validation stay consistent. Stores that need other phone lengths should change `PHONE_LENGTH` and `PHONE_PATTERN` in that module instead of editing each form.

## Verification

- Type or paste more than 10 digits in the phone field and confirm only 10 remain.
- Paste `+52 871 251 0098` and confirm the field shows `8712510098`.
- Submit a new address with fewer than 10 digits and confirm the translated error appears and nothing is saved.
- Add an address with a valid 10-digit phone and confirm it is saved.
- Run the storefront checks, type check and tests.
