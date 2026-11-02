/** Shared look of the rounded, icon-led inputs on the sign-in and register forms. */
export const fieldClassName =
    'h-14 rounded-2xl border-[1.5px] border-input bg-card pl-[46px] text-base text-primary shadow-none ' +
    'focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-brand-yellow/50 md:text-base';

export const fieldIconClassName = 'pointer-events-none absolute left-4 top-[18px] z-10 size-5 text-muted-foreground';

export const fieldLabelClassName = 'text-sm font-extrabold';

/** Wraps an input with its icon so both grow together on focus. */
export const fieldWrapperClassName =
    'relative origin-center transition-transform duration-200 ease-out focus-within:scale-[1.03] motion-reduce:transition-none motion-reduce:focus-within:scale-100';
