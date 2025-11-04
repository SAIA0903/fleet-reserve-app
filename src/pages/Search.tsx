import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import Layout_Auth from "@/components/Layout_Auth";
import {
  Search as SearchIcon,
  MapPin,
  Calendar as CalendarIcon,
  Clock,
  Users,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Info,
  ListOrdered,
  LogIn // <-- Ícono LogIn añadido
} from "lucide-react";
// Importamos 'addDays' de date-fns para el ajuste de fecha
import { format, parseISO, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

// --- Configuración GraphQL ---
// El endpoint se mantiene en el puerto 8080 local
const GRAPHQL_ENDPOINT = 'http://localhost:8080/graphql';

// 1. Definir la interfaz 'Viaje'
interface Viaje {
  id: string;
  origen: string;
  destino: string;
  fecha: string;
  horaSalida: string;
  horaLlegada: string; // Incluida para determinar el fin del viaje
  cuposTotales: number;
  cuposDisponibles: number;
  estado: string;
}

// 2. Definir la consulta de GraphQL parametrizada para buscar viajes
const BUSCAR_VIAJES_QUERY = `
  query BuscarViajes($input: BuscarViajesInput!) {
    buscarViajes(input: $input) {
      id
      origen
      destino
      fecha
      horaSalida
      horaLlegada
      cuposTotales
      cuposDisponibles
      estado
    }
  }
`;

// 3. Definir la consulta para obtener la lista de ciudades
const BUSCAR_CIUDADES_QUERY_LIST = `
  query {
    buscarCiudades
  }
`;

// Constante para la paginación
const ITEMS_PER_PAGE = 10;

// Obtener credenciales de localStorage (accesibles a nivel de módulo)
const token = localStorage.getItem('token');
const pasajeroId = localStorage.getItem('pasajeroId');

// =========================================================================
// --- Lógica de Fechas (MODIFICADA) ---
// =========================================================================

/**
 * Combina fecha (YYYY-MM-DD) y hora (HH:mm:ss) en un objeto Date,
 * forzando la interpretación en la zona horaria local del usuario para evitar desfases.
 * * @param dateStr La fecha del viaje (YYYY-MM-DD), que es la fecha de SALIDA.
 * @param timeStr La hora a establecer (HH:mm:ss).
 * @param isArrivalTime Indica si la hora es de llegada. Requiere 'timeOfDeparture' para el cálculo de cambio de día.
 * @param timeOfDeparture La hora de salida (HH:mm:ss), necesaria para determinar si la llegada es al día siguiente.
 */
const getTripDateTime = (dateStr: string, timeStr: string, isArrivalTime: boolean = false, timeOfDeparture: string | null = null): Date => {
  // 1. Parseamos la fecha ISO YYYY-MM-DD.
  let tripDateTime = parseISO(dateStr);

  // 2. Extraemos las horas, minutos y segundos de timeStr (ej: "15:30:00").
  const [hoursStr, minutesStr, secondsStr = '0'] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  const seconds = parseInt(secondsStr, 10);

  // 3. Establecemos la hora, minutos y segundos.
  tripDateTime.setHours(hours, minutes, seconds, 0);

  // 4. Lógica de ajuste para la hora de llegada si es anterior a la hora de salida.
  if (isArrivalTime && timeOfDeparture) {
    const [depHoursStr, depMinutesStr] = timeOfDeparture.split(':');
    const depHours = parseInt(depHoursStr, 10);
    const depMinutes = parseInt(depMinutesStr, 10);

    // Creamos un Date para la salida solo con la hora para comparar.
    // Esto es puramente comparativo para el "día siguiente".
    const departureTimeOnly = new Date(0); // Fecha arbitraria
    departureTimeOnly.setHours(depHours, depMinutes);

    // Creamos un Date para la llegada solo con la hora para comparar.
    const arrivalTimeOnly = new Date(0); // Fecha arbitraria
    arrivalTimeOnly.setHours(hours, minutes);

    // Si la hora de llegada es estrictamente ANTES que la hora de salida,
    // asumimos que el viaje termina al día siguiente.
    if (arrivalTimeOnly.getTime() < departureTimeOnly.getTime()) {
      // Añadimos un día a la fecha, que inicialmente es la fecha de salida.
      tripDateTime = addDays(tripDateTime, 1);
    }
  }

  return tripDateTime;
};

/**
 * Determina si el viaje ya ha iniciado (la hora de salida es en el pasado).
 */
const isTripStarted = (dateStr: string, timeStr: string): boolean => {
  const tripDateTime = getTripDateTime(dateStr, timeStr, false); // Es hora de salida
  const now = new Date();
  return now > tripDateTime;
};

/**
 * Determina si el viaje ya finalizó (la hora de llegada es en el pasado),
 * considerando el posible cambio de día.
 * * @param dateStr Fecha de salida.
 * @param arrivalTimeStr Hora de llegada.
 * @param departureTimeStr Hora de salida.
 */
const isTripEnded = (dateStr: string, arrivalTimeStr: string, departureTimeStr: string): boolean => {
    // Usamos la lógica de getTripDateTime para calcular la hora de llegada correcta (con o sin día extra)
    const tripEndDateTime = getTripDateTime(dateStr, arrivalTimeStr, true, departureTimeStr);
    const now = new Date();
    return now > tripEndDateTime;
};
// =========================================================================
// --- FIN Lógica de Fechas (MODIFICADA) ---
// =========================================================================

// --- Función de Petición GraphQL (Se mantiene igual) ---
async function executeGraphQLQuery(query: string, variables: any = {}): Promise<any> {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
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

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Error desconocido en GraphQL');
      }

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
      }

      return result.data;

    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error; // Lanzar el error final
      }
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
  throw new Error("Fallo la petición después de múltiples reintentos.");
}

