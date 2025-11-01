import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import Layout_Auth from "@/components/Layout_Auth";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea"; // RE-IMPORTADO: Necesario para el campo de motivo
import { Label } from "@/components/ui/label"; // Añadido: Necesario para la etiqueta del Textarea
import { // Se asume este componente existe en el frontend
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MapPin,
  Calendar as CalendarIcon,
  Clock,
  Users,
  Bus,
  XCircle,
  CheckCircle,
  RotateCcw,
  Info,
  Route,
  ArrowLeft,
  Ticket,
  ChevronLeft,
  ChevronRight,
  LogIn
} from "lucide-react";
import { format, isBefore, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
// Nota: Se ha removido la importación no utilizada de 'Label' de 'recharts'

// --- Configuración GraphQL y Endpoint ---
const GRAPHQL_ENDPOINT = 'http://localhost:8080/graphql';
const ITEMS_PER_PAGE = 5;

// --- Definiciones de Interfaz Adaptadas a la Query GraphQL ---

// Interfaz para la respuesta cruda de la API GraphQL
interface APIReserva {
  id: string; // Se asume que el backend incluye el ID de la reserva en misReservas
  viaje: {
    fecha: string; // YYYY-MM-DD
    horaSalida: string; // HH:MM:SS
    origen: string;
    destino: string;
  };
  cantidadAsientos: number;
  pasajerosAdicionales: { nombre: string }[];
  estado: 'ACTIVA' | 'COMPLETADA' | 'CANCELADA'; // Usando estados en mayúsculas como es común
}

// Interfaz para el estado de las Reservas en el Frontend (normalizado)
interface Reserva {
  id: string;
  fechaViaje: string;
  horaSalida: string;
  origen: string;
  destino: string;
  cantidadAsientos: number;
  // Simplificado para incluir solo los nombres de los pasajeros (principal + adicionales)
  pasajeros: { nombre: string }[];
  estado: 'ACTIVA' | 'COMPLETADA' | 'CANCELADA';
}

// 2. Definir la consulta de GraphQL para obtener reservas
const GET_MY_RESERVATIONS_QUERY = `
  query GetMyReservations($pasajeroId: ID!) {
    misReservas(pasajeroId: $pasajeroId) {
      id # ID de la reserva, crucial para la cancelación
      viaje {
        fecha
        horaSalida
        origen
        destino
      }
      cantidadAsientos
      pasajerosAdicionales {
        nombre
      }
      estado
    }
  }
`;

// 3. Definir la mutación para cancelar una reserva (MODIFICADA para incluir motivoCancelacion)
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
        }
        estado
      }
    }
  }
