'use client';

import {ShoppingBag} from "lucide-react";
import {Button} from "@/components/ui/button";
import { Link } from '@/platform/i18n/navigation';
import {useTranslations} from 'next-intl';
import {cn} from '@/lib/utils';


interface CartIconProps {
    cartItemCount: number;
}

export function CartIcon({cartItemCount}: CartIconProps) {
    const t = useTranslations('Navigation');
    return (
        <Button
            render={<Link href="/cart" />}
            nativeButton={false}
            variant="outline"
            className={cn(
                "h-11 gap-2.5 rounded-full border-[1.5px] text-[15px] font-bold",
                cartItemCount > 0 ? "pl-4 pr-2" : "px-4",
            )}
        >
            <ShoppingBag className="size-5" aria-hidden="true"/>
            {t('cart')}
            {cartItemCount > 0 && (
                <span
                    className="flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-yellow px-1.5 text-sm font-extrabold text-primary">
                    {cartItemCount}
                </span>
            )}
        </Button>
    );
}
