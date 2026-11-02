import {
    api,
    Button,
    defineDashboardExtension,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    NativeSelect,
    NativeSelectOption,
    toast,
    useAuth,
    usePermissions,
} from '@vendure/dashboard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { graphql } from '@/gql';

const iniciarSurtidoDocument = graphql(`
    mutation IniciarSurtido($orderId: ID!) {
        iniciarSurtido(orderId: $orderId) {
            id
            state
        }
    }
`);

const asignarSurtidorDocument = graphql(`
    mutation AsignarSurtidor($orderId: ID!, $administratorId: ID) {
        asignarSurtidor(orderId: $orderId, administratorId: $administratorId) {
            id
            state
        }
    }
`);

const surtidorDelPedidoDocument = graphql(`
    query SurtidorDelPedido($id: ID!) {
        order(id: $id) {
            id
            customFields {
                surtidor {
                    id
                    firstName
                    lastName
                    emailAddress
                    deletedAt
                }
            }
        }
    }
`);

const administradoresDocument = graphql(`
    query AdministradoresParaSurtir($options: AdministratorListOptions) {
        administrators(options: $options) {
            items {
                id
                firstName
                lastName
                emailAddress
                user {
                    roles {
                        permissions
                    }
                }
            }
            totalItems
        }
    }
`);

type Surtidor = {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    emailAddress?: string | null;
    deletedAt?: string | null;
};

/** Estados desde los que el servidor deja iniciar el surtido. */
const ESTADOS_INICIABLES = ['PaymentAuthorized', 'PaymentSettled'];