`;

// --- Función de Petición GraphQL (Implementada con el endpoint local) ---
async function executeGraphQLQuery(query: string, variables: any = {}): Promise<any> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        // En un entorno real, el token o la sesión manejarían la autenticación
        const response = await fetch(GRAPHQL_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Si el backend usa autenticación, aquí iría el header.
            'Authorization': 'Bearer ' + 'TOKEN_DE_USUARIO_SIMULADO',
          },
          body: JSON.stringify({
            query: query,
            variables: variables,
          }),
        });
        
        const result = await response.json();
        
        if (result.errors) {
          console.error("Errores GraphQL:", result.errors);
          // Si el error es de GraphQL, lo lanzamos para que se maneje en el catch
          throw new Error(result.errors[0]?.message || 'Error desconocido en GraphQL');
        }
        
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
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
    throw new Error("Fallo la petición después de múltiples reintentos.");
}

// --- Componente MyReservations (Mis Reservas) ---

const MyReservations = () => {
  const [reservations, setReservations] = useState<Reserva[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Estado para el cuadro de diálogo de cancelación
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState(""); // RE-INTRODUCIDO: Estado para el motivo de cancelación
  const [isCancelling, setIsCancelling] = useState(false);

  // 1. **GUARDIA DE AUTENTICACIÓN**
  const pasajeroId = localStorage.getItem('pasajeroId');

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

  // Función para obtener las reservas (Implementación con GraphQL)
  const fetchReservations = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Petición GraphQL con el ID del pasajero
      const data = await executeGraphQLQuery(GET_MY_RESERVATIONS_QUERY, { pasajeroId });
      
      const apiReservas: APIReserva[] = data.misReservas || [];

      // Normalización de la estructura de la API a la estructura del Frontend
      const normalizedReservas: Reserva[] = apiReservas.map((apiRes: APIReserva) => {
        // El pasajero principal + los adicionales (la lógica de quién es el principal 
        // y su nombre real depende de la implementación del backend, 
        // aquí asumimos que el principal tiene el asiento y los adicionales son listados)
        const principalPassenger = { nombre: "Pasajero Principal (Titular)" };
        const allPassengers = [principalPassenger, ...apiRes.pasajerosAdicionales];

        return {
          id: apiRes.id,
          fechaViaje: apiRes.viaje.fecha,
          horaSalida: apiRes.viaje.horaSalida,
          origen: apiRes.viaje.origen,
          destino: apiRes.viaje.destino,
          cantidadAsientos: apiRes.cantidadAsientos,
          pasajeros: allPassengers,
          estado: apiRes.estado,
        };
      });

      const sortedReservations = normalizedReservas.sort((a, b) => {
        // Ordenar: Activas primero, luego por fecha/hora
        if (a.estado === 'ACTIVA' && b.estado !== 'ACTIVA') return -1;
        if (a.estado !== 'ACTIVA' && b.estado === 'ACTIVA') return 1;

        const dateA = parseISO(`${a.fechaViaje}T${a.horaSalida}`);
        const dateB = parseISO(`${b.fechaViaje}T${b.horaSalida}`);

        if (a.estado === 'ACTIVA') {
          return isBefore(dateA, dateB) ? -1 : 1; // Activas: más cercanas primero
        } else {
          return isBefore(dateA, dateB) ? 1 : -1; // Histórico: más recientes primero
        }
      });

      setReservations(sortedReservations);
      toast({ title: "Reservas cargadas", description: `Se encontraron ${sortedReservations.length} reservas.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido al cargar reservas.";
      console.error("Error al cargar reservas:", error);
      toast({
        title: "Error de Carga",
        description: `No se pudieron obtener sus reservas. ${message}`,
        variant: "destructive",
      });
      // Si la carga falla, se dejan las reservas vacías
      setReservations([]);
    } finally {
      setIsLoading(false);
    }
  }, [pasajeroId, toast]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // Manejadores de Estado y Paginación
  const totalPages = Math.ceil(reservations.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentResults = reservations.slice(startIndex, endIndex);

  const getStatusBadge = (estado: Reserva['estado']) => {
    switch (estado) {
      case 'ACTIVA':
        return <Badge className="bg-green-600 hover:bg-green-600/90 text-white border-0"><CheckCircle className="h-3 w-3 mr-1" /> Activa</Badge>;
      case 'COMPLETADA':
        return <Badge variant="secondary"><Info className="h-3 w-3 mr-1" /> Completada</Badge>;
      case 'CANCELADA':
        return <Badge className="bg-red-600 hover:bg-red-600/90 text-white border-0"><XCircle className="h-3 w-3 mr-1" /> Cancelada</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  // Determina si una reserva puede ser cancelada
  const isCancelable = (reserva: Reserva) => {
    // 1. Debe estar en estado ACTIVA
    if (reserva.estado !== 'ACTIVA') return false;

    // 2. La hora de salida debe ser en el futuro
    // Se crea un objeto Date combinando fechaViaje y horaSalida
    // Asegúrate de que horaSalida esté en formato HH:MM:SS para evitar errores de parseo
    const departureTime = parseISO(`${reserva.fechaViaje}T${reserva.horaSalida}`);
    
    // Comprueba si la hora actual (new Date()) es anterior a la hora de salida
    return isBefore(new Date(), departureTime);
  };
  
  // Lógica de cancelación
  const handleInitiateCancel = (reservaId: string) => {
    setSelectedReservationId(reservaId);
    setCancelReason(""); // RE-INTRODUCIDO: Limpiar el estado del motivo al iniciar la cancelación
    setIsCancelDialogOpen(true);
  };

  // Lógica principal de cancelación que llama al endpoint GraphQL
  const handleCancelReservation = async () => {
    if (!selectedReservationId || !pasajeroId) {
        toast({ title: "Error", description: "Falta ID de reserva o ID de pasajero.", variant: "destructive" });
        return;
    }

    setIsCancelling(true);
    try {
      // Ejecutar mutación GraphQL, incluyendo el motivo de cancelación
      const data = await executeGraphQLQuery(CANCEL_RESERVATION_MUTATION, { 
        reservaId: selectedReservationId, 
        pasajeroId: pasajeroId, // Pasajero ID desde localStorage
        motivoCancelacion: cancelReason.trim() // Enviar el motivo (puede ser cadena vacía si no se ingresó)
      });
      
      const result = data?.cancelarReserva;

      if (result) {
        
        // Manejar la respuesta del servidor (success/message)
        if (result.success) {
          const updatedReserva = result.reserva;
          
          // 1. Mostrar resultados detallados (el mensaje es el requisito clave)
          toast({ 
            title: "Cancelación Exitosa", 
            description: result.message || `Reserva #${updatedReserva.codigoReserva} cancelada. Nuevo estado: ${updatedReserva.estado}.`,
            variant: "default"
          });

          // 2. Actualizar el estado local (para reflejar el cambio antes de la recarga)
          setReservations(prev => prev.map(res => 
            // Usamos el 'id' local para comparar, ya que 'reserva' de la respuesta es más un DTO
            res.id === selectedReservationId ? { ...res, estado: updatedReserva.estado } : res
          ));

          // 3. Recargar para reordenar la lista (Activas/Canceladas)
          // Esto asegura que la lista se reordene correctamente si el estado cambió.
          fetchReservations(); 
        } else {
          // La operación falló, usar el mensaje de error del backend
          throw new Error(result.message || "La cancelación falló por una regla de negocio del servidor.");
        }
      } else {
        throw new Error("Respuesta inválida del servidor GraphQL.");
      }


    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido al cancelar.";
      console.error("Error en la cancelación de GraphQL:", error);
      toast({
        title: "Fallo la Cancelación",
        description: `No se pudo cancelar la reserva. ${message}`,
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
      setIsCancelDialogOpen(false);
      setSelectedReservationId(null);
      setCancelReason(""); // Limpiar estado al cerrar
    }
  };
  
  // Renderizado del componente principal
  return (
    <Layout_Auth title="FleetGuard360" subtitle="Mis Reservas">
      <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-6">

        <Button
            variant="ghost"
            onClick={() => navigate('/search')}
            className="text-bus-primary hover:bg-bus-primary/10 font-semibold"
            disabled={isLoading}
        >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Búsqueda de Viajes
        </Button>
        
        {/* Política de Cancelación */}
        <Card className="shadow-card bg-yellow-50 border-yellow-500 border-l-4">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-yellow-700">
                    <Info className="h-5 w-5" /> Política de Cancelación
                </CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription className="text-yellow-600">
                    Se permite cancelar hasta la hora de salida del viaje; no se cobran penalidades en este alcance.
                </CardDescription>
            </CardContent>
        </Card>

        {/* Listado de Resultados */}
        <Card className="shadow-card bg-white/70 border">
          <CardHeader>
            <CardTitle className="text-2xl">
              Tus Viajes Reservados
              {reservations.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {reservations.length} encontradas
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Aquí encontrarás el detalle de todas tus reservas, activas e históricas, asociadas al pasajero ID: <span className="font-mono font-bold text-bus-primary/80">{pasajeroId}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? ( 
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-40 bg-gray-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : currentResults.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">
                    Aún no tienes reservas registradas.
                </p>
                <Button asChild className="mt-4 bg-bus-primary hover:bg-bus-primary/90">
                    <Link to="/search">¡Busca tu primer viaje!</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {currentResults.map((reserva) => (
                  <Card key={reserva.id} className="shadow-sm border hover:shadow-lg transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="grid md:grid-cols-4 gap-4 items-center">
                        
                        {/* Estado y ID */}
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                {getStatusBadge(reserva.estado)}
                                <span className="text-sm text-muted-foreground font-semibold">Reserva #{reserva.id}</span>
                            </div>
                            <div className="flex items-center gap-1 pt-2">
                                <Route className="h-4 w-4 text-gray-500" />
                                <span className="font-medium text-lg truncate">
                                    {reserva.origen} → {reserva.destino}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                Origen: <span className="font-medium text-foreground">{reserva.origen}</span>
                            </div>
                        </div>

                        {/* Fecha y Hora */}
                        <div className="space-y-1">
                            <div className="flex items-center gap-1">
                                <CalendarIcon className="h-4 w-4 text-indigo-500" />
                                <span className="font-medium text-base">{format(parseISO(reserva.fechaViaje), "PPP", { locale: es })}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                                <Clock className="h-4 w-4 text-indigo-500" />
                                <span className="text-sm text-muted-foreground">Hora de Salida: <span className="font-semibold text-foreground">{reserva.horaSalida}</span></span>
                            </div>
                        </div>

                        {/* Asientos y Pasajeros */}
                        <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Ticket className="h-4 w-4" />
                                <span className="font-medium text-foreground">{reserva.cantidadAsientos} Asientos</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Users className="h-4 w-4" />
                                <span className="font-medium text-foreground">{reserva.pasajeros.length} Pasajeros</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                                Acompañantes: {reserva.pasajeros.slice(1).map(p => p.nombre).join(', ') || "Ninguno"}
                            </p>
                        </div>
                        
                        {/* Botón de Cancelar */}
                        <div className="text-right flex flex-col items-end">
                            <Button
                                onClick={() => handleInitiateCancel(reserva.id)}
                                disabled={!isCancelable(reserva)}
                                variant="destructive"
                                className={cn(
                                    "w-full md:w-auto transition-smooth",
                                    !isCancelable(reserva) && "bg-gray-200 text-gray-500 hover:bg-gray-300 cursor-not-allowed"
                                )}
                                aria-label={`Cancelar reserva ${reserva.id}`}
                            >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Cancelar Reserva
                            </Button>
                            {!isCancelable(reserva) && reserva.estado === 'ACTIVA' && (
                                <p className="text-xs text-red-600 mt-1">
                                    Hora límite de cancelación superada.
                                </p>
                            )}
                            {reserva.estado !== 'ACTIVA' && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    {reserva.estado === 'CANCELADA' ? 'Esta reserva ya fue cancelada.' : 'Reserva completada/finalizada.'}
                                </p>
                            )}
                        </div>
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
                      Página {currentPage} de {totalPages} (Mostrando {Math.min(endIndex, reservations.length)} de {reservations.length} reservas)
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
        
        {/* Cuadro de Diálogo de Confirmación de Cancelación - MODIFICADO */}
        <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                    <XCircle className="h-6 w-6" /> ¿Confirmas la cancelación de la reserva #{selectedReservationId}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              
              {/* CAMPO DE ENTRADA DE TEXTO PARA EL MOTIVO */}
              <div className="space-y-2">
                  <Label htmlFor="cancelReason" className="font-semibold">Motivo de la Cancelación (Opcional):</Label>
                  <Textarea
                      id="cancelReason"
                      placeholder="Escribe el motivo de la cancelación aquí (Ej: Cambio de planes, error de fecha, etc.)"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={4}
                      maxLength={255}
                      disabled={isCancelling}
                  />
                  <p className="text-xs text-muted-foreground">{cancelReason.length}/255 caracteres</p>
              </div>

              <AlertDialogFooter>
                    <AlertDialogCancel disabled={isCancelling}>No, Mantener</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleCancelReservation} 
                        className="bg-red-600 hover:bg-red-700"
                        disabled={isCancelling}
                    >
                        {isCancelling ? "Cancelando..." : "Sí, Cancelar Reserva"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        
      </div>
    </Layout_Auth>
  );
};

export default MyReservations;