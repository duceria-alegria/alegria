import {
    api,
    defineDashboardExtension,
    NativeSelect,
    NativeSelectOption,
    Page,
    PageBlock,
    PageLayout,
    PageTitle,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@vendure/dashboard';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { graphql } from '@/gql';

const reporteBusquedasDocument = graphql(`
    query ReporteBusquedas($dias: Int, $limite: Int) {
        reporteBusquedas(dias: $dias, limite: $limite) {
            dias
            total
            visitantes
            clientes
            sinResultados
            masBuscado {
                busqueda
                veces
                visitantes
                resultados
            }
            sinEncontrar {
                busqueda
                veces
                visitantes
                resultados
            }
            porTipoDeCliente {
                tipo
                busquedas
                sinResultados
            }
        }
    }
`);

const PERIODOS = [
    { dias: 7, texto: 'Últimos 7 días' },
    { dias: 30, texto: 'Últimos 30 días' },
    { dias: 90, texto: 'Últimos 90 días' },
    { dias: 365, texto: 'Último año' },
];

const LIMITE_FILAS = 50;

type Busqueda = { busqueda: string; veces: number; visitantes: number; resultados: number };

const numero = (valor: number) => valor.toLocaleString('es-MX');

function Dato({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
    return (
        <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">{etiqueta}</div>
            <div className="mt-1 text-2xl font-semibold">{valor}</div>
            {detalle && <div className="mt-1 text-xs text-muted-foreground">{detalle}</div>}
        </div>
    );
}

function TablaBusquedas({ filas, conResultados, vacio }: { filas: Busqueda[]; conResultados: boolean; vacio: string }) {
    if (filas.length === 0) {
        return <p className="text-sm text-muted-foreground">{vacio}</p>;
    }
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Búsqueda</TableHead>
                    <TableHead className="text-right">Veces</TableHead>
                    <TableHead className="text-right">Visitantes</TableHead>
                    {conResultados && <TableHead className="text-right">Resultados (prom.)</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {filas.map(fila => (
                    <TableRow key={fila.busqueda}>
                        <TableCell className="font-medium">{fila.busqueda}</TableCell>
                        <TableCell className="text-right">{numero(fila.veces)}</TableCell>
                        <TableCell className="text-right">{numero(fila.visitantes)}</TableCell>
                        {conResultados && <TableCell className="text-right">{numero(fila.resultados)}</TableCell>}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

function QueBuscanLosClientes() {
    const [dias, setDias] = useState(30);
    const { data: reporte, isLoading, error } = useQuery({
        queryKey: ['reporte-busquedas', dias],
        queryFn: () => api.query(reporteBusquedasDocument, { dias, limite: LIMITE_FILAS }),
        select: datos => datos.reporteBusquedas,
    });

    const porcentajeSinResultados =
        reporte && reporte.total > 0 ? Math.round((reporte.sinResultados * 100) / reporte.total) : 0;

    return (
        <Page pageId="busquedas-clientes">
            <PageTitle>Qué buscan los clientes</PageTitle>
            <PageLayout>
                <PageBlock
                    column="full"
                    blockId="resumen"
                    title="Resumen"
                    description="Se cuenta cada búsqueda que un cliente deja asentada en la tienda (no cada letra que teclea). No se guarda la IP."
                >
                    <div className="mb-4">
                        <NativeSelect
                            className="w-full sm:w-56"
                            aria-label="Periodo"
                            value={dias}
                            onChange={evento => setDias(Number(evento.target.value))}
                        >
                            {PERIODOS.map(periodo => (
                                <NativeSelectOption key={periodo.dias} value={periodo.dias}>
                                    {periodo.texto}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </div>
                    {isLoading && <Skeleton className="h-24 w-full" />}
                    {error && (
                        <p className="text-sm text-destructive">
                            No se pudo cargar el reporte: {error instanceof Error ? error.message : String(error)}
                        </p>
                    )}
                    {reporte && reporte.total === 0 && (
                        <p className="text-sm text-muted-foreground">
                            Todavía no hay búsquedas registradas en este periodo. Se registran cuando un cliente busca
                            algo en la tienda.
                        </p>
                    )}
                    {reporte && reporte.total > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <Dato etiqueta="Búsquedas" valor={numero(reporte.total)} />
                            <Dato
                                etiqueta="Visitantes distintos"
                                valor={numero(reporte.visitantes)}
                                detalle={`${numero(reporte.clientes)} con sesión iniciada`}
                            />
                            <Dato
                                etiqueta="Sin resultados"
                                valor={numero(reporte.sinResultados)}
                                detalle={`${porcentajeSinResultados}% de las búsquedas`}
                            />
                            <Dato
                                etiqueta="Con resultados"
                                valor={numero(reporte.total - reporte.sinResultados)}
                                detalle={`${100 - porcentajeSinResultados}% de las búsquedas`}
                            />
                        </div>
                    )}
                </PageBlock>

                {reporte && reporte.total > 0 && (
                    <>
                        <PageBlock
                            column="main"
                            blockId="sin-encontrar"
                            title="Lo que no encuentran"
                            description="Búsquedas que no dieron ningún producto. Es lo primero que conviene atender: un sinónimo que falta, un nombre mal escrito en el catálogo o un producto que aún no se vende."
                        >
                            <TablaBusquedas
                                filas={reporte.sinEncontrar}
                                conResultados={false}
                                vacio="Todo lo que buscaron en este periodo dio resultados."
                            />
                        </PageBlock>
                        <PageBlock
                            column="main"
                            blockId="mas-buscado"
                            title="Lo más buscado"
                            description="Las búsquedas más frecuentes, con cuántos productos dieron en promedio."
                        >
                            <TablaBusquedas filas={reporte.masBuscado} conResultados vacio="Sin búsquedas." />
                        </PageBlock>
                        <PageBlock
                            column="side"
                            blockId="por-tipo"
                            title="Por tipo de cliente"
                            description="Quién busca: visitantes sin sesión y clientes según su lista de precios."
                        >
                            {/* Lista y no tabla: la columna lateral es angosta. */}
                            <ul className="divide-y">
                                {reporte.porTipoDeCliente.map(fila => (
                                    <li key={fila.tipo} className="py-2 first:pt-0 last:pb-0">
                                        <div className="font-medium">{fila.tipo}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {numero(fila.busquedas)} búsquedas · {numero(fila.sinResultados)} sin resultados
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </PageBlock>
                    </>
                )}
            </PageLayout>
        </Page>
    );
}

defineDashboardExtension({
    routes: [
        {
            path: '/busquedas-clientes',
            component: () => <QueBuscanLosClientes />,
            navMenuItem: {
                id: 'busquedas-clientes',
                sectionId: 'catalog',
                title: 'Búsquedas de clientes',
                url: '/busquedas-clientes',
                requiresPermission: 'VerBusquedasClientes',
            },
        },
    ],
});
