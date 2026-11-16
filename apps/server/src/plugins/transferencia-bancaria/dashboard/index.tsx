import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    api,
    Button,
    defineDashboardExtension,
    Input,
    Link,
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
    toast,
    useLocalFormat,
} from '@vendure/dashboard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { graphql } from '@/gql';

const transferenciasPendientesDocument = graphql(`
    query TransferenciasPendientes {
        transferenciasPendientes {
            paymentId
            orderId
            orderCode
            orderState
            cliente
            correo
            monto
            currencyCode
            creadoEn
        }
    }
`);

const confirmarTransferenciaDocument = graphql(`
    mutation ConfirmarTransferencia($paymentId: ID!) {
        confirmarTransferencia(paymentId: $paymentId) {
            id
            state
        }
    }
`);

const rechazarTransferenciaDocument = graphql(`
    mutation RechazarTransferencia($paymentId: ID!, $motivo: String) {
        rechazarTransferencia(paymentId: $paymentId, motivo: $motivo) {
            id
            state
        }
    }
`);

type Transferencia = {
    paymentId: string;
    orderId: string;
    orderCode: string;
    cliente?: string | null;
    correo?: string | null;
    monto: number;
    currencyCode: string;
    creadoEn: string;
};

type Accion = { tipo: 'confirmar' | 'rechazar'; transferencia: Transferencia };

const CLAVE_PENDIENTES = ['transferencias-pendientes'];

