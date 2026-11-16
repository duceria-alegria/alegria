'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {ChevronDown} from 'lucide-react';
import {Slider} from '@/components/ui/slider';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Button} from '@/components/ui/button';
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from '@/components/ui/collapsible';
import {useFormatPrice} from '@/features/pricing/price';

/** Posiciones de la barra: 0 es el precio más bajo y STEPS el más alto (cada paso del teclado es una posición). */
const STEPS = 200;

// Casi todo el catálogo cuesta unos pocos pesos y unos cuantos artículos cuestan miles: con una barra
// lineal las dos terceras partes del recorrido quedarían vacías. La curva cúbica da más espacio a los
// precios bajos sin dejar de llegar al más caro.
const CURVE = 3;

interface PriceBounds {
    /** Precio más bajo y más alto del catálogo, en centavos. */
    min: number;
    max: number;
}

interface PriceRangeFilterProps {
    bounds: PriceBounds;
    /** Rango elegido en la URL, en pesos. Sin valor = ese extremo no está limitado. */
    selected: {min?: number; max?: number};
    /** Aplica el rango (en pesos); `undefined` en un extremo lo quita. */
    onApply: (range: {min?: number; max?: number}) => void;
}

const positionToCents = (position: number, {min, max}: PriceBounds) =>
    min + (max - min) * (position / STEPS) ** CURVE;

const centsToPosition = (cents: number, {min, max}: PriceBounds) =>
    Math.round(STEPS * ((Math.min(Math.max(cents, min), max) - min) / (max - min)) ** (1 / CURVE));

/** Centavos a pesos enteros para los valores que se eligen con la barra; los extremos del catálogo se respetan tal cual. */
function snapToPesos(cents: number, bounds: PriceBounds) {
    if (cents <= bounds.min) return bounds.min;
    if (cents >= bounds.max) return bounds.max;
    return Math.min(Math.max(Math.round(cents / 100) * 100, bounds.min), bounds.max);
}

const toPesosText = (cents: number) => String(Math.round(cents) / 100);

