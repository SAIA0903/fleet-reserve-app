import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Link } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Layout from "@/components/Layout";
import Layout_Auth from "@/components/Layout_Auth";
import { useAuth } from "@/hooks/useAuth";
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
    Info, 
    Send,
    Star,
    Bus
} from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";


// --- Configuración GraphQL y Funciones Comunes ---
const GRAPHQL_ENDPOINT = 'http://localhost:8080/graphql';
const ITEMS_PER_PAGE = 5;
const getStorage = () => {
    // El AuthProvider garantiza que 'authStorageType' se guarda en localStorage, 
    // independientemente de dónde se guarde la sesión.
    const storageType = localStorage.getItem('authStorageType');
    return storageType === 'local' ? localStorage : sessionStorage;
};

// Función genérica para obtener el Pasajero ID (Refactorizada)
const getPasajeroId = () => getStorage().getItem('pasajeroData') 
    ? JSON.parse(getStorage().getItem('pasajeroData')!).id // Obtiene el ID del objeto 'pasajeroData'
    : null; // Devuelve null si no hay datos.

// Función genérica para ejecutar peticiones GraphQL (Refactorizada)
// Esta función ahora usa 'getStorage()' en lugar de asumir 'localStorage'
const getAuthToken = () => getStorage().getItem('authToken');

async function executeGraphQLQuery(query: string, variables: any = {}): Promise<any> {
    const maxRetries = 3;
    let attempt = 0;
    
    // Obtener el token ANTES de intentar la petición
    const token = getAuthToken(); 
    
    while (attempt < maxRetries) {
        try {
            // Definir los encabezados, incluyendo el de autorización si hay un token.
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            if (token) {
                // Incluir el token en el encabezado Authorization
                headers['Authorization'] = `Bearer ${token}`; 
            }
            
            const response = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: headers, // Usar los encabezados definidos
                body: JSON.stringify({
                    query: query,
                    variables: variables,
                }),
            });

            const result = await response.json();

            if (result.errors) {
                throw new Error(result.errors[0]?.message || 'Ha ocurrido un error al procesar la solicitud.');
            }

            if (!response.ok) {
                throw new Error('El servidor respondió con un error. Intenta de nuevo.');
            }
            
            return result.data;
        } catch (error) {
            if (attempt === maxRetries - 1) {
                throw error;
            }
            
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
        }
    }
    throw new Error("No se pudo conectar al servicio. Por favor, revisa tu conexión a internet.");
}

// --- Consultas y Mutaciones GraphQL (Añadido: Verificar Encuesta y Responder Encuesta) ---

// MUTACIÓN PARA RESPONDER LA ENCUESTA
const RESPONDER_ENCUESTA_MUTATION = `
    mutation ResponderEncuesta($input: ResponderEncuestaInput!) {
        responderEncuesta(input: $input) {
            success
            mensaje
        }
    }
`;

// CONSULTA PARA VERIFICAR SI YA SE RESPONDIÓ LA ENCUESTA
const YA_RESPONDIO_ENCUESTA_QUERY = `
    query YaRespondioEncuesta($reservaId: ID!) {
        yaRespondioEncuesta(reservaId: $reservaId)
    }
`;

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

// --- Interfaces de Datos ---
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
        horaLlegada: string;
    };
    cantidadAsientos: number;
    pasajerosAdicionales: PasajeroAdicional[];
    estado: string; // ACTIVA, CANCELADA (desde el backend)
    // Campo para guardar el estado de la encuesta en el frontend
    encuestaRespondida?: boolean; // Nuevo campo
}

interface CalificacionInput {
    reservaId: number;
    calificacionPuntualidad: number;
    calificacionComodidad: number;
    calificacionAtencionConductor: number;
    calificacionPrestaciones: number;
    calificacionGeneral: number;
    comentarios: string;
}


// =========================================================================
// --- Lógica de Fechas y Estados (Mantenida sin cambios) ---
// =========================================================================

// ... (getTripDateTime, isTripStarted, isTripEnded, getFrontendStatus, getStatusBadge se mantienen igual) ...

const getTripDateTime = (
    dateStr: string,
    timeStr: string,
    isArrival: boolean = false,
    horaSalidaStr?: string
): Date => {
    let tripDateTime = parseISO(dateStr); 
    const [hoursStr, minutesStr] = timeStr.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    tripDateTime.setHours(hours, minutes, 0, 0);

    if (isArrival && horaSalidaStr) {
        const [salidaHoursStr] = horaSalidaStr.split(':');
        const salidaHours = parseInt(salidaHoursStr, 10);
        if (hours < salidaHours) {  
            tripDateTime = addDays(tripDateTime, 1); 
        }
    }
    return tripDateTime;
};

