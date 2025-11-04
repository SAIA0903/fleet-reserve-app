import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Link } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Layout from "@/components/Layout";
import Layout_Auth from "@/components/Layout_Auth";
import {
    MapPin,
    Calendar as CalendarIcon,
    Clock,
    Users,
    ArrowLeft,
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    List, 
    LogOut,
    Car,
    X,
    Check,
    Plane, 
    LogIn,
    Info 
} from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

// --- Configuración GraphQL y Funciones Comunes ---
const GRAPHQL_ENDPOINT = 'http://localhost:8080/graphql';
const ITEMS_PER_PAGE = 5; 
const getPasajeroId = () => localStorage.getItem('pasajeroId');

// Función genérica para ejecutar peticiones GraphQL.
// Intenta enviar una consulta o mutación a un endpoint GraphQL predefinido.
// Incluye una lógica básica de reintento en caso de fallos temporales.
async function executeGraphQLQuery(query: string, variables: any = {}): Promise<any> {
    // Número máximo de intentos antes de fallar.
    const maxRetries = 3;
    let attempt = 0;
    
    // Bucle para intentar la petición hasta que sea exitosa o se agoten los reintentos.
    while (attempt < maxRetries) {
        try {
            // Realiza la petición POST al endpoint de GraphQL.
            const response = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: variables,
                }),
            });

            // Parsea la respuesta como JSON.
            const result = await response.json();

            // Lanza un error si la respuesta de GraphQL contiene errores (errores a nivel de negocio o sintaxis).
            if (result.errors) {
                // Mensaje simplificado para el usuario final.
                throw new Error(result.errors[0]?.message || 'Ha ocurrido un error al procesar la solicitud.');
            }

            // Lanza un error si la respuesta HTTP no fue exitosa (código 4xx o 5xx).
            if (!response.ok) {
                // Mensaje simplificado sin detalles de código HTTP.
                throw new Error('El servidor respondió con un error. Intenta de nuevo.');
            }
            
            // Retorna los datos si la petición fue exitosa.
            return result.data;
        } catch (error) {
            // Si es el último intento, lanza el error capturado.
            if (attempt === maxRetries - 1) {
                throw error;
            }
            
            // Calcula el tiempo de espera (backoff exponencial: 1s, 2s, 4s).
            const delay = Math.pow(2, attempt) * 1000;
            
            // Espera antes de reintentar.
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
        }
    }
    // Lanza un error si todos los reintentos fallaron.
    throw new Error("No se pudo conectar al servicio. Por favor, revisa tu conexión a internet.");
}

// --- Consultas y Mutaciones GraphQL (horaLlegada AÑADIDA) ---
const GET_MY_RESERVATIONS_QUERY = `
    query GetMyReservations($pasajeroId: ID!) {
        misReservas(pasajeroId: $pasajeroId) {
            id 
            viaje {
                id 
                fecha
                horaSalida
                origen
                destino
                horaLlegada 
            }
            cantidadAsientos
            pasajerosAdicionales {
                nombre
            }
            estado
        }
    }
`;

const CANCEL_RESERVATION_MUTATION = `
    mutation CancelarReserva($reservaId: ID!, $pasajeroId: ID!) {
        cancelarReserva(reservaId: $reservaId, pasajeroId: $pasajeroId) {
            success
            message
            reserva {
                codigoReserva
                cantidadAsientos
                viaje {
                    origen
                    destino
                    horaSalida
                    fecha
                    horaLlegada
                }
                estado
            }
        }
    }
`;

// --- Interfaces de Datos (horaLlegada AÑADIDA) ---
interface PasajeroAdicional {
    nombre: string;
}

interface Reserva {
    id: string;
    viaje: {
        id: string;
        fecha: string;
        horaSalida: string;
        origen: string;
        destino: string;
        horaLlegada: string; // <--- AÑADIDO
    };
    cantidadAsientos: number;
    pasajerosAdicionales: PasajeroAdicional[];
    estado: string; // ACTIVA, CANCELADA (desde el backend)
}

// =========================================================================
// --- Lógica de Fechas y Estados (AJUSTADA PARA EN CURSO) ---
// =========================================================================

/**
 * Combina fecha (YYYY-MM-DD) y hora (HH:mm) en un objeto Date,
 * ajustando para el cruce de medianoche si es la hora de llegada.
 */