function TransferenciasPorConfirmar() {
    const { formatCurrency, formatDate } = useLocalFormat();
    const queryClient = useQueryClient();
    const [accion, setAccion] = useState<Accion | null>(null);
    const [motivo, setMotivo] = useState('');

    const { data: pendientes, isLoading, error } = useQuery({
        queryKey: CLAVE_PENDIENTES,
        queryFn: () => api.query(transferenciasPendientesDocument),
        select: datos => datos.transferenciasPendientes as Transferencia[],
        // Llegan pedidos nuevos mientras se tiene la pantalla abierta.
        refetchInterval: 60_000,
    });

    const cerrarDialogo = () => {
        setAccion(null);
        setMotivo('');
    };

    const resolver = useMutation({
        mutationFn: ({ tipo, transferencia }: Accion) =>
            tipo === 'confirmar'
                ? api.mutate(confirmarTransferenciaDocument)({ paymentId: transferencia.paymentId })
                : api.mutate(rechazarTransferenciaDocument)({
                      paymentId: transferencia.paymentId,
                      motivo: motivo.trim() || null,
                  }),
        onSuccess: (_resultado, { tipo, transferencia }) => {
            toast.success(
                tipo === 'confirmar'
                    ? `Transferencia del pedido ${transferencia.orderCode} confirmada`
                    : `Transferencia rechazada: el pedido ${transferencia.orderCode} se canceló`,
            );
            cerrarDialogo();
            // La lista, y lo que muestran la lista de pedidos y la página de ese pedido.
            queryClient.invalidateQueries({ queryKey: CLAVE_PENDIENTES });
            queryClient.invalidateQueries({
                predicate: ({ queryKey: [clave, segundo] }) =>
                    clave === 'PaginatedListDataTable' || (clave === 'DetailPage' && segundo === 'order'),
            });
        },
        onError: (falla, { tipo }) => {
            toast.error(tipo === 'confirmar' ? 'No se pudo confirmar la transferencia' : 'No se pudo rechazar la transferencia', {
                description: falla instanceof Error ? falla.message : undefined,
            });
            // Si otra persona ya la resolvió, la fila ya no debe seguir ahí.
            queryClient.invalidateQueries({ queryKey: CLAVE_PENDIENTES });
            cerrarDialogo();
        },
    });

    return (
        <Page pageId="transferencias-por-confirmar">
            <PageTitle>Transferencias por confirmar</PageTitle>
            <PageLayout>
                <PageBlock
                    column="full"
                    blockId="pendientes"
                    title="Esperan tu confirmación"
                    description="Pedidos que el cliente pagará por transferencia. Revisa en la cuenta bancaria que llegó el monto con el código del pedido como concepto y confírmala: hasta entonces la bodega no puede surtir el pedido. Si no llega, recházala y el pedido se cancela."
                >
                    {isLoading && <Skeleton className="h-24 w-full" />}
                    {error && (
                        <p className="text-sm text-destructive">
                            No se pudieron cargar las transferencias:{' '}
                            {error instanceof Error ? error.message : String(error)}
                        </p>
                    )}
                    {pendientes && pendientes.length === 0 && (
                        <p className="text-sm text-muted-foreground">No hay transferencias por confirmar.</p>
                    )}
                    {pendientes && pendientes.length > 0 && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Pedido (concepto)</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className="text-right">Monto esperado</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendientes.map(fila => (
                                    <TableRow key={fila.paymentId}>
                                        <TableCell className="font-medium">
                                            <Link to="/orders/$id" params={{ id: fila.orderId }} className="underline">
                                                {fila.orderCode}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <div>{fila.cliente || 'Sin nombre'}</div>
                                            {fila.correo && (
                                                <div className="text-xs text-muted-foreground">{fila.correo}</div>
                                            )}
                                        </TableCell>
                                        <TableCell>{formatDate(fila.creadoEn, { dateStyle: 'medium', timeStyle: 'short' })}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            {formatCurrency(fila.monto, fila.currencyCode)}
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="mr-2"
                                                disabled={resolver.isPending}
                                                onClick={() => setAccion({ tipo: 'rechazar', transferencia: fila })}
                                            >
                                                Rechazar
                                            </Button>
                                            <Button
                                                size="sm"
                                                disabled={resolver.isPending}
                                                onClick={() => setAccion({ tipo: 'confirmar', transferencia: fila })}
                                            >
                                                Confirmar
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </PageBlock>
            </PageLayout>

            <AlertDialog open={!!accion} onOpenChange={abierto => !abierto && !resolver.isPending && cerrarDialogo()}>
                <AlertDialogContent>
                    {accion && (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    {accion.tipo === 'confirmar'
                                        ? `¿Confirmar la transferencia del pedido ${accion.transferencia.orderCode}?`
                                        : `¿Rechazar la transferencia del pedido ${accion.transferencia.orderCode}?`}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {accion.tipo === 'confirmar'
                                        ? `Confirma que viste ${formatCurrency(accion.transferencia.monto, accion.transferencia.currencyCode)} en la cuenta bancaria. El pedido pasa a "Pago confirmado" y la bodega ya puede surtirlo.`
                                        : 'El pago y el pedido se cancelan y el inventario apartado se libera. No se puede deshacer.'}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            {accion.tipo === 'rechazar' && (
                                <Input
                                    aria-label="Motivo"
                                    placeholder="Motivo (opcional), p. ej. Transferencia no recibida"
                                    value={motivo}
                                    onChange={evento => setMotivo(evento.target.value)}
                                />
                            )}
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={resolver.isPending}>Volver</AlertDialogCancel>
                                <AlertDialogAction
                                    disabled={resolver.isPending}
                                    onClick={evento => {
                                        // Radix cierra el diálogo al accionar; se cierra solo al terminar la mutación.
                                        evento.preventDefault();
                                        resolver.mutate(accion);
                                    }}
                                >
                                    {accion.tipo === 'confirmar' ? 'Sí, confirmar' : 'Sí, rechazar'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </>
                    )}
                </AlertDialogContent>
            </AlertDialog>
        </Page>
    );
}

defineDashboardExtension({
    routes: [
        {
            path: '/transferencias-por-confirmar',
            component: () => <TransferenciasPorConfirmar />,
            navMenuItem: {
                id: 'transferencias-por-confirmar',
                sectionId: 'sales',
                title: 'Transferencias por confirmar',
                url: '/transferencias-por-confirmar',
                requiresPermission: 'AutorizarTransferencias',
            },
        },
    ],
});
