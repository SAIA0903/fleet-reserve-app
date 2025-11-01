import { useState } from "react";
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
import { format } from "date-fns";
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
  horaLlegada: string;
  cuposTotales: number;
  cuposDisponibles: number;
  estado: string;
}

// 2. Definir la consulta de GraphQL parametrizada para aceptar variables
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

// Constante para la paginación
const ITEMS_PER_PAGE = 10;

// Obtener credenciales de localStorage (accesibles a nivel de módulo)
const token = localStorage.getItem('token');
const pasajeroId = localStorage.getItem('pasajeroId');

// --- Función de Petición GraphQL ---
async function executeGraphQLQuery(query: string, variables: any = {}): Promise<{ buscarViajes: Viaje[] }> {
  // Implementación de Backoff Exponencial para retries (Opcional, pero buena práctica)
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Incluye aquí otros headers necesarios, como 'Authorization'
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
      // Esperar con backoff exponencial
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
  // Esto no debería ser alcanzable, pero por tipado
  throw new Error("Fallo la petición después de múltiples reintentos.");
}

// Componente principal (anteriormente solo búsqueda, ahora maneja vistas)
const Search = () => {
  // --- AÑADIDO: Verificación de Sesión ---
  // Si no hay pasajeroId, mostramos el mensaje de acceso requerido.
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

  // --- Lógica de Vistas (AÑADIDO) ---
  const [view, setView] = useState<'search' | 'reservations'>('search');
  const goToReservations = () => setView('reservations');
  const goToSearch = () => setView('search');
  // ------------------------------------

  const [searchData, setSearchData] = useState({
    origin: "",
    destination: "",
    date: undefined as Date | undefined
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [results, setResults] = useState<Viaje[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // ESTADO NUEVO para controlar el cierre automático del Popover
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  const cities = [
    "Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena",
    "Bucaramanga", "Pereira", "Manizales", "Armenia", "Ibagué",
    "Santa Marta", "Villavicencio"
  ];

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

      // 3. Construir el objeto de variables dinámicamente
      const variables = {
        input: {
          origen: searchData.origin,
          destino: searchData.destination,
          fecha: fechaISO,
        },
      };

      // 4. Ejecutar la consulta con la query parametrizada y las variables
      const data = await executeGraphQLQuery(BUSCAR_VIAJES_QUERY, variables);

      if (data && data.buscarViajes) {
        const sortedViajes = [...data.buscarViajes].sort((a, b) =>
          a.horaSalida.localeCompare(b.horaSalida)
        );

        setResults(sortedViajes);
        toast({
          title: "Búsqueda completada",
          description: `Se encontraron ${sortedViajes.length} opciones de viaje`,
          // Nota: El tipo 'success' debe estar definido en tu hook 'use-toast'
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

  const getAvailabilityColor = (available: number, total: number) => {
    const percentage = (available / total) * 100;
    if (percentage === 0) return "bg-bus-danger";
    if (percentage < 30) return "bg-bus-warning";
    return "bg-bus-success";
  };

  const getAvailabilityText = (available: number, total: number) => {
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
  const navigate = useNavigate()
  return (
    <Layout_Auth title="FleetGuard360" subtitle={layoutTitle}>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Botón para Mis Reservas */}
        <div className="flex justify-end p-2 -mt-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/mis-reservas')}
            className="text-bus-primary hover:bg-bus-primary/10 font-semibold"
            disabled={isLoading}
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
            </CardTitle>
            <CardDescription>
              Encuentra tu viaje perfecto seleccionando origen, destino y fecha
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="grid md:grid-cols-4 gap-4 items-start" noValidate>

              {/* Ciudad de Origen (CORREGIDO) - El Select se cierra automáticamente */}
              <div className="space-y-2">
                <Label htmlFor="origin" className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-bus-primary" />
                  Ciudad de Origen
                </Label>
                <Select
                  value={searchData.origin}
                  // El Select cierra automáticamente al seleccionar un Item.
                  onValueChange={(value) => {
                    setSearchData(prev => ({ ...prev, origin: value }));
                    if (errors.origin) setErrors(prev => ({ ...prev, origin: "" }));
                  }}
                >
                  <SelectTrigger className={errors.origin ? "border-bus-danger focus:ring-bus-danger" : ""}>
                    <SelectValue placeholder="Seleccionar origen" />
                  </SelectTrigger>
                  {/* SelectContent abre hacia abajo por defecto */}
                  <SelectContent>
                    {/* Filtra para no poder seleccionar el mismo destino */}
                    {cities.filter(city => city !== searchData.destination).map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="h-5">
                  {errors.origin && <p className="text-sm text-bus-danger">{errors.origin}</p>}
                </div>
              </div>

              {/* Ciudad de Destino (AÑADIDO) - El Select se cierra automáticamente */}
              <div className="space-y-2">
                <Label htmlFor="destination" className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-bus-primary" />
                  Ciudad de Destino
                </Label>
                <Select
                  value={searchData.destination}
                  // El Select cierra automáticamente al seleccionar un Item.
                  onValueChange={(value) => {
                    setSearchData(prev => ({ ...prev, destination: value }));
                    if (errors.destination) setErrors(prev => ({ ...prev, destination: "" }));
                  }}
                >
                  <SelectTrigger className={errors.destination ? "border-bus-danger focus:ring-bus-danger" : ""}>
                    <SelectValue placeholder="Seleccionar destino" />
                  </SelectTrigger>
                  {/* SelectContent abre hacia abajo por defecto */}
                  <SelectContent>
                    {/* Filtra para no poder seleccionar el mismo origen */}
                    {cities.filter(city => city !== searchData.origin).map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="h-5">
                  {errors.destination && <p className="text-sm text-bus-danger">{errors.destination}</p>}
                </div>
              </div>

              {/* Date Picker (MODIFICADO para cierre automático) */}
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

              {/* Submit Button */}
              <div className="space-y-2">
                {/* La etiqueta vacía para alinear el botón con los inputs */}
                <Label className="opacity-0 select-none">Buscar</Label>
                <Button
                  type="submit"
                  className="w-full bg-accent hover:bg-accent-hover text-accent-foreground shadow-button transition-smooth h-10"
                  disabled={isLoading}
                >
                  {isLoading ? "Buscando..." : "Buscar"}
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
                  {currentResults.map((viaje) => (
                    <Card key={viaje.id} className="shadow-card border hover:shadow-elegant transition-smooth">
                      
                      <CardContent className="p-6">
                        
                        <div className="grid md:grid-cols-4 gap-4 items-center">

                          {/* Info Viaje (Cupos y Estado) */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                className={cn(
                                  "text-white border-0",
                                  getAvailabilityColor(viaje.cuposDisponibles, viaje.cuposTotales)
                                )}
                              >
                                <Users className="h-3 w-3 mr-1" />
                                {viaje.cuposDisponibles}/{viaje.cuposTotales}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {getAvailabilityText(viaje.cuposDisponibles, viaje.cuposTotales)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Info className="h-4 w-4" />
                              Estado: <span className="font-medium text-foreground">{viaje.estado}</span>
                            </div>
                          </div>

                          {/* Time */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{viaje.horaSalida}</span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{viaje.horaLlegada}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                            </p>
                          </div>

                          {/* Locations */}
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Desde: {viaje.origen}</p>
                            <p className="text-sm text-muted-foreground">Hasta: {viaje.destino}</p>
                          </div>

                          {/* Reserve Button (MODIFICADO PARA USAR LINK) */}
                          <div className="text-right">
                            {viaje.cuposDisponibles === 0 ? (
                              <Button
                                disabled
                                className="w-full md:w-auto transition-smooth bg-muted text-muted-foreground cursor-not-allowed"
                                aria-label={`Viaje agotado`}
                              >
                                Agotado
                              </Button>
                            ) : (
                              <Button
                                asChild
                                className="w-full md:w-auto transition-smooth bg-accent hover:bg-accent-hover text-accent-foreground shadow-button"
                                aria-label={`Reservar viaje ${viaje.id}`}
                              >
                                <Link to={`/reservar?viajeId=${viaje.id}&viajeOrigen=${viaje.origen}&viajeDestino=${viaje.destino}&viajeCuposDisponibles=${viaje.cuposDisponibles}&viajeFecha=${viaje.fecha}&viajeHora=${viaje.horaSalida}`}>
                                  Reservar
                                </Link>
                              </Button>
                            )}
                          </div>
                          {/* FIN MODIFICACIÓN */}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Componente de Paginación */}
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
