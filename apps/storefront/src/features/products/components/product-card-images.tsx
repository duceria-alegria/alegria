'use client';

import {useEffect, useRef, useState, type MouseEvent} from 'react';
import Image from 'next/image';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {cn} from '@/lib/utils';

interface ProductCardImagesProps {
    images: Array<{id: string; preview: string}>;
    preload?: boolean;
}

const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

const arrowButton = cn(
    'absolute top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-primary shadow-button',
    'opacity-0 transition-[opacity,transform,background-color] duration-300 hover:bg-background focus-visible:opacity-100 active:scale-90',
    'group-hover:opacity-100 pointer-coarse:opacity-100 motion-reduce:transition-none',
    EASE,
);

// Carrusel de fotos de la tarjeta. Los controles van por encima del enlace extendido de la tarjeta
// (z-10) y frenan el clic para no abrir la ficha del producto.
export function ProductCardImages({images, preload}: ProductCardImagesProps) {
    const t = useTranslations('Product');
    const [index, setIndex] = useState(0);
    // Solo la primera foto se monta al inicio; el resto se pide cuando el cliente se acerca a la tarjeta.
    const [warm, setWarm] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const count = images.length;

    // El enlace extendido de la tarjeta tapa esta zona y se lleva el puntero, así que se escucha
    // en la tarjeta completa.
    useEffect(() => {
        const card = root.current?.closest('article');
        if (!card) return;
        const warmUp = () => setWarm(true);
        card.addEventListener('pointerenter', warmUp, {once: true});
        card.addEventListener('focusin', warmUp, {once: true});
        return () => {
            card.removeEventListener('pointerenter', warmUp);
            card.removeEventListener('focusin', warmUp);
        };
    }, []);

    const go = (event: MouseEvent, step: number) => {
        event.preventDefault();
        event.stopPropagation();
        setWarm(true);
        setIndex(current => (current + step + count) % count);
    };

    return (
        <div ref={root} className="absolute inset-0 overflow-hidden">
            <div
                className={cn('flex h-full transition-transform duration-500 motion-reduce:transition-none', EASE)}
                style={{transform: `translateX(-${index * 100}%)`}}
            >
                {images.map((image, i) => (
                    <div key={image.id} className="relative h-full w-full shrink-0">
                        {(i === 0 || warm) && (
                            <Image
                                src={image.preview}
                                alt=""
                                fill
                                preload={preload && i === 0}
                                className={cn('object-contain mix-blend-multiply transition-transform duration-[900ms] group-hover:scale-[1.04] motion-reduce:transition-none', EASE)}
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                            />
                        )}
                    </div>
                ))}
            </div>
            {count > 1 && (
                <>
                    <button type="button" aria-label={t('previousImage')} onClick={event => go(event, -1)} className={cn(arrowButton, 'left-1.5')}>
                        <ChevronLeft className="size-4" strokeWidth={2.4}/>
                    </button>
                    <button type="button" aria-label={t('nextImage')} onClick={event => go(event, 1)} className={cn(arrowButton, 'right-1.5')}>
                        <ChevronRight className="size-4" strokeWidth={2.4}/>
                    </button>
                    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
                        {images.map((image, i) => (
                            <span
                                key={image.id}
                                className={cn('h-1.5 rounded-full bg-primary transition-[width,opacity] duration-300', i === index ? 'w-4 opacity-80' : 'w-1.5 opacity-25')}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