function PriceRangeControls({bounds, selected, onApply}: PriceRangeFilterProps) {
    const t = useTranslations('Filters');
    const formatPrice = useFormatPrice();
    // El panel está dos veces en la página (escritorio y hoja del celular): los id no pueden repetirse.
    const idPrefix = useId();
    const clampToBounds = (cents: number) => Math.min(Math.max(cents, bounds.min), bounds.max);
    const fromPesos = (pesos: number | undefined, fallback: number) =>
        pesos === undefined ? fallback : clampToBounds(Math.round(pesos * 100));

    // La posición de la barra es la que se guarda (no el precio): si se derivara del precio redondeado
    // a pesos, los primeros pasos de la barra se "regresarían" al precio más bajo y no se podría mover.
    const [positions, setPositions] = useState<[number, number]>(() => {
        const low = centsToPosition(fromPesos(selected.min, bounds.min), bounds);
        const high = centsToPosition(fromPesos(selected.max, bounds.max), bounds);
        return [Math.min(low, high), high];
    });
    const priceOf = (position: number) => snapToPesos(positionToCents(position, bounds), bounds);
    // Un precio exacto (el de la URL o el escrito en una caja) se conserva hasta que se mueve esa perilla;
    // la barra tiene pocas posiciones y sin esto se mostraría el precio de la posición más cercana.
    const [pinned, setPinned] = useState<[number | null, number | null]>(() => [
        selected.min === undefined ? null : fromPesos(selected.min, bounds.min),
        selected.max === undefined ? null : fromPesos(selected.max, bounds.max),
    ]);
    const range: [number, number] = [pinned[0] ?? priceOf(positions[0]), pinned[1] ?? priceOf(positions[1])];
    // Lo que se está escribiendo en las cajas; `null` = mostrar el precio de la barra.
    const [typed, setTyped] = useState<[string | null, string | null]>([null, null]);
    const shown = (index: 0 | 1) => typed[index] ?? toPesosText(range[index]);

    const apply = (low: number, high: number) =>
        onApply({
            min: low > bounds.min ? low / 100 : undefined,
            max: high < bounds.max ? high / 100 : undefined,
        });

    const onSlide = (next: number | readonly number[]) => {
        if (typeof next === 'number') return;
        setTyped([null, null]);
        setPinned([next[0] === positions[0] ? pinned[0] : null, next[1] === positions[1] ? pinned[1] : null]);
        setPositions([next[0], next[1]]);
    };

    // Con el teclado cada pulsación "suelta" la barra: se espera un momento para aplicar solo el valor final.
    const applyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => () => clearTimeout(applyTimer.current), []);
    const onSlideCommitted = (next: number | readonly number[]) => {
        if (typeof next === 'number') return;
        const low = pinned[0] !== null && next[0] === positions[0] ? pinned[0] : priceOf(next[0]);
        const high = pinned[1] !== null && next[1] === positions[1] ? pinned[1] : priceOf(next[1]);
        clearTimeout(applyTimer.current);
        applyTimer.current = setTimeout(() => apply(low, high), 400);
    };

    // Al salir de una caja (o con Enter) se toma lo escrito, se acomoda dentro del catálogo y se aplica.
    const commitText = (index: 0 | 1) => {
        const text = typed[index];
        setTyped([null, null]);
        if (text === null || text.trim() === '' || !Number.isFinite(Number(text))) return;
        const cents = clampToBounds(Math.round(Number(text) * 100));
        const [low, high] = index === 0 ? [Math.min(cents, range[1]), range[1]] : [range[0], Math.max(cents, range[0])];
        setPositions([centsToPosition(low, bounds), centsToPosition(high, bounds)]);
        setPinned([low, high]);
        if (low !== range[0] || high !== range[1]) apply(low, high);
    };

    const isActive = range[0] > bounds.min || range[1] < bounds.max;
    const maxPesos = Math.ceil(bounds.max / 100);

    return (
        <div className="space-y-3 pb-2">
            <Slider
                min={0}
                max={STEPS}
                step={1}
                value={positions}
                onValueChange={onSlide}
                onValueCommitted={onSlideCommitted}
                aria-label={t('priceTitle')}
                className="px-1 pt-2"
            />
            <p className="text-xs text-muted-foreground" aria-live="polite">
                {t('priceRange', {min: formatPrice(range[0]), max: formatPrice(range[1])})}
            </p>
            <div className="flex items-end gap-2">
                {([0, 1] as const).map((index) => (
                    <div key={index} className="min-w-0 flex-1 space-y-1">
                        <Label htmlFor={`${idPrefix}-${index}`} className="text-xs font-normal text-muted-foreground">
                            {index === 0 ? t('priceMin') : t('priceMax')}
                        </Label>
                        <div className="relative">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                            <Input
                                id={`${idPrefix}-${index}`}
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={maxPesos}
                                step="any"
                                value={shown(index)}
                                onChange={(event) =>
                                    setTyped(index === 0 ? [event.target.value, typed[1]] : [typed[0], event.target.value])
                                }
                                onBlur={() => commitText(index)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') commitText(index);
                                }}
                                className="h-8 pl-5 text-sm"
                            />
                        </div>
                    </div>
                ))}
            </div>
            {isActive && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onApply({})}>
                    {t('priceReset')}
                </Button>
            )}
        </div>
    );
}

export function PriceRangeFilter(props: PriceRangeFilterProps) {
    const t = useTranslations('Filters');
    const {bounds, selected} = props;
    if (!(bounds.max > bounds.min)) return null;

    return (
        <Collapsible defaultOpen>
            <div className="space-y-2">
                <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium hover:text-foreground transition-colors">
                    {t('priceTitle')}
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-panel-open]_&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                    {/* La clave reinicia los controles cuando el rango cambia desde fuera (quitar filtros, atrás del navegador). */}
                    <PriceRangeControls key={`${selected.min ?? ''}-${selected.max ?? ''}-${bounds.min}-${bounds.max}`} {...props} />
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}