const getTripDateTime = (
    dateStr: string,
    timeStr: string,
    isArrival: boolean = false,
    horaSalidaStr?: string // Necesaria si isArrival es true
): Date => {
    let tripDateTime = parseISO(dateStr); // Inicializa con la fecha de SALIDA

    const [hoursStr, minutesStr] = timeStr.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    tripDateTime.setHours(hours, minutes, 0, 0);

    // Lógica para el cruce de medianoche:
    // Aplica solo si estamos calculando la hora de LLEGADA y tenemos la hora de SALIDA
    if (isArrival && horaSalidaStr) {
        const [salidaHoursStr] = horaSalidaStr.split(':');
        const salidaHours = parseInt(salidaHoursStr, 10);
        
        // La llegada es el día siguiente si la hora de llegada (hours) es menor
        // a la hora de salida (salidaHours).
        // Ej: Salida 23:00, Llegada 05:00. 5 < 23 => +1 día.
        if (hours < salidaHours) { 
             // Se suma un día al objeto Date.
             tripDateTime = addDays(tripDateTime, 1); 
        }
    }
    
    return tripDateTime;
};

/**
 * Determina si el viaje ya ha iniciado (la hora de salida es en el pasado).
 */
const isTripStarted = (dateStr: string, timeStr: string): boolean => {
    const tripDateTime = getTripDateTime(dateStr, timeStr);
    const now = new Date();
    return now > tripDateTime;
};

/**
 * [ACTUALIZADA] Determina si el viaje ya finalizó (la hora de LLEGADA es en el pasado),
 * considerando el cruce de medianoche.
 */
const isTripEnded = (fecha: string, horaSalida: string, horaLlegada: string): boolean => {
    // Usamos 'isArrival: true' y pasamos la hora de salida para la lógica de cruce de medianoche
    const tripEndDateTime = getTripDateTime(fecha, horaLlegada, true, horaSalida); 
    const now = new Date();
    return now > tripEndDateTime;
};

/**
 * Determina el estado final de la reserva para el frontend.
 * @returns 'ACTIVA', 'CANCELADA', 'EN_CURSO', o 'FINALIZADA'
 */
const getFrontendStatus = (estadoBackend: Reserva['estado'], fecha: string, horaSalida: string, horaLlegada: string): string => {
    if (estadoBackend === 'CANCELADA') {
        return 'CANCELADA';
    }
    
    const started = isTripStarted(fecha, horaSalida);
    // [MODIFICADO] Pasar horaSalida a isTripEnded
    const ended = isTripEnded(fecha, horaSalida, horaLlegada); 

    if (ended) {
        return 'FINALIZADA';
    }

    if (started && !ended) {
        // Viaje iniciado, pero aún no terminado: ESTADO DE SEGUIMIENTO
        return 'EN_CURSO';
    }

    // Activa y Futura (no ha iniciado)
    return 'ACTIVA';
};

/**
 * Devuelve la etiqueta Badge completa según el estado de frontend.
 */
const getStatusBadge = (estadoBackend: Reserva['estado'], fecha: string, horaSalida: string, horaLlegada: string) => {
    
    const estadoFrontend = getFrontendStatus(estadoBackend, fecha, horaSalida, horaLlegada);

    let className = "bg-muted text-muted-foreground";
    let text = estadoFrontend;

    if (estadoFrontend === 'ACTIVA') {
        className = "bg-bus-success hover:bg-bus-success/80 text-white";
        text = "ACTIVA";
    } else if (estadoFrontend === 'EN_CURSO') {
        // [NUEVO ESTADO EN CURSO]
        className = "bg-bus-warning hover:bg-bus-warning/80 text-white"; 
        text = "EN CURSO"; 
    } else if (estadoFrontend === 'FINALIZADA') {
        className = "bg-gray-500 hover:bg-gray-600/80 text-white";
        text = "FINALIZADA";
    } else if (estadoFrontend === 'CANCELADA') {
        className = "bg-bus-danger hover:bg-bus-danger/80 text-white";
        text = "CANCELADA";
    }

    return (
        <Badge 
            className={cn("uppercase text-xs font-semibold px-3 py-1 rounded-full border-0", className)}
        >
            {text}
        </Badge>
    );
};
// =========================================================================
// Componente: MyReservations
// Muestra, gestiona y permite la cancelación de las reservas de un usuario.
// =========================================================================

