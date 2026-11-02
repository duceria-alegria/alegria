/** Store contact details shown in the footer; any value left unset is simply not rendered. */
export const CONTACT = {
    phone: process.env.NEXT_PUBLIC_CONTACT_PHONE,
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
    address: process.env.NEXT_PUBLIC_CONTACT_ADDRESS,
    hours: process.env.NEXT_PUBLIC_CONTACT_HOURS,
};