const isTripStarted = (dateStr: string, timeStr: string): boolean => {
    const tripDateTime = getTripDateTime(dateStr, timeStr);
    const now = new Date();
    return now > tripDateTime;
};

const isTripEnded = (fecha: string, horaSalida: string, horaLlegada: string): boolean => {
    const tripEndDateTime = getTripDateTime(fecha, horaLlegada, true, horaSalida); 
    const now = new Date();
    return now > tripEndDateTime;
};

const getFrontendStatus = (estadoBackend: Reserva['estado'], fecha: string, horaSalida: string, horaLlegada: string): string => {
    if (estadoBackend === 'CANCELADA') {
        return 'CANCELADA';
    }
    
    const started = isTripStarted(fecha, horaSalida);
    const ended = isTripEnded(fecha, horaSalida, horaLlegada); 

    if (ended) {
        return 'FINALIZADA';
    }

    if (started && !ended) {
        return 'EN_CURSO';
    }

    return 'ACTIVA';
};

const getStatusBadge = (estadoBackend: Reserva['estado'], fecha: string, horaSalida: string, horaLlegada: string) => {
    
    const estadoFrontend = getFrontendStatus(estadoBackend, fecha, horaSalida, horaLlegada);

    let className = "bg-muted text-muted-foreground";
    let text = estadoFrontend;

    if (estadoFrontend === 'ACTIVA') {
        className = "bg-bus-success hover:bg-bus-success/80 text-white";
        text = "ACTIVA";
    } else if (estadoFrontend === 'EN_CURSO') {
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
// --- Componente de Calificación (NUEVO) ---
// =========================================================================

interface CalificarServiceDialogProps {
    reservaId: string;
    onClose: () => void;
    onSuccessfulSubmit: () => void;
}

const CalificarServiceDialog: React.FC<CalificarServiceDialogProps> = ({ reservaId, onClose, onSuccessfulSubmit }) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    
    // Estado inicial de las calificaciones (todos a 3 para facilitar la entrada)
    const [calificaciones, setCalificaciones] = useState<Omit<CalificacionInput, 'reservaId'>>({
        calificacionPuntualidad: 3,
        calificacionComodidad: 3,
        calificacionAtencionConductor: 3,
        calificacionPrestaciones: 3,
        calificacionGeneral: 3,
        comentarios: "",
    });

    // Maneja el cambio de calificación para un campo específico (1 a 5)
    const handleRatingChange = (field: keyof Omit<CalificacionInput, 'reservaId' | 'comentarios'>, value: number) => {
        // Asegurar que sea un entero entre 1 y 5
        const rating = Math.min(5, Math.max(1, Math.floor(value))); 
        setCalificaciones(prev => ({
            ...prev,
            [field]: rating,
        }));
    };

    // Maneja el envío de la calificación
    const handleSubmitCalificacion = async () => {
        setIsLoading(true);
        try {
            // Convertir el ID de la reserva a número (si GraphQL lo espera como Int/Long)
            const reservaIdNum = parseInt(reservaId, 10);

            // Preparar el objeto de entrada para la mutación
            const input: CalificacionInput = {
                reservaId: reservaIdNum,
                calificacionPuntualidad: calificaciones.calificacionPuntualidad,
                calificacionComodidad: calificaciones.calificacionComodidad,
                calificacionAtencionConductor: calificaciones.calificacionAtencionConductor,
                calificacionPrestaciones: calificaciones.calificacionPrestaciones,
                calificacionGeneral: calificaciones.calificacionGeneral,
                comentarios: calificaciones.comentarios.substring(0, 1000), // Límite de 1000 caracteres
            };
            
            // Construir la mutación (usando variables es más limpio que construir el string con valores)
            const variables = { input };
            
            const data = await executeGraphQLQuery(RESPONDER_ENCUESTA_MUTATION, variables);
            
            if (data && data.responderEncuesta.success) {
                toast({
                    title: "Calificación Enviada",
                    description: data.responderEncuesta.mensaje || "Gracias por calificar nuestro servicio.",
                });
                onSuccessfulSubmit(); // Actualiza el estado de la reserva en el padre
                onClose(); // Cierra el modal
            } else {
                throw new Error(data?.responderEncuesta?.mensaje || "Fallo al enviar la calificación.");
            }

        } catch (error) {
            console.error("Error al calificar:", error);
            toast({
                title: "Error al calificar",
                description: `Ocurrió un problema: ${error.message}`,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Componente de una fila de calificación con estrellas
    const RatingRow: React.FC<{ label: string, field: keyof Omit<CalificacionInput, 'reservaId' | 'comentarios'>, value: number }> = 
        ({ label, field, value }) => (
        <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{label}</Label>
            <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((starValue) => (
                    <Star
                        key={starValue}
                        className={cn(
                            "h-5 w-5 cursor-pointer transition-colors",
                            starValue <= value ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
                        )}
                        onClick={() => handleRatingChange(field, starValue)}
                    />
                ))}
            </div>
        </div>
    );

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Calificar Servicio</DialogTitle>
                    <p className="text-sm text-muted-foreground">Reserva #{reservaId}. Por favor califica del 1 (Malo) al 5 (Excelente).</p>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <RatingRow label="Puntualidad" field="calificacionPuntualidad" value={calificaciones.calificacionPuntualidad} />
                    <RatingRow label="Comodidad" field="calificacionComodidad" value={calificaciones.calificacionComodidad} />
                    <RatingRow label="Atención Conductor" field="calificacionAtencionConductor" value={calificaciones.calificacionAtencionConductor} />
                    <RatingRow label="Prestaciones" field="calificacionPrestaciones" value={calificaciones.calificacionPrestaciones} />
                    <RatingRow label="Calidad General" field="calificacionGeneral" value={calificaciones.calificacionGeneral} />

                    <div className="space-y-2 pt-2">
                        <Label htmlFor="comentarios">Comentarios (Máx. 1000 caracteres)</Label>
                        <Textarea
                            id="comentarios"
                            placeholder="Comparte tu experiencia..."
                            value={calificaciones.comentarios}
                            onChange={(e) => setCalificaciones(prev => ({ ...prev, comentarios: e.target.value.substring(0, 1000) }))}
                            maxLength={1000}
                        />
                        <p className="text-xs text-muted-foreground text-right">{calificaciones.comentarios.length}/1000</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button 
                        onClick={handleSubmitCalificacion} 
                        disabled={isLoading}
                        className="bg-bus-primary hover:bg-bus-primary/90 transition-smooth"
                    >
                        <Send className="h-4 w-4 mr-2" />
                        {isLoading ? "Enviando..." : "Enviar Calificación"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


// =========================================================================
// Componente: MyReservations (AJUSTADO)
// =========================================================================

const MyReservations = () => {
    // Hook de autenticación:
    const { isAuthenticated, pasajeroData, isAuthReady } = useAuth(); // <--- USO DE useAuth

    // Hooks de la aplicación.
    const { toast } = useToast();
    const navigate = useNavigate();

    // Estados para gestionar la data y la interfaz de usuario.
    const [reservations, setReservations] = useState<Reserva[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [selectedReservation, setSelectedReservation] = useState<Reserva | null>(null);
    const [cancelReason, setCancelReason] = useState("");
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    
    // NUEVOS ESTADOS para la calificación
    const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);
    // ------------------------------------

    // Lógica de paginación.
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(reservations.length / ITEMS_PER_PAGE);

    // Obtiene el ID del pasajero directamente del estado del hook
    const pasajeroId = pasajeroData?.id; // <--- OBTENCIÓN DEL ID DESDE useAuth

    // Función para verificar el estado de la encuesta de una reserva (se mantiene igual)
    const checkSurveyStatus = async (reserva: Reserva): Promise<boolean> => {
        try {
            const variables = { reservaId: parseInt(reserva.id, 10) };
            const data = await executeGraphQLQuery(YA_RESPONDIO_ENCUESTA_QUERY, variables);
            // El resultado esperado es { yaRespondioEncuesta: true/false }
            return data?.yaRespondioEncuesta ?? false;
        } catch (error) {
            console.error(`Error al verificar encuesta para reserva ${reserva.id}:`, error);
            // Asumir que NO se ha respondido si hay un error para evitar bloquear
            return false; 
        }
    };

    // Lógica de Carga de Reservas: Consulta las reservas del usuario al servidor.
    const fetchMyReservations = async () => {
        setIsLoading(true);
        try {
            const variables = { pasajeroId: pasajeroId };
            const data = await executeGraphQLQuery(GET_MY_RESERVATIONS_QUERY, variables);

            if (data && data.misReservas) {
                // 1. Añadir el estado de la encuesta antes de ordenar
                const reservasWithSurveyStatus = await Promise.all(data.misReservas.map(async (reserva: Reserva) => {
                    const estadoFrontend = getFrontendStatus(reserva.estado, reserva.viaje.fecha, reserva.viaje.horaSalida, reserva.viaje.horaLlegada);
                    // SOLO verificar si está FINALIZADA
                    if (estadoFrontend === 'FINALIZADA') {
                        const respondida = await checkSurveyStatus(reserva);
                        return { ...reserva, encuestaRespondida: respondida };
                    }
                    return reserva;
                }));

                // 2. Lógica de ordenamiento (Mantenida sin cambios)
                const sortedReservas = [...reservasWithSurveyStatus].sort((a: Reserva, b: Reserva) => {
                    const dateA = getTripDateTime(a.viaje.fecha, a.viaje.horaSalida);
                    const dateB = getTripDateTime(b.viaje.fecha, b.viaje.horaSalida);
                    
                    const statusA = getFrontendStatus(a.estado, a.viaje.fecha, a.viaje.horaSalida, a.viaje.horaLlegada);
                    const statusB = getFrontendStatus(b.estado, b.viaje.fecha, b.viaje.horaSalida, b.viaje.horaLlegada);

                    if (statusA === 'ACTIVA' && statusB !== 'ACTIVA') return -1;
                    if (statusA !== 'ACTIVA' && statusB === 'ACTIVA') return 1;
                    if (statusA === 'EN_CURSO' && statusB !== 'EN_CURSO') return -1;
                    if (statusA !== 'EN_CURSO' && statusB === 'EN_CURSO') return 1;

                    return dateB.getTime() - dateA.getTime();
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
            console.error("Error al cargar las reservas:", error);
            toast({
                title: "Error al cargar las reservas",
                description: `Ocurrió un problema al obtener tus reservas. Por favor, intenta de nuevo.`,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Efecto para cargar las reservas al montar el componente o cambiar el pasajero.
    useEffect(() => {
        // La condición de carga ahora usa el ID de useAuth
        if (pasajeroId) { 
            fetchMyReservations();
        } 
        // Si no está autenticado, podría haber una redirección
        // manejada por Layout_Auth, pero el componente espera la data.
    }, [pasajeroId]);


    // ... Lógica de Cancelación (handleCancelReservation) (Mantenida sin cambios) ...

    const handleCancelReservation = async () => {
        if (!selectedReservation || !pasajeroId) return; // Asegurar que pasajeroId existe

        setIsCancelling(true);
        try {
            const variables = {
                reservaId: selectedReservation.id,
                pasajeroId: pasajeroId, // <--- Uso de pasajeroId de useAuth
            };

            const data = await executeGraphQLQuery(CANCEL_RESERVATION_MUTATION, variables);
            
            if (data && data.cancelarReserva.success) {
                toast({
                    title: "Cancelación Exitosa",
                    description: data.cancelarReserva.message || "Tu reserva ha sido cancelada correctamente.",
                });
                fetchMyReservations();
                setIsDetailsDialogOpen(false);
                setSelectedReservation(null);
                setCancelReason("");
            } else {
                throw new Error(data?.cancelarReserva?.message || "La cancelación no pudo completarse."); 
            }
        } catch (error) {
            console.error("Error en la cancelación:", error);
            toast({
                title: "Fallo en la cancelación",
                description: `No se pudo cancelar la reserva. Por favor, intenta más tarde.`,
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

    // NUEVO: Determina si una reserva puede ser calificada.
    const isRateable = useMemo(() => {
        if (!selectedReservation) return false;
        
        const estadoFrontend = getFrontendStatus(
            selectedReservation.estado, 
            selectedReservation.viaje.fecha, 
            selectedReservation.viaje.horaSalida,
            selectedReservation.viaje.horaLlegada
        );
        
        // 1. Debe estar FINALIZADA
        const isFinished = estadoFrontend === 'FINALIZADA';
        
        // 2. No debe haber sido respondida
        const alreadyAnswered = selectedReservation.encuestaRespondida ?? false;
        
        return isFinished && !alreadyAnswered;
    }, [selectedReservation]);


    // Lógica de Paginación.
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

    // Función que se ejecuta al enviar exitosamente la encuesta.
    const handleSuccessfulRating = () => {
        // Cierra el diálogo de detalles (que contiene el botón de calificar)
        setIsDetailsDialogOpen(false);
        // Fuerza una recarga de las reservas para que el estado `encuestaRespondida` se actualice
        fetchMyReservations();
    };

    // Manejo de estado de autenticación no listo o no autenticado
    if (!isAuthReady) {
        // Muestra un loader mientras se rehidrata el estado
        return (
            <Layout_Auth title="FleetGuard360" subtitle="Cargando...">
                <div className="flex justify-center items-center h-full min-h-[300px]">
                    <Bus className="h-10 w-10 animate-spin text-bus-primary" />
                    <p className="ml-3 text-lg font-medium">Cargando datos de sesión...</p>
                </div>
            </Layout_Auth>
        );
    }

    if (!isAuthenticated || !pasajeroId) {
        // Aunque Layout_Auth debería manejar la redirección, 
        // esto actúa como una segunda capa de seguridad si la ruta no está bien protegida.
        // Lo ideal es que Layout_Auth haga la redirección a /login
        return (
            <Layout_Auth title="FleetGuard360" subtitle="Mis Reservas">
                <div className="max-w-xl mx-auto text-center py-20 bg-white shadow-lg rounded-xl p-8">
                      <LogIn className="h-12 w-12 text-bus-primary mx-auto mb-4" />
                      <h2 className="text-2xl font-bold mb-4">Acceso Requerido</h2>
                      <p className="text-muted-foreground mb-6">
                        Debe ingresar para ver sus reservas. <br></br>
                        Por favor, inicie sesión.
                      </p>
                      <Button asChild className="bg-bus-primary hover:bg-bus-primary/90">
                        <Link to="/login">
                          <LogIn className="h-4 w-4 mr-2" />
                          Ingresar
                        </Link>
                      </Button>
                    </div>
            </Layout_Auth>
        );
    }

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
                                <Bus className="h-12 w-12 text-muted-foreground mx-auto mb-4" /> {/* Cambiado de Plane a Bus */}
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
                                    Política de cancelación: Se permite cancelar hasta la hora de salida sin ninguna penalidad.
                                </p>
                            </div>

                        </div>
                    )}
                    {/* NUEVO MODAL DE CALIFICACIÓN */}
                    {isRatingDialogOpen && selectedReservation && (
                        <CalificarServiceDialog
                            reservaId={selectedReservation.id}
                            onClose={() => setIsRatingDialogOpen(false)}
                            onSuccessfulSubmit={handleSuccessfulRating}
                        />
                    )}
                    {/* BOTONES DE ACCIÓN */}
                        <div className="flex flex-col gap-3 pt-4 border-t">
                        {/* 1. Botón Seguir Vehículo: Solo se muestra si isTrackable es true */}
                        {selectedReservation && isTrackable && (
                            <Button
                                onClick={handleTrackVehicle}
                                className="bg-bus-primary hover:bg-bus-primary/90 transition-smooth"
                            >
                                <Car className="h-4 w-4 mr-2" />
                                Seguir Vehículo
                            </Button>
                        )}

                        {/* 2. Botón Calificar Servicio: Solo se muestra si la reserva está FINALIZADA Y no ha sido calificada (isRateable) */}
                        {selectedReservation && 
                        getFrontendStatus(
                            selectedReservation.estado, 
                            selectedReservation.viaje.fecha, 
                            selectedReservation.viaje.horaSalida, 
                            selectedReservation.viaje.horaLlegada
                        ) === 'FINALIZADA' && (
                            <Button
                                onClick={() => setIsRatingDialogOpen(true)}
                                // Ya que el botón debe ser visible si está FINALIZADA, pero disabled si ya se respondió, 
                                // mantenemos el estado disabled, pero solo lo mostramos si es FINALIZADA.
                                disabled={!isRateable}
                                className={cn(
                                    "w-full transition-smooth",
                                    isRateable ? "bg-yellow-500 hover:bg-yellow-600/90" : "bg-gray-400 cursor-not-allowed"
                                )}
                            >
                                <Star className="h-4 w-4 mr-2" />
                                {selectedReservation.encuestaRespondida ? "Servicio Calificado" : "Calificar Servicio"}
                            </Button>
                        )}

                        {/* 3. Botón Cancelar Reserva: Solo se muestra si isCancellable es true */}
                        {selectedReservation && isCancellable && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button 
                                        variant="destructive" 
                                        disabled={isCancelling} // Mantenemos la lógica de loading/cancelling
                                        className="w-full"
                                    >
                                        <X className="h-4 w-4 mr-2" />
                                        {isCancelling ? "Cancelando..." : "Cancelar Reserva"}
                                    </Button>
                                </AlertDialogTrigger>
                                {/* El contenido de AlertDialogContent se mantiene igual */}
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
                    )}
                </div>
                </DialogContent>
            </Dialog>
        </Layout_Auth>
    );
};

export default MyReservations;