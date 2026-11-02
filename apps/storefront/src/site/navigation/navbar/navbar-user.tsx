import {getRouteLocale} from '@/platform/i18n/server';
import {User} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/platform/i18n/navigation';
import {LoginButton} from "@/site/navigation/navbar/login-button";
import {getActiveCustomer} from '@/features/account/customer';
import {getTranslations} from 'next-intl/server';


export async function NavbarUser() {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Navigation'});
    const customer = await getActiveCustomer()

    if (!customer) {
        return (
            <Button
                render={<LoginButton isLoggedIn={false} />}
                className="h-11 gap-2 rounded-full px-[18px] text-[15px] font-extrabold hover:bg-brand-purple-deep"
            />
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className="h-11 gap-2 rounded-full border-[1.5px] px-4 text-[15px] font-bold" />}>
                <User className="size-5"/>
                {t('greeting', {name: customer.firstName})}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem render={<Link href="/account/profile" />}>{t('profile')}</DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/account/orders" />}>{t('orders')}</DropdownMenuItem>
                <DropdownMenuSeparator/>
                <DropdownMenuItem render={<LoginButton isLoggedIn={true} />} nativeButton />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
