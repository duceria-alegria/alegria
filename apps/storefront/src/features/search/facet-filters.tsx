'use client';

import { use, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/platform/i18n/navigation';
import { ResultOf } from '@/platform/vendure/graphql';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { SlidersHorizontal, ChevronDown, Search } from 'lucide-react';
import {SearchProductsQuery} from '@/features/search/graphql';
import {useTranslations} from 'next-intl';

interface FacetFiltersProps {
    productDataPromise: Promise<{
        data: ResultOf<typeof SearchProductsQuery>;
        token?: string;
        // Todos los valores de filtro, incluidos los que el filtro actual dejaría fuera.
        facetCatalog: ResultOf<typeof SearchProductsQuery>['search']['facetValues'];
    }>;
}

type FacetValue = { id: string; name: string; count: number };

function FilterOption({value, checked, onToggle}: {value: FacetValue; checked: boolean; onToggle: (id: string) => void}) {
    return (
        <div className="flex items-center space-x-2">
            <Checkbox
                id={`filter-${value.id}`}
                checked={checked}
                onCheckedChange={() => onToggle(value.id)}
            />
            <Label
                htmlFor={`filter-${value.id}`}
                className="text-sm font-normal cursor-pointer flex items-center gap-2"
            >
                {value.name}
                <span className="text-xs text-muted-foreground">
                    ({value.count})
                </span>
            </Label>
        </div>
    );
}

// Con tantas opciones (p. ej. las ~30 líneas) conviene poder buscar en lugar de recorrer la lista.
const SEARCHABLE_FROM = 8;

// Sin mayúsculas ni acentos: "gomitas", "Gómitas" y "GOMITAS" son lo mismo para quien busca.
function normalize(text: string) {
    return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function FacetGroup({facetName, totalValues, values, toggleFacet}: {
    facetName: string;
    totalValues: number;
    values: FacetValue[];
    toggleFacet: (id: string) => void;
}) {
    const t = useTranslations('Filters');
    const [search, setSearch] = useState('');
    const needle = normalize(search.trim());
    const visible = needle ? values.filter((value) => normalize(value.name).includes(needle)) : values;

    return (
        <Collapsible defaultOpen>
            <div className="space-y-2">
                <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium hover:text-foreground transition-colors">
                    {facetName}
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-panel-open]_&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="space-y-2 pb-2">
                        {totalValues > SEARCHABLE_FROM && (
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
                                <Input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder={t('searchPlaceholder')}
                                    aria-label={`${t('searchPlaceholder')} ${facetName}`}
                                    className="h-8 pl-8 text-sm"
                                />
                            </div>
                        )}
                        {visible.map((value) => (
                            <FilterOption key={value.id} value={value} checked={false} onToggle={toggleFacet}/>
                        ))}
                        {visible.length === 0 && (
                            <p className="py-1 text-sm text-muted-foreground">{t('noMatches')}</p>
                        )}
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}

function FilterContent({
    facetGroups,
    selectedFacets,
    toggleFacet,
    clearFilters,
}: {
    facetGroups: Record<string, { id: string; name: string; values: Array<{ id: string; name: string; count: number }> }>;
    selectedFacets: string[];
    toggleFacet: (facetId: string) => void;
    clearFilters: () => void;
}) {
    const t = useTranslations('Filters');
    const selectedGroups = Object.entries(facetGroups)
        .map(([facetName, facet]) => ({
            facetName,
            id: facet.id,
            values: facet.values.filter((value) => selectedFacets.includes(value.id)),
        }))
        .filter((group) => group.values.length > 0);
    return (
        <div className="space-y-4">
            <h2 className="font-semibold text-lg">{t('title')}</h2>

            {selectedGroups.length > 0 && (
                <section className="space-y-3 rounded-xl bg-muted/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">{t('selected')}</h3>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearFilters}>
                            {t('removeAll')}
                        </Button>
                    </div>
                    {selectedGroups.map(({facetName, id, values}) => (
                        <div key={id} className="space-y-2">
                            {Object.keys(facetGroups).length > 1 && (
                                <p className="text-xs font-medium text-muted-foreground">{facetName}</p>
                            )}
                            {values.map((value) => (
                                <FilterOption key={value.id} value={value} checked onToggle={toggleFacet}/>
                            ))}
                        </div>
                    ))}
                </section>
            )}

            {Object.entries(facetGroups).map(([facetName, facet]) => {
                const values = facet.values.filter((value) => !selectedFacets.includes(value.id));
                if (values.length === 0) return null;
                return (
                    <FacetGroup
                        key={facet.id}
                        facetName={facetName}
                        totalValues={facet.values.length}
                        values={values}
                        toggleFacet={toggleFacet}
                    />
                );
            })}
        </div>
    );
}

export function FacetFilters({ productDataPromise }: FacetFiltersProps) {
    const t = useTranslations('Filters');
    const result = use(productDataPromise);
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [sheetOpen, setSheetOpen] = useState(false);

    // Group facet values by facet
    interface FacetGroup {
        id: string;
        name: string;
        values: Array<{ id: string; name: string; count: number }>;
    }

    const facetGroups = result.facetCatalog.reduce((acc: Record<string, FacetGroup>, item) => {
        const facetName = item.facetValue.facet.name;
        if (!acc[facetName]) {
            acc[facetName] = {
                id: item.facetValue.facet.id,
                name: facetName,
                values: []
            };
        }
        acc[facetName].values.push({
            id: item.facetValue.id,
            name: item.facetValue.name,
            count: item.count
        });
        return acc;
    }, {});

    const selectedFacets = searchParams.getAll('facets');

    const toggleFacet = (facetId: string) => {
        const params = new URLSearchParams(searchParams);
        const current = params.getAll('facets');

        if (current.includes(facetId)) {
            params.delete('facets');
            current.filter(id => id !== facetId).forEach(id => params.append('facets', id));
        } else {
            params.append('facets', facetId);
        }

        // Reset to page 1 when filters change
        params.delete('page');

        router.push(`${pathname}?${params.toString()}`);
    };

    const clearFilters = () => {
        const params = new URLSearchParams(searchParams);
        params.delete('facets');
        params.delete('page');
        router.push(`${pathname}?${params.toString()}`);
        setSheetOpen(false);
    };

    const hasActiveFilters = selectedFacets.length > 0;

    if (Object.keys(facetGroups).length === 0) {
        return null;
    }

    const filterContentProps = {
        facetGroups,
        selectedFacets,
        toggleFacet,
        clearFilters,
    };

    return (
        <>
            {/* Mobile: Sheet trigger */}
            <div className="lg:hidden">
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger
                        render={
                            <Button variant="outline" className="w-full">
                                <SlidersHorizontal className="mr-2 h-4 w-4" />
                                {t('filtersButton')}
                                {hasActiveFilters && (
                                    <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                                        {selectedFacets.length}
                                    </span>
                                )}
                            </Button>
                        }
                    />
                    <SheetContent side="left" className="overflow-y-auto p-6">
                        <SheetHeader>
                            <SheetTitle>{t('title')}</SheetTitle>
                        </SheetHeader>
                        <div className="mt-4">
                            <FilterContent {...filterContentProps} />
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop: Inline filters */}
            <div className="hidden lg:block">
                <FilterContent {...filterContentProps} />
            </div>
        </>
    );
}
