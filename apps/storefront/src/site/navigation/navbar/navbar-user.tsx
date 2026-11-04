import {getRouteLocale} from '@/platform/i18n/server';
import {User} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
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
                className="h-11 gap-2 rounded-full px-[18px] text-[15px] font-extrabold hover:bg-brand-purple-deep max-sm:w-11 max-sm:px-0"
            />
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className="h-11 gap-2 rounded-full border-[1.5px] px-4 text-[15px] font-bold max-sm:w-11 max-sm:px-0" />}>
                <User className="size-5"/>
                <span className="max-sm:sr-only">{t('greeting', {name: customer.firstName})}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuGroup className="sm:hidden">
                    <DropdownMenuLabel className="text-sm font-bold text-primary">{t('greeting', {name: customer.firstName})}</DropdownMenuLabel>
                    <DropdownMenuSeparator/>
                </DropdownMenuGroup>
                <DropdownMenuItem render={<Link href="/account/profile" />}>{t('profile')}</DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/account/orders" />}>{t('orders')}</DropdownMenuItem>
                <DropdownMenuSeparator/>
                <DropdownMenuItem render={<LoginButton isLoggedIn={true} />} nativeButton />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