// Componente principal
const Search = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [isCitiesLoading, setIsCitiesLoading] = useState(true);

  // --- AÑADIDO: Verificación de Sesión (Se mantiene igual) ---
  if (!pasajeroId) {
    return (
      <Layout title="FleetGuard360" subtitle="Búsqueda de Viajes">
        <div className="max-w-xl mx-auto text-center py-20 bg-white shadow-lg rounded-xl p-8">
          <LogIn className="h-12 w-12 text-bus-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Acceso Requerido</h2>
          <p className="text-muted-foreground mb-6">
            Debe ingresar para buscar viajes. <br></br>
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
  // --- FIN AÑADIDO ---

  // --- Lógica de Carga de Ciudades (Se mantiene igual) ---
  const fetchCities = async () => {
    setIsCitiesLoading(true);
    try {
      const data = await executeGraphQLQuery(BUSCAR_CIUDADES_QUERY_LIST);
      const fetchedCities: string[] = data?.buscarCiudades || [];
      
      sessionStorage.setItem('cities', JSON.stringify(fetchedCities));
      setAvailableCities(fetchedCities);

    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de red o servidor desconocido.";
      console.error("Error fetching cities:", error);
      toast({
        title: "Error de conexión",
        description: `No se pudieron cargar las ciudades disponibles. ${message}`,
        variant: "destructive",
      });
      setAvailableCities([]);
    } finally {
      setIsCitiesLoading(false);
    }
  };

  useEffect(() => {
    const cachedCities = sessionStorage.getItem('cities');
    
    if (cachedCities) {
      try {
        const parsedCities: string[] = JSON.parse(cachedCities);
        setAvailableCities(parsedCities);
        setIsCitiesLoading(false);
      } catch (e) {
        console.error("Error parsing cached cities, refetching:", e);
        sessionStorage.removeItem('cities');
        fetchCities();
      }
    } else {
      fetchCities();
    }
  }, []);
  // --- FIN Lógica de Carga de Ciudades ---


  const [searchData, setSearchData] = useState({
    origin: "",
    destination: "",
    date: undefined as Date | undefined
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [results, setResults] = useState<Viaje[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!searchData.origin) newErrors.origin = "Ingresa Ciudad de Origen";
    if (!searchData.destination) newErrors.destination = "Ingresa Ciudad de Destino";
    if (!searchData.date) newErrors.date = "Ingresa Fecha";
    if (searchData.origin && searchData.destination && searchData.origin === searchData.destination) {
      newErrors.destination = "Origen y destino no pueden ser iguales";
      newErrors.origin = "Origen y destino no pueden ser iguales";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setHasSearched(true);
    setResults([]);
    setCurrentPage(1);

    try {
      const fechaISO = format(searchData.date!, "yyyy-MM-dd");

      const variables = {
        input: {
          origen: searchData.origin,
          destino: searchData.destination,
          fecha: fechaISO,
        },
      };

      const data = await executeGraphQLQuery(BUSCAR_VIAJES_QUERY, variables);

      if (data && data.buscarViajes) {
        const sortedViajes = [...data.buscarViajes].sort((a: Viaje, b: Viaje) =>
          a.horaSalida.localeCompare(b.horaSalida)
        );

        setResults(sortedViajes);
        toast({
          title: "Búsqueda completada",
          description: `Se encontraron ${sortedViajes.length} opciones de viaje`,
        });
      } else {
        toast({
          title: "Sin resultados",
          description: "No se encontraron viajes para los criterios seleccionados.",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de red o servidor desconocido.";
      console.error("Error en la búsqueda de GraphQL:", error);
      toast({
        title: "Error en la búsqueda",
        description: `No se pudieron obtener los resultados. ${message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailabilityColor = (available: number, total: number, isRunning: boolean, isPast: boolean) => {
    if (isPast) return "bg-gray-400"; // Gris para finalizado/transcurrido
    if (isRunning) return "bg-blue-500"; // Azul para en curso
    const percentage = (available / total) * 100;
    if (percentage === 0) return "bg-bus-danger";
    if (percentage < 30) return "bg-bus-warning";
    return "bg-bus-success";
  };

  const getAvailabilityText = (available: number, total: number, isRunning: boolean, isPast: boolean) => {
    if (isPast) return "Finalizado";
    if (isRunning) return "En Curso";
    const percentage = (available / total) * 100;
    if (percentage === 0) return "Agotado";
    if (percentage < 30) return "Pocas plazas";
    return "Disponible";
  };

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentResults = results.slice(startIndex, endIndex);

  // --- Renderizado Condicional de Vistas ---
  const layoutTitle = 'Búsqueda de Reservas';
  
  return (
    <Layout_Auth title="FleetGuard360" subtitle={layoutTitle}>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Botón para Mis Reservas */}
        <div className="flex justify-end p-2 -mt-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/mis-reservas')}
            className="text-bus-primary hover:bg-bus-primary/10 font-semibold"
            disabled={isLoading || isCitiesLoading}
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Mis reservas
          </Button>

        </div>
        {/* Fin Botón para Mis Reservas */}

        <Card className="shadow-card bg-gradient-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <SearchIcon className="h-6 w-6 text-bus-primary" />
              Buscar Viajes
              {isCitiesLoading && (
                <span className="text-sm font-normal text-muted-foreground ml-2">Cargando ciudades...</span>
              )}
            </CardTitle>
            <CardDescription>
              Encuentra tu viaje perfecto seleccionando origen, destino y fecha
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="grid md:grid-cols-4 gap-4 items-start" noValidate>

              {/* Ciudad de Origen (Se mantiene igual) */}
              <div className="space-y-2">
                <Label htmlFor="origin" className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-bus-primary" />
                  Ciudad de Origen
                </Label>
                <Select
                  value={searchData.origin}
                  onValueChange={(value) => {
                    setSearchData(prev => ({ ...prev, origin: value }));
                    if (errors.origin) setErrors(prev => ({ ...prev, origin: "" }));
                  }}
                  disabled={isCitiesLoading}
                >
                  <SelectTrigger className={errors.origin ? "border-bus-danger focus:ring-bus-danger" : ""}>
                    <SelectValue placeholder={isCitiesLoading ? "Cargando..." : "Seleccionar origen"} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Usamos availableCities cargadas desde el backend/cache */}
                    {availableCities.filter(city => city !== searchData.destination).map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="h-5">
                  {errors.origin && <p className="text-sm text-bus-danger">{errors.origin}</p>}
                </div>
              </div>

              {/* Ciudad de Destino (Se mantiene igual) */}
              <div className="space-y-2">
                <Label htmlFor="destination" className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-bus-primary" />
                  Ciudad de Destino
                </Label>
                <Select
                  value={searchData.destination}
                  onValueChange={(value) => {
                    setSearchData(prev => ({ ...prev, destination: value }));
                    if (errors.destination) setErrors(prev => ({ ...prev, destination: "" }));
                  }}
                  disabled={isCitiesLoading}
                >
                  <SelectTrigger className={errors.destination ? "border-bus-danger focus:ring-bus-danger" : ""}>
                    <SelectValue placeholder={isCitiesLoading ? "Cargando..." : "Seleccionar destino"} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Usamos availableCities cargadas desde el backend/cache */}
                    {availableCities.filter(city => city !== searchData.origin).map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="h-5">
                  {errors.destination && <p className="text-sm text-bus-danger">{errors.destination}</p>}
                </div>
              </div>

              {/* Date Picker (Se mantiene igual) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4 text-bus-primary" />
                  Fecha de Viaje
                </Label>
                {/* Controlamos el estado del Popover con isDatePopoverOpen */}
                <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !searchData.date && "text-muted-foreground",
                        errors.date && "border-bus-danger focus:ring-bus-danger"
                      )}
                      disabled={isCitiesLoading}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {searchData.date ? (
                        format(searchData.date, "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={searchData.date}
                      onSelect={(date) => {
                        setSearchData(prev => ({ ...prev, date }));
                        if (errors.date) setErrors(prev => ({ ...prev, date: "" }));
                        // CIERRE AUTOMÁTICO: Cerramos el popover al seleccionar una fecha
                        setIsDatePopoverOpen(false);
                      }}
                      // Deshabilitar fechas pasadas
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <div className="h-5">
                  {errors.date && <p className="text-sm text-bus-danger">{errors.date}</p>}
                </div>
              </div>

              {/* Submit Button (Se mantiene igual) */}
              <div className="space-y-2">
                {/* La etiqueta vacía para alinear el botón con los inputs */}
                <Label className="opacity-0 select-none">Buscar</Label>
                <Button
                  type="submit"
                  className="w-full bg-accent hover:bg-accent-hover text-accent-foreground shadow-button transition-smooth h-10"
                  disabled={isLoading || isCitiesLoading || availableCities.length === 0}
                >
                  {isLoading ? "Buscando..." : (isCitiesLoading ? "Cargando..." : "Buscar")}
                </Button>
                <div className="h-5"></div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Results Section */}
        {hasSearched && (
          <Card className="shadow-card bg-background/50 border-0">
            <CardHeader>
              <CardTitle className="text-xl">
                Resultados de Búsqueda
                {results.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {results.length} opciones
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-32 bg-muted rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : currentResults.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-lg">
                    No se encontraron viajes para los criterios seleccionados
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Intenta modificar tu búsqueda o selecciona otra fecha
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentResults.map((viaje) => {
                    // --- LÓGICA DE ESTADO EN CURSO (AJUSTADA) ---
                    const started = isTripStarted(viaje.fecha, viaje.horaSalida);
                    // Uso de la función mejorada:
                    const ended = isTripEnded(viaje.fecha, viaje.horaLlegada, viaje.horaSalida);
                    const isRunning = started && !ended; // El viaje está en recorrido si ha empezado pero no ha terminado.

                    const isAvailable = viaje.cuposDisponibles > 0;
                    
                    // Condición ACTUALIZADA: Deshabilitado si ya terminó (ended) O no tiene cupos (!isAvailable).
                    // Los viajes en curso (isRunning) SÍ están habilitados si isAvailable es true.
                    const isDisabled = ended || !isAvailable; 
                    
                    let buttonText = "Reservar";
                    let statusText = "Disponible";

                    if (!isAvailable) {
                      buttonText = "Agotado";
                      statusText = "Agotado";
                    } else if (ended) {
                      buttonText = "Transcurrido";
                      statusText = "Finalizado";
                    } else if (isRunning) {
                      // Viaje en curso: Se permite reservar si hay cupos (isAvailable).
                      buttonText = "Reservar";
                      statusText = "En Curso";
                    } else {
                        // Viaje futuro normal (isAvailable sigue siendo la fuente principal)
                        statusText = getAvailabilityText(viaje.cuposDisponibles, viaje.cuposTotales, isRunning, ended);
                    }
                    // --- FIN LÓGICA DE ESTADO EN CURSO ---

                    return (
                      <Card key={viaje.id} className="shadow-card border hover:shadow-elegant transition-smooth">
                        
                        <CardContent className="p-6">
                          
                          <div className="grid md:grid-cols-4 gap-4 items-center">

                            {/* Info Viaje (Cupos y Estado) */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={cn(
                                    "text-white border-0",
                                    // Pasamos los nuevos estados para colores más precisos
                                    getAvailabilityColor(viaje.cuposDisponibles, viaje.cuposTotales, isRunning, ended)
                                  )}
                                >
                                  <Users className="h-3 w-3 mr-1" />
                                  {viaje.cuposDisponibles}/{viaje.cuposTotales}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {statusText}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Info className="h-4 w-4" />
                                Estado: <span className="font-medium text-foreground">{viaje.estado}</span>
                              </div>
                            </div>

                            {/* Time (Se mantiene igual) */}
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{viaje.horaSalida}</span>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{viaje.horaLlegada}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                              </p>
                            </div>

                            {/* Locations (Se mantiene igual) */}
                            <div className="space-y-1">
                              <p className="text-sm font-medium">Desde: {viaje.origen}</p>
                              <p className="text-sm text-muted-foreground">Hasta: {viaje.destino}</p>
                            </div>

                            {/* Reserve Button (AJUSTADO para usar 'isDisabled' y 'buttonText' actualizados) */}
                            <div className="text-right">
                              {isDisabled ? (
                                <Button
                                  disabled
                                  className="w-full md:w-auto transition-smooth bg-muted text-muted-foreground cursor-not-allowed"
                                  aria-label={`Viaje ${buttonText.toLowerCase()}`}
                                >
                                  {buttonText}
                                </Button>
                              ) : (
                                <Button
                                  asChild
                                  className="w-full md:w-auto transition-smooth bg-accent hover:bg-accent-hover text-accent-foreground shadow-button"
                                  aria-label={`Reservar viaje ${viaje.id}`}
                                >
                                  <Link to={`/reservar?viajeId=${viaje.id}&viajeOrigen=${viaje.origen}&viajeDestino=${viaje.destino}&viajeCuposDisponibles=${viaje.cuposDisponibles}&viajeFecha=${viaje.fecha}&viajeHora=${viaje.horaSalida}`}>
                                    {buttonText}
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Componente de Paginación (Se mantiene igual) */}
              {results.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-6 mt-6 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages} (Mostrando {currentResults.length} de {results.length} viajes)
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
        )}
      </div>
    </Layout_Auth>
  );
};

export default Search;