const nombreDe = (admin: Surtidor) =>
    [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.emailAddress || admin.id;

/** Un surtidor eliminado (borrado lógico) cuenta como pedido sin asignar. */
const surtidorVigente = (surtidor: Surtidor | null | undefined) => (surtidor && !surtidor.deletedAt ? surtidor : null);

/**
 * El surtidor del pedido. Se consulta aparte porque el campo `Order.surtidor` está oculto del formulario
 * genérico de campos personalizados del Dashboard (`ui.dashboard: false`).
 */
function useSurtidorDelPedido(orderId: string | undefined) {
    return useQuery({
        queryKey: ['surtidor-del-pedido', orderId],
        queryFn: () => api.query(surtidorDelPedidoDocument, { id: orderId as string }),
        enabled: !!orderId,
        select: data => {
            const campos = data.order?.customFields as { surtidor?: Surtidor | null } | null | undefined;
            return campos?.surtidor ?? null;
        },
    });
}

/** Refresca lo que muestra la página de ese pedido (detalle, historial, estado previo y surtidor). */
function useRefrescarPedido(orderId: string) {
    const queryClient = useQueryClient();
    return () =>
        queryClient.invalidateQueries({
            predicate: ({ queryKey: [clave, segundo, tercero] }) =>
                (clave === 'DetailPage' && segundo === 'order' && (tercero as { id?: string })?.id === orderId) ||
                ((clave === 'OrderHistory' ||
                    clave === 'orderPreModifyingState' ||
                    clave === 'surtidor-del-pedido') &&
                    segundo === orderId),
        });
}

function IniciarSurtidoButton({ context }: { context: { entity?: any } }) {
    const { user } = useAuth();
    const { hasPermissions } = usePermissions();
    const [cargando, setCargando] = useState(false);
    const order = context.entity;
    const refrescar = useRefrescarPedido(order?.id);
    const { data: surtidorAsignado } = useSurtidorDelPedido(order?.id);

    // Solo con pago autorizado o confirmado (`nextStates` incluye `Preparing` también al volver de
    // `Modifying`, y ahí no se debe poder "iniciar").
    if (!ESTADOS_INICIABLES.includes(order?.state) || !order?.nextStates?.includes('Preparing')) {
        return null;
    }
    const surtidor = surtidorVigente(surtidorAsignado);
    // El servidor también lo valida: solo el surtidor asignado (o quien puede asignar) inicia el pedido.
    const asignadoAOtro = !!surtidor && surtidor.id !== user?.id && !hasPermissions(['AsignarPedidos']);

    const iniciar = async () => {
        setCargando(true);
        try {
            await api.mutate(iniciarSurtidoDocument)({ orderId: order.id });
            toast.success('Surtido iniciado: el pedido está en "Atendiendo pedido"');
            await refrescar();
        } catch (error) {
            toast.error('No se pudo iniciar el surtido', {
                description: error instanceof Error ? error.message : undefined,
            });
        } finally {
            setCargando(false);
        }
    };

    return (
        <Button
            onClick={iniciar}
            disabled={cargando || asignadoAOtro}
            title={asignadoAOtro && surtidor ? `Pedido asignado a ${nombreDe(surtidor)}` : undefined}
        >
            Iniciar surtido
        </Button>
    );
}

function AsignarSurtidorButton({ context }: { context: { entity?: any } }) {
    const [abierto, setAbierto] = useState(false);
    const [seleccion, setSeleccion] = useState('');
    const [cargando, setCargando] = useState(false);
    const order = context.entity;
    const refrescar = useRefrescarPedido(order?.id);
    const { data: surtidorAsignado } = useSurtidorDelPedido(order?.id);
    // Solo se ofrece a quienes pueden surtir (con `PrepararPedidos`, o SuperAdmin), que es lo que el servidor exige.
    const { data: candidatos = [] } = useQuery({
        queryKey: ['surtidores-asignables'],
        queryFn: () => api.query(administradoresDocument, { options: { take: 100, sort: { emailAddress: 'ASC' } } }),
        enabled: abierto,
        select: data =>
            data.administrators.items.filter(admin =>
                admin.user.roles.some(
                    rol =>
                        (rol.permissions as string[]).includes('SuperAdmin') ||
                        (rol.permissions as string[]).includes('PrepararPedidos'),
                ),
            ),
    });

    if (!order) {
        return null;
    }
    const surtidor = surtidorVigente(surtidorAsignado);

    const asignar = async (administratorId: string | null) => {
        setCargando(true);
        try {
            await api.mutate(asignarSurtidorDocument)({ orderId: order.id, administratorId });
            toast.success(administratorId ? 'Surtidor asignado' : 'Pedido sin surtidor asignado');
            setAbierto(false);
            setSeleccion('');
            await refrescar();
        } catch (error) {
            toast.error('No se pudo asignar el surtidor', {
                description: error instanceof Error ? error.message : undefined,
            });
        } finally {
            setCargando(false);
        }
    };

    return (
        <>
            <Button variant="outline" onClick={() => setAbierto(true)}>
                Asignar surtidor
            </Button>
            <Dialog open={abierto} onOpenChange={setAbierto}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Asignar surtidor</DialogTitle>
                        <DialogDescription>
                            {surtidor
                                ? `Actualmente: ${nombreDe(surtidor)}. El estado del pedido no cambia.`
                                : 'Este pedido no tiene surtidor asignado. El estado del pedido no cambia.'}
                        </DialogDescription>
                    </DialogHeader>
                    <NativeSelect
                        className="w-full"
                        aria-label="Trabajador"
                        value={seleccion}
                        onChange={event => setSeleccion(event.target.value)}
                    >
                        <NativeSelectOption value="">Elegir trabajador</NativeSelectOption>
                        {candidatos.map(admin => (
                            <NativeSelectOption key={admin.id} value={admin.id}>
                                {`${nombreDe(admin)} (${admin.emailAddress})`}
                            </NativeSelectOption>
                        ))}
                    </NativeSelect>
                    <DialogFooter>
                        {surtidor && (
                            <Button variant="outline" disabled={cargando} onClick={() => asignar(null)}>
                                Quitar asignación
                            </Button>
                        )}
                        <Button disabled={cargando || !seleccion} onClick={() => seleccion && asignar(seleccion)}>
                            Asignar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function SurtidorBlock({ context }: { context: { entity?: any } }) {
    const { data: surtidor, isLoading } = useSurtidorDelPedido(context.entity?.id);
    if (isLoading) {
        return null;
    }
    if (surtidor?.deletedAt) {
        return (
            <div>
                <div className="font-medium">Sin asignar</div>
                <div className="text-sm text-muted-foreground">
                    {`El surtidor ${nombreDe(surtidor)} ya no tiene cuenta activa`}
                </div>
            </div>
        );
    }
    return surtidor ? (
        <div>
            <div className="font-medium">{nombreDe(surtidor)}</div>
            <div className="text-sm text-muted-foreground">{surtidor.emailAddress}</div>
        </div>
    ) : (
        <div className="text-sm text-muted-foreground">Sin asignar</div>
    );
}

defineDashboardExtension({
    actionBarItems: [
        {
            pageId: 'order-detail',
            id: 'iniciar-surtido',
            component: IniciarSurtidoButton,
            requiresPermission: 'PrepararPedidos',
        },
        {
            pageId: 'order-detail',
            id: 'asignar-surtidor',
            component: AsignarSurtidorButton,
            requiresPermission: 'AsignarPedidos',
        },
    ],
    pageBlocks: [
        {
            id: 'surtidor-del-pedido',
            title: 'Surtidor',
            location: {
                pageId: 'order-detail',
                column: 'side',
                position: { blockId: 'customer', order: 'before' },
            },
            component: SurtidorBlock,
        },
    ],
});
