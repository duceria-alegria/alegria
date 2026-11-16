import {Link} from '@/platform/i18n/navigation';
import {getRouteLocale} from '@/platform/i18n/server';
import {getTranslations} from 'next-intl/server';
import {getLineas} from '@/features/search/lines-data';
import {CategoryIcon} from '@/site/home/category-icons';
import {SectionHeading} from '@/site/home/section-heading';

const TILE_COLORS = [
    'bg-pastel-pink',
    'bg-pastel-orange',
    'bg-pastel-lavender',
    'bg-pastel-cyan',
    'bg-pastel-red',
    'bg-brand-yellow-soft',
] as const;

// Las líneas que se muestran en el inicio, en este orden (código del valor del filtro "Línea").
// Las demás se encuentran en el filtro de la tienda; si una no existe o no tiene productos se omite.
const LINEAS_DESTACADAS = [
    'caramelos',
    'chocolates',
    'paletas',
    'gomitas',
    'tamarindos',
    'frituras',
    'chicles',
    'cacahuates',
    'gelatinas',
    'desechables',
] as const;

export async function CategoriesSection() {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Home'});
    const lineas = await getLineas(locale);
    const destacadas = LINEAS_DESTACADAS.flatMap(code => lineas.find(linea => linea.code === code && linea.count > 0) ?? []);

    if (destacadas.length === 0) return null;

    return (
        <section id="categorias" className="container-page pb-[clamp(48px,6vw,88px)]">
            <SectionHeading className="mb-7">{t('categories.title')}</SectionHeading>
            <ul className="grid grid-cols-2 sm:grid-cols-5 gap-[clamp(10px,1.6vw,16px)]">
                {destacadas.map((linea, index) => (
                    <li key={linea.id}>
                        <Link
                            href={`/search?facets=${linea.id}`}
                            className={`flex h-full flex-col items-center gap-3 rounded-3xl px-2 pb-4 pt-5 text-center text-[15px] font-extrabold shadow-tile transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-tile-hover motion-reduce:transition-none motion-reduce:hover:transform-none ${TILE_COLORS[index % TILE_COLORS.length]}`}
                        >
                            <span className="flex size-14 items-center justify-center rounded-full bg-white">
                                <CategoryIcon slug={linea.code} index={index} />
                            </span>
                            {linea.name}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
