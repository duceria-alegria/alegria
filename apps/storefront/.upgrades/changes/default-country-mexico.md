---
type: patch
areas:
  - account
  - checkout
  - tooling
---

## Intent

Preselect Mexico when a customer adds a new address, in the checkout shipping step and in the account address form, instead of the first country in the list.

## Invariants

- Editing an existing address keeps that address's own country.
- A guest who already has a shipping address on the order keeps the country of that address.
- The country field remains editable and required.
- When the store does not offer Mexico, the form falls back to the first available country rather than leaving the field empty.
- Resetting the checkout address form after saving restores the same default country.

## Integration guidance

Use `defaultCountryCode(countries)` from `components/ui/country-select` wherever a new address form chooses its initial country. Downstream stores that sell outside Mexico should change `DEFAULT_COUNTRY_CODE` in that module instead of editing each form.

## Verification

- Open the checkout shipping step as a signed-in customer with no saved addresses, add an address, and confirm the country field starts as Mexico.
- Open the account addresses page, add an address, and confirm the country field starts as Mexico.
- Edit a saved address in another country and confirm that country is kept.
- Run the storefront checks and type check.