const MyReservations = () => {
    // Hooks de la aplicación para notificaciones y navegación.
    const { toast } = useToast();
    const navigate = useNavigate();

    // Estados para gestionar la data y la interfaz de usuario.
    const [reservations, setReservations] = useState<Reserva[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [selectedReservation, setSelectedReservation] = useState<Reserva | null>(null);
    const [cancelReason, setCancelReason] = useState("");
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

    // Lógica de paginación.
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(reservations.length / ITEMS_PER_PAGE);
    const pasajeroId = getPasajeroId();


    // Manejo de Sesión: Redirige al login si no hay un ID de pasajero.
    if (!pasajeroId) {
        return (
            <Layout title="FleetGuard360" subtitle="Mis Reservas">
                <div className="max-w-xl mx-auto text-center py-20 bg-white shadow-lg rounded-xl p-8">
                    <LogIn className="h-12 w-12 text-bus-primary mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-4">Acceso Requerido</h2>
                    <p className="text-muted-foreground mb-6">
                        Debe ingresar para ver el historial de sus reservas. <br></br>
                        Por favor, inicie sesión.
                    </p>
                    <Button asChild className="bg-bus-primary hover:bg-bus-primary/90">
                        <Link to="/login">
                            <LogIn className="h-4 w-4 mr-2" />
                            Ingresar
                        </Link>
                    </Button>
                </div>
            </Layout>
        );
    }

    // Lógica de Carga de Reservas: Consulta las reservas del usuario al servidor.
    const fetchMyReservations = async () => {
        setIsLoading(true);
        try {
            const variables = { pasajeroId: pasajeroId };
            // Ejecuta la consulta GraphQL para obtener las reservas.
            const data = await executeGraphQLQuery(GET_MY_RESERVATIONS_QUERY, variables);

            if (data && data.misReservas) {
                // Lógica de ordenamiento para mostrar reservas activas/futuras primero.
                const sortedReservas = [...data.misReservas].sort((a: Reserva, b: Reserva) => {
                    const dateA = getTripDateTime(a.viaje.fecha, a.viaje.horaSalida);
                    const dateB = getTripDateTime(b.viaje.fecha, b.viaje.horaSalida);
                    
                    const statusA = getFrontendStatus(a.estado, a.viaje.fecha, a.viaje.horaSalida, a.viaje.horaLlegada);
                    const statusB = getFrontendStatus(b.estado, b.viaje.fecha, b.viaje.horaSalida, b.viaje.horaLlegada);

                    if (statusA === 'ACTIVA' && statusB !== 'ACTIVA') return -1;
                    if (statusA !== 'ACTIVA' && statusB === 'ACTIVA') return 1;
                    if (statusA === 'EN_CURSO' && statusB !== 'EN_CURSO') return -1;
                    if (statusA !== 'EN_CURSO' && statusB === 'EN_CURSO') return 1;

                    return dateB.getTime() - dateA.getTime(); // Orden cronológico inverso.
                });

                setReservations(sortedReservas);
                toast({
                    title: "Reservas cargadas",
                    description: `Se encontraron ${sortedReservas.length} reservas.`,
                });
            } else {
                setReservations([]);
                toast({
                    title: "Sin reservas",
                    description: "No se encontraron reservas asociadas a tu cuenta.",
                });
            }
        } catch (error) {
            // Manejo de error con mensaje genérico para el usuario final.
            console.error("Error al cargar las reservas:", error);
            toast({
                title: "Error al cargar las reservas",
                description: `Ocurrió un problema al obtener tus reservas. Por favor, intenta de nuevo.`, // Mensaje simplificado.
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Efecto para cargar las reservas al montar el componente o cambiar el pasajero.
    useEffect(() => {
        if (pasajeroId) {
            fetchMyReservations();
        }
    }, [pasajeroId]);


    // Lógica de Cancelación: Envía la mutación para cancelar la reserva seleccionada.
    const handleCancelReservation = async () => {
        if (!selectedReservation) return;

        setIsCancelling(true);
        try {
            const variables = {
                reservaId: selectedReservation.id,
                pasajeroId: pasajeroId,
            };

            const data = await executeGraphQLQuery(CANCEL_RESERVATION_MUTATION, variables);
            
            if (data && data.cancelarReserva.success) {
                toast({
                    title: "Cancelación Exitosa",
                    description: data.cancelarReserva.message || "Tu reserva ha sido cancelada correctamente.",
                });
                // Recarga la lista de reservas para actualizar el estado.
                fetchMyReservations();
                setIsDetailsDialogOpen(false);
                setSelectedReservation(null);
                setCancelReason("");
            } else {
                // Lanza un error si la mutación no fue exitosa.
                throw new Error(data?.cancelarReserva?.message || "La cancelación no pudo completarse."); // Mensaje simplificado.
            }
        } catch (error) {
            // Manejo de error con mensaje genérico para el usuario final.
            console.error("Error en la cancelación:", error);
            toast({
                title: "Fallo en la cancelación",
                description: `No se pudo cancelar la reserva. Por favor, intenta más tarde.`, // Mensaje simplificado.
                variant: "destructive",
            });
        } finally {
            setIsCancelling(false);
        }
    };

    // Determina si una reserva puede ser cancelada (ACTIVA y no ha iniciado el viaje).
    const isCancellable = useMemo(() => {
        if (!selectedReservation) return false;
        
        if (selectedReservation.estado !== 'ACTIVA') return false;

        return !isTripStarted(selectedReservation.viaje.fecha, selectedReservation.viaje.horaSalida);
    }, [selectedReservation]);

    // Determina si una reserva es rastreable (estado de frontend 'EN_CURSO').
    const isTrackable = useMemo(() => {
        if (!selectedReservation) return false;
        
        const estadoFrontend = getFrontendStatus(
            selectedReservation.estado, 
            selectedReservation.viaje.fecha, 
            selectedReservation.viaje.horaSalida,
            selectedReservation.viaje.horaLlegada
        );
        
        return estadoFrontend === 'EN_CURSO';
    }, [selectedReservation]);
    
    // Lógica de Paginación: Calcula las reservas a mostrar en la página actual.
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentReservations = reservations.slice(startIndex, endIndex);

    // Abre el diálogo de detalles.
    const handleViewDetails = (reserva: Reserva) => {
        setSelectedReservation(reserva);
        setIsDetailsDialogOpen(true);
    };
    
    // Redirige al mapa de seguimiento del vehículo.
    const handleTrackVehicle = () => {
        navigate(`/mapa?origen=${selectedReservation.viaje.origen}&destino=${selectedReservation.viaje.destino}&fechaSalida=${selectedReservation.viaje.fecha}&horaSalida=${selectedReservation.viaje.horaSalida}&horaLlegada=${selectedReservation.viaje.horaLlegada}`);
    };

    return (
        <Layout_Auth title="FleetGuard360" subtitle="Mis Reservas">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Botón para Búsqueda de Viajes */}
                <div className="flex justify-start p-2 -mt-4">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/search')}
                        className="text-bus-primary hover:bg-bus-primary/10 font-semibold"
                        disabled={isLoading}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Búsqueda de Viajes
                    </Button>
                </div>

                <Card className="shadow-card bg-gradient-card border-0">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <List className="h-6 w-6 text-bus-primary" />
                            Mis Reservas
                            {isLoading && (
                                <span className="text-sm font-normal text-muted-foreground ml-2">Cargando...</span>
                            )}
                        </CardTitle>
                        <CardDescription>
                            Aquí puedes ver, gestionar y seguir tus viajes reservados.
                        </CardDescription>
                    </CardHeader>
                </Card>
                
                {/* Resultados de Reservas */}
                <Card className="shadow-card bg-background/50 border-0">
                    <CardContent className="p-6 pt-4">
                        {isLoading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="animate-pulse">
                                        <div className="h-28 bg-muted rounded-lg"></div>
                                    </div>
                                ))}
                            </div>
                        ) : currentReservations.length === 0 ? (
                            <div className="text-center py-12">
                                <Plane className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground text-lg">
                                    No tiene reservas en su historial.
                                </p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    ¡Empiece buscando su próximo viaje!
                                </p>
                                <Button
                                    onClick={() => navigate('/search')}
                                    className="mt-4 bg-bus-primary hover:bg-bus-primary/90"
                                >
                                    Buscar Viajes
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {currentReservations.map((reserva) => (
                                    <Card 
                                        key={reserva.id} 
                                        className="shadow-card border hover:shadow-elegant transition-smooth cursor-pointer"
                                        onClick={() => handleViewDetails(reserva)}
                                    >
                                        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                                            
                                            {/* Estado y Ruta */}
                                            <div className="md:col-span-2 space-y-1">
                                                {getStatusBadge(reserva.estado, reserva.viaje.fecha, reserva.viaje.horaSalida, reserva.viaje.horaLlegada)}
                                                <p className="font-bold text-lg text-bus-primary">
                                                    {reserva.viaje.origen} <ArrowRight className="h-4 w-4 inline-block mx-1" /> {reserva.viaje.destino}
                                                </p>
                                            </div>

                                            {/* Fecha y Hora */}
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1 text-sm">
                                                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium">{format(getTripDateTime(reserva.viaje.fecha, reserva.viaje.horaSalida), "PPP", { locale: es })}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-sm">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium">Salida: {reserva.viaje.horaSalida}</span>
                                                </div>
                                            </div>

                                            {/* Asientos y Pasajeros */}
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1 text-sm">
                                                    <Users className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium">
                                                        {reserva.cantidadAsientos} asiento(s)
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Pasajeros: {reserva.cantidadAsientos}
                                                </p>
                                            </div>

                                            {/* Botón de Detalles */}
                                            <div className="text-right">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="w-full md:w-auto text-bus-primary border-bus-primary hover:bg-bus-primary/10"
                                                >
                                                    Ver Detalles
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {/* Componente de Paginación */}
                        {reservations.length > ITEMS_PER_PAGE && (
                            <div className="flex items-center justify-between pt-6 mt-6 border-t">
                                <div>
                                    <p className="text-sm text-muted-foreground">
                                        Página {currentPage} de {totalPages} (Mostrando {currentReservations.length} de {reservations.length} reservas)
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        <span className="ml-2 hidden sm:inline">Anterior</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                    >
                                        <span className="mr-2 hidden sm:inline">Siguiente</span>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* DIALOGO DE DETALLES DE RESERVA (MODAL) */}
            <Dialog open={isDetailsDialogOpen} onOpenChange={(open) => {
                setIsDetailsDialogOpen(open);
                if (!open) {
                    setSelectedReservation(null);
                    setCancelReason("");
                }
            }}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5 text-bus-primary" /> Detalles de la Reserva
                        </DialogTitle>
                        <DialogDescription>
                            Información completa de tu viaje.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {selectedReservation && (
                        <div className="grid gap-4 py-4">
                            
                            <div className="border-b pb-3 mb-2">
                                <h3 className="text-xl font-bold text-bus-primary">{selectedReservation.viaje.origen} <ArrowRight className="h-4 w-4 inline-block mx-1" /> {selectedReservation.viaje.destino}</h3>
                                {getStatusBadge(selectedReservation.estado, selectedReservation.viaje.fecha, selectedReservation.viaje.horaSalida, selectedReservation.viaje.horaLlegada)}
                            </div>

                            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">Fecha:</span>
                                    <span>{format(getTripDateTime(selectedReservation.viaje.fecha, selectedReservation.viaje.horaSalida), "PPP", { locale: es })}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">Salida:</span>
                                    <span>{selectedReservation.viaje.horaSalida}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">Llegada:</span>
                                    <span>{selectedReservation.viaje.horaLlegada}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">Asientos:</span>
                                    <span>{selectedReservation.cantidadAsientos}</span>
                                </div>
                                <div className="col-span-2 space-y-1 pt-2">
                                    <p className="font-medium text-bus-primary">Pasajeros (Total: {selectedReservation.cantidadAsientos + selectedReservation.pasajerosAdicionales.length}):</p>
                                    <ul className="list-disc list-inside ml-2 text-muted-foreground">
                                        <li>Titular (Tú)</li>
                                        {selectedReservation.pasajerosAdicionales.map((p, index) => (
                                            <li key={index}>{p.nombre}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            
                            <div className="pt-2">
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <X className="h-3 w-3 text-bus-danger" /> 
                                    **Política de cancelación:** Se permite cancelar hasta la hora de salida sin ninguna penalidad.
                                </p>
                            </div>

                        </div>
                    )}

                    {/* BOTONES DE ACCIÓN */}
                    <div className="flex flex-col gap-3 pt-4 border-t">
                        <Button
                            onClick={handleTrackVehicle}
                            disabled={!isTrackable}
                            className="bg-bus-primary hover:bg-bus-primary/90 transition-smooth"
                        >
                            <Car className="h-4 w-4 mr-2" />
                            Seguir Vehículo
                        </Button>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button 
                                    variant="destructive" 
                                    disabled={!isCancellable || isCancelling}
                                    className="w-full"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    {isCancelling ? "Cancelando..." : "Cancelar Reserva"}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Está seguro de cancelar la reserva?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción no se puede deshacer. La cancelación está permitida sin penalidad hasta la hora de salida.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="space-y-2">
                                    <Label htmlFor="cancel-reason">Motivo de Cancelación (Opcional)</Label>
                                    <Textarea 
                                        id="cancel-reason" 
                                        placeholder="Escribe tu motivo aquí..." 
                                        value={cancelReason}
                                        onChange={(e) => setCancelReason(e.target.value)}
                                        disabled={isCancelling}
                                    />
                                </div>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isCancelling}>No</AlertDialogCancel>
                                    <AlertDialogAction 
                                        onClick={handleCancelReservation}
                                        className="bg-bus-danger hover:bg-bus-danger/90"
                                        disabled={isCancelling}
                                    >
                                        Sí, Cancelar
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </DialogContent>
            </Dialog>
        </Layout_Auth>
    );
};

export default MyReservations;