import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import Layout_Auth from "@/components/Layout_Auth";
import {
    MapPin,
    Calendar as CalendarIcon,
    Clock,
    Users,
    Info,
    User,
    ListOrdered,
    ArrowRight,
    Minus,
    Plus,
    CheckCircle,
    XCircle,
    ArrowLeft,
    Ticket,
    Hash,
    LogIn
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Función de utilidad para manejar fechas en formato YYYY-MM-DD (sin hora)
// Esto evita que la fecha se muestre como el día anterior debido a la conversión UTC/local
const parseDateForDisplay = (dateString: string) => {
    // Si la cadena es nula o vacía, devuelve una fecha actual o un objeto Date no válido
    if (!dateString) return new Date(); 
    
    // Si solo tiene la fecha (YYYY-MM-DD), le añadimos la hora 'T00:00:00' 
    // para forzar a que Date la interprete como local al inicio del día.
    if (!dateString.includes('T') && dateString.length === 10) {
        return new Date(dateString + 'T00:00:00'); 
    }
    
    // Si ya viene con hora o es un formato completo (ej: de fechaReserva), la usamos directamente.
    return new Date(dateString);
};


// --- Tipos de Datos ---
interface Pasajero {
    nombre: string;
    identificacion: string;
}

interface Viaje {
    id: string;
    origen: string;
    destino: string;
    fecha: string; // YYYY-MM-DD
    horaSalida: string; // HH:MM
    cuposDisponibles: number;
    horaLlegada?: string; 
}

// Tipo de la respuesta de GraphQL para mostrarla
interface ReservaInfo {
    fechaReserva: string;
    codigoReserva: string;
    pasajero: { nombre: string; apellido: string; };
    viaje: { origen: string; destino: string; fecha: string; horaSalida: string; horaLlegada: string; };
    cantidadAsientos: number;
}
interface GraphQLResponse {
    success: boolean;
    message: string;
    reserva?: ReservaInfo;
}

// --- Componente principal de Reserva ---
const ReservationPage = () => {
    // Inicializa hooks para navegación, notificaciones (toast) y parámetros de URL.
    const navigate = useNavigate();
    const { toast } = useToast();
    const [searchParams] = useSearchParams();

    // --- Extracción de datos del Viaje desde la URL (Query Params) ---
    // Procesa los parámetros de la URL para construir el objeto de datos del viaje.
    const viajeData: Viaje = useMemo(() => {
        const id = searchParams.get('viajeId') || '';
        const origen = searchParams.get('viajeOrigen') || '';
        const destino = searchParams.get('viajeDestino') || '';
        const fecha = searchParams.get('viajeFecha') || '';
        const horaSalida = searchParams.get('viajeHora') || '';
        const cuposStr = searchParams.get('viajeCuposDisponibles');
        const cuposDisponibles = cuposStr ? parseInt(cuposStr, 10) : 0;
        
        const horaLlegada = "N/A"; // No está en la URL, se mantiene como N/A si no viene del backend de éxito.

        return { id, origen, destino, fecha, horaSalida, cuposDisponibles, horaLlegada };
    }, [searchParams]);

    const viaje: Viaje = viajeData;
    
    // Bandera para verificar la completitud de los datos del viaje.
    const isViajeDataMissing = !viaje.id || !viaje.origen || !viaje.destino || !viaje.fecha || !viaje.horaSalida;


    // --- Extracción de datos del Pasajero desde LocalStorage ---
    // Obtiene el nombre completo del pasajero principal de LocalStorage.
    const pasajeroNombreCompleto = useMemo(() => {
        const nombre = localStorage.getItem('pasajeroNombre') || '';
        const apellido = localStorage.getItem('pasajeroApellido') || '';
        return { nombre, apellido, completo: `${nombre} ${apellido}`.trim() };
    }, []);

    // Obtiene el ID del pasajero principal de LocalStorage.
    const pasajeroId = useMemo(() => localStorage.getItem('pasajeroId'), []);
    
    // Bandera para verificar si faltan datos del pasajero principal.
    const isPasajeroDataMissing = !pasajeroNombreCompleto.nombre || !pasajeroId;


    // --- Estados del Formulario ---
    // Almacena la cantidad de asientos a reservar.
    const [asientos, setAsientos] = useState(1);
    // Almacena los datos de los pasajeros adicionales.
    const [pasajerosAdicionales, setPasajerosAdicionales] = useState<Pasajero[]>([]);
    // Almacena los errores de validación del formulario.
    const [errors, setErrors] = useState<Record<string, string>>({});
    // Indica si se está esperando una respuesta del servidor.
    const [loading, setLoading] = useState(false);
    // Almacena el resultado de la operación de reserva.
    const [reservationResult, setReservationResult] = useState<GraphQLResponse | null>(null);
    // -----------------------------

    // ----------------------------------------------------------------------
    // --- VALIDACIÓN Y REDIRECCIÓN INICIAL ---
    // ----------------------------------------------------------------------
    
    // 1. Prioridad: Falta información del Pasajero (LocalStorage) -> Ir a Registro
    if (!pasajeroId) {
    return (
      <Layout title="FleetGuard360" subtitle="Búsqueda de Viajes">
        <div className="max-w-xl mx-auto text-center py-20 bg-white shadow-lg rounded-xl p-8">
          <LogIn className="h-12 w-12 text-bus-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Acceso Requerido</h2>
          <p className="text-muted-foreground mb-6">
            Debe ingresar para reservar. <br></br>
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

    // 2. Segunda Prioridad: Falta información del Viaje (URL) -> Ir a Búsqueda
    if (isViajeDataMissing) {
        return <Layout_Auth title="Error" subtitle="Datos de viaje incompletos">
            <div className="text-center py-20 space-y-4">
                <p className="text-xl font-bold text-red-600"> No se pudo cargar el viaje.</p>
                <p className="text-sm text-muted-foreground">Por favor, vuelva a la búsqueda y selecciona un viaje válido.</p>
                <Button 
                    onClick={() => navigate('/search')} 
                    variant="link" 
                    className="text-bus-primary"
                >
                    Ir a la Búsqueda de Viajes
                </Button>
            </div>
        </Layout_Auth>;
    }
    
    // ----------------------------------------------------------------------

    // El componente de éxito se renderiza si la reserva es exitosa
    if (reservationResult && reservationResult.success && reservationResult.reserva) {
        const reserva = reservationResult.reserva;
        
        // Se utiliza la fecha del viaje de la URL para el display.
        const displayedViaje: Viaje = {
            ...viaje,
            horaLlegada: reserva.viaje?.horaLlegada || viaje.horaLlegada // Usar horaLlegada del resultado si está disponible
        };
        
        return (
            <Layout_Auth title="Reserva Confirmada" subtitle="¡Tu viaje está asegurado!">
                <div className="max-w-xl mx-auto space-y-8 text-center">
                    <CheckCircle className="h-20 w-20 mx-auto text-green-500" />
                    <Card className="shadow-2xl border-green-500/50">
                        <CardHeader className="bg-green-50/50">
                            <CardTitle className="text-3xl text-green-700">¡Reserva Exitosa!</CardTitle>
                            <CardDescription>
                                Código de Reserva: <strong className="text-lg text-green-600">{reserva.codigoReserva}</strong>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4 text-left">
                            <h4 className="text-lg font-bold border-b pb-2 text-bus-primary">Detalles de la Reserva</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center gap-2"><Ticket className="h-4 w-4 text-muted-foreground" /> <strong>Asientos:</strong> {reserva.cantidadAsientos}</div>
                                <div className="flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-muted-foreground" /> <strong>Fecha Reserva:</strong> {format(parseDateForDisplay(reserva.fechaReserva), "PPP", { locale: es })}</div>
                                <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> <strong>Reservado por:</strong> {reserva.pasajero.nombre} {reserva.pasajero.apellido}</div>
                                <div className="flex items-center gap-2"><Hash className="h-4 w-4 text-muted-foreground" /> <strong>Viaje ID:</strong> {viaje.id}</div>
                            </div>
                            
                            <h4 className="text-lg font-bold border-b pb-2 pt-4 text-bus-primary">Detalles del Viaje</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> <strong>Ruta:</strong> {displayedViaje.origen} <ArrowRight className="h-3 w-3" /> {displayedViaje.destino}</div>
                                {/* USAMOS displayedViaje.fecha (Que viene del URL) */}
                                <div className="flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-muted-foreground" /> <strong>Fecha Viaje:</strong> {format(parseDateForDisplay(displayedViaje.fecha), "PPP", { locale: es })}</div> 
                                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> <strong>Salida:</strong> {displayedViaje.horaSalida}</div>
                                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> <strong>Llegada:</strong> {displayedViaje.horaLlegada || 'N/A'}</div>
                            </div>
                        </CardContent>
                    </Card>
                    <div className="flex justify-center space-x-4">
                        {/* Botón añadido para ir a la búsqueda */}
                        <Button 
                            onClick={() => navigate('/search')} 
                            variant="outline" 
                            className="border-bus-primary text-bus-primary hover:bg-bus-primary/10"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Buscar otro Viaje
                        </Button>
                        
                        {/* Botón original */}
                        <Button onClick={() => navigate('/mis-reservas')} className="bg-bus-primary hover:bg-bus-primary/90">
                            Ver Mis Reservas
                        </Button>
                    </div>
                </div>
            </Layout_Auth>
        );
    }
    
    // Si la reserva falló, mostrar el mensaje de error
    if (reservationResult && !reservationResult.success) {
        return (
            <Layout_Auth title="Reserva Fallida" subtitle="Ha ocurrido un error al procesar tu solicitud.">
                <div className="max-w-xl mx-auto space-y-8 text-center">
                    <XCircle className="h-20 w-20 mx-auto text-red-500" />
                    <Card className="shadow-2xl border-red-500/50">
                        <CardHeader className="bg-red-50/50">
                            <CardTitle className="text-3xl text-red-700">Error al Reservar</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <p className="text-lg font-medium text-red-800">{reservationResult.message}</p>
                            <Button onClick={() => setReservationResult(null)} className="mt-4 bg-red-600 hover:bg-red-700">
                                Intentar de Nuevo
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </Layout_Auth>
        );
    }

    // --- Lógica de Manejo de Asientos y Pasajeros Adicionales ---
    // Función para manejar el incremento/decremento de asientos.
    const handleSetAsientos = (newCount: number) => {
        if (newCount < 1) return;
        if (newCount > viaje.cuposDisponibles) return;

        setAsientos(newCount);
        
        // Ajustar el array de pasajeros adicionales al número de asientos - 1.
        const additionalCount = newCount - 1;
        setPasajerosAdicionales(prev => {
            if (prev.length < additionalCount) {
                const newPassengers = Array(additionalCount - prev.length).fill(null).map(() => ({ nombre: "", identificacion: "" }));
                return [...prev, ...newPassengers];
            } else if (prev.length > additionalCount) {
                return prev.slice(0, additionalCount);
            }
            return prev;
        });
        setErrors({});
    };

    // Función para actualizar los datos de un pasajero adicional.
    const handlePassengerChange = (index: number, field: keyof Pasajero, value: string) => {
        setPasajerosAdicionales(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
        setErrors({});
    };

    // Valida que todos los campos de pasajeros estén completos.
    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};
        
        if (asientos < 1) {
            newErrors.general = "Debe reservar al menos un asiento.";
        }

        pasajerosAdicionales.forEach((pasajero, index) => {
            if (!pasajero.nombre.trim()) {
                newErrors[`nombre${index}`] = "El nombre es obligatorio.";
            }
            if (!pasajero.identificacion.trim()) {
                newErrors[`id${index}`] = "La identificación es obligatoria.";
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // --- LÓGICA DE PETICIÓN GRAPHQL ---
    // Función principal para enviar la solicitud de reserva al servidor GraphQL.
    const handleReservation = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            toast({
                title: "Error de Validación",
                description: "Por favor, completa todos los campos de los pasajeros adicionales.",
                variant: "destructive",
            });
            return;
        }
        
        const isConfirmed = window.confirm(
            `¿Confirmas la reserva de ${asientos} asiento(s) para el viaje de ${viaje.origen} a ${viaje.destino}?`
        );

        if (!isConfirmed) return;

        // 1. Obtener datos requeridos
        const viajeIdInt = parseInt(viaje.id); 

        if (!pasajeroId || isNaN(viajeIdInt)) {
            toast({
                title: "Error de Datos",
                description: "Falta el ID del pasajero o el ID del viaje es inválido.",
                variant: "destructive",
            });
            return;
        }

        // 2. Construir la lista de adicionales en formato GraphQL (JSON)
        const adicionalesGraphQL = pasajerosAdicionales.map(p => 
            // Escapar comillas para evitar errores en la cadena GraphQL
            `{nombre:\"${p.nombre.replace(/"/g, '\\"')}\",identificacion:\"${p.identificacion.replace(/"/g, '\\"')}\"}`
        ).join(',');
        
        // 3. Construir el Query de GraphQL
        const GQL_QUERY = `
            mutation {
                crearReserva(
                    input: {
                        viajeId: ${viajeIdInt},
                        cantidadAsientos: ${asientos},
                        adicionales: [${adicionalesGraphQL}]
                    },
                    pasajeroId: \"${pasajeroId}\"
                ) {
                    success
                    message
                    reserva {
                        fechaReserva
                        codigoReserva
                        pasajero {
                            nombre
                            apellido
                        }
                        viaje {
                            origen
                            destino
                            fecha
                            horaSalida
                            horaLlegada
                        }
                        cantidadAsientos
                    }
                }
            }
        `;

        setLoading(true);
        setReservationResult(null); // Limpiar resultado anterior

        try {
            const response = await fetch('http://localhost:8080/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: GQL_QUERY
                }),
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const jsonResponse = await response.json();
            const resultData = jsonResponse.data?.crearReserva;

            if (resultData) {
                setReservationResult(resultData);
                if (resultData.success) {
                    toast({
                        title: "Reserva Exitosa",
                        description: `Tu reserva ${resultData.reserva.codigoReserva} ha sido confirmada.`,
                        variant: "default",
                    });
                } else {
                    toast({
                        title: "Reserva Fallida",
                        description: resultData.message || "Error desconocido al procesar la reserva.",
                        variant: "destructive",
                    });
                }
            } else if (jsonResponse.errors) {
                // Manejar errores de GraphQL
                const errorMsg = jsonResponse.errors.map((e: any) => e.message).join(' | ');
                setReservationResult({ success: false, message: `Error en la solicitud: ${errorMsg}` });
                toast({
                    title: "Error en el Servidor",
                    description: "Ocurrió un error al procesar la solicitud.",
                    variant: "destructive",
                });
            }

        } catch (error: any) {
            console.error("Error al realizar la reserva:", error);
            // Mensaje de error modificado para no revelar detalles de la conexión
            setReservationResult({ success: false, message: `No se pudo completar la reserva. Inténtalo de nuevo.` });
            toast({
                title: "Error de Conexión",
                description: "No se pudo comunicar con el servidor. Intenta de nuevo.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    // --- Renderizado del Formulario ---
    return (
        <Layout_Auth title="FleetGuard 360" subtitle={"Reservar Viaje"}>
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Botón de Regreso */}
                <Button
                    variant="ghost"
                    onClick={() => navigate(-1)}
                    className="text-bus-primary hover:bg-bus-primary/10 font-semibold"
                    disabled={loading}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Búsqueda
                </Button>

                <Card className="shadow-card bg-gradient-card border-0">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <CheckCircle className="h-6 w-6 text-bus-primary" />
                            Confirmar Reserva
                        </CardTitle>
                        <CardDescription>
                            Verifica los detalles del viaje y especifica la cantidad de asientos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleReservation} className="space-y-6" noValidate>
                            
                            {/* Bloque: Detalles del Viaje (Datos de la URL) */}
                            <h3 className="flex items-center gap-2 text-lg font-semibold border-b pb-2 mb-4 text-bus-primary">
                                <ListOrdered className="h-5 w-5" /> Detalles del Viaje
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-gray-50/50 p-4 rounded-lg">
                                <div className="flex items-center gap-1"><MapPin className="h-4 w-4 text-muted-foreground" /><span className="font-medium">Origen: {viaje.origen}</span></div>
                                <div className="flex items-center gap-1"><ArrowRight className="h-4 w-4 text-muted-foreground" /><span className="font-medium">Destino: {viaje.destino}</span></div>
                                {/* APLICACIÓN DE LA CORRECCIÓN: parseDateForDisplay */}
                                <div className="flex items-center gap-1"><CalendarIcon className="h-4 w-4 text-muted-foreground" /><span className="font-medium">Fecha: {format(parseDateForDisplay(viajeData.fecha), "PPP", { locale: es })}</span></div>
                                <div className="flex items-center gap-1"><Clock className="h-4 w-4 text-muted-foreground" /><span className="font-medium">Hora: {viaje.horaSalida}</span></div>
                            </div>

                            {/* Bloque: Selección de Asientos */}
                            <h3 className="flex items-center gap-2 text-lg font-semibold border-b pb-2 pt-4 mb-4 text-bus-primary">
                                <Users className="h-5 w-5" /> Cantidad de Asientos
                            </h3>
                            <div className="flex items-center justify-between bg-gray-50/50 p-4 rounded-lg border">
                                <Label className="text-base font-medium">Asientos a reservar (Mínimo 1)</Label>
                                <div className="flex items-center gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleSetAsientos(asientos - 1)}
                                        disabled={asientos <= 1 || loading}
                                        aria-label="Disminuir asientos"
                                    >
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <span className="text-xl font-bold w-6 text-center">{asientos}</span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleSetAsientos(asientos + 1)}
                                        disabled={asientos >= viaje.cuposDisponibles || loading}
                                        aria-label="Aumentar asientos"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Cupos disponibles: {viaje.cuposDisponibles - asientos}
                            </p>

                            {/* Bloque: Información del Pasajero Principal (Datos de LocalStorage) */}
                            <h3 className="flex items-center gap-2 text-lg font-semibold border-b pb-2 pt-4 mb-4 text-bus-primary">
                                <User className="h-5 w-5" /> Pasajero Principal (Tú)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input value={pasajeroNombreCompleto.nombre} disabled placeholder="Nombre" />
                                <Input value={pasajeroNombreCompleto.apellido} disabled placeholder="Apellido" />
                                {/* Se ha ELIMINADO el input para el pasajeroId/Identificación del principal */}
                            </div>

                            {/* Bloque: Pasajeros Adicionales */}
                            {asientos > 1 && (
                                <>
                                    <h3 className="flex items-center gap-2 text-lg font-semibold border-b pb-2 pt-4 mb-4 text-bus-primary">
                                        <ListOrdered className="h-5 w-5" /> Pasajeros Adicionales ({asientos - 1})
                                    </h3>
                                    <div className="space-y-6">
                                        {pasajerosAdicionales.map((pasajero, index) => (
                                            <Card key={index} className="p-4 bg-white shadow-sm border">
                                                <CardTitle className="text-base mb-3">Pasajero {index + 1}</CardTitle>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <Input
                                                            placeholder="Nombre Completo"
                                                            value={pasajero.nombre}
                                                            onChange={(e) => handlePassengerChange(index, 'nombre', e.target.value)}
                                                            className={errors[`nombre${index}`] ? "border-bus-danger focus:ring-bus-danger" : ""}
                                                            disabled={loading}
                                                        />
                                                        {errors[`nombre${index}`] && <p className="text-sm text-bus-danger">{errors[`nombre${index}`]}</p>}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Input
                                                            placeholder="Identificación"
                                                            value={pasajero.identificacion}
                                                            onChange={(e) => handlePassengerChange(index, 'identificacion', e.target.value)}
                                                            className={errors[`id${index}`] ? "border-bus-danger focus:ring-bus-danger" : ""}
                                                            disabled={loading}
                                                        />
                                                        {errors[`id${index}`] && <p className="text-sm text-bus-danger">{errors[`id${index}`]}</p>}
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </>
                            )}
                            
                            {/* Política de Cancelación */}
                            <div className="flex items-start gap-2 p-3 text-sm bg-bus-info/10 border border-bus-info text-bus-info rounded-lg">
                                <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
                                <p className="font-medium">
                                    Política de Cancelación: <span className="font-normal">Se permite cancelar hasta la hora de salida sin ninguna penalidad.</span>
                                </p>
                            </div>

                            {/* Botón Final de Reserva */}
                            <Button
                                type="submit"
                                className="w-full bg-accent hover:bg-accent-hover text-accent-foreground shadow-button transition-smooth h-12 text-lg font-semibold"
                                disabled={asientos > viaje.cuposDisponibles || loading}
                            >
                                {loading ? "Procesando Reserva..." : `Confirmar y Reservar ${asientos} Asiento(s)`}
                            </Button>
                            {errors.general && <p className="text-center text-bus-danger mt-2">{errors.general}</p>}

                        </form>
                    </CardContent>
                </Card>
            </div>
        </Layout_Auth>
    );
};

export default ReservationPage;