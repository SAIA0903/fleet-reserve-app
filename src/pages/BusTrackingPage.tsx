import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Layout from "@/components/Layout";
import Layout_Auth from "@/components/Layout_Auth";
import { LogIn, ArrowLeft, Bus, Clock, MapPin } from "lucide-react";
import L from 'leaflet';
import { MapContainer, TileLayer, Polyline, Marker, useMap, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
// MODIFICACIÓN: Se importa 'addDays' para manejar el cruce de medianoche.
import { format, differenceInMilliseconds, addMilliseconds, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";

// --- Configuración de Constantes ---
// const VELOCIDAD_CONSTANTE_KMH = 80; // Eliminada: Velocidad de simulación en km/h
const VELOCIDAD_MAXIMA_KMH = 100; // Nueva: Velocidad máxima permitida en km/h
const INTERVALO_ACTUALIZACION_MS = 8000; // 8 segundos

// --- SVG del Icono del Bus como una constante local ---
const BUS_SVG_ICON = `
<svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M3 7C3 5.34315 4.34315 4 6 4H18C19.6569 4 21 5.34315 21 7V17C21 18.6569 19.6569 20 18 20H6C4.34315 20 3 18.6569 3 17V7ZM6 6H18C18.5523 6 19 6.44772 19 7V17C19 17.5523 18.5523 18 18 18H6C5.44772 18 5 17.5523 5 17V7C5 6.44772 5.44772 6 6 6ZM7 15C7.55228 15 8 14.5523 8 14C8 13.4477 7.55228 13 7 13C6.44772 13 6 13.4477 6 14C6 14.5523 6.44772 15 7 15ZM17 15C17.5523 15 18 14.5523 18 14C18 13.4477 17.5523 13 17 13C16.4477 13 16 13.4477 16 14C16 14.5523 16.4477 15 17 15ZM6 8C6 7.44772 6.44772 7 7 7H17C17.5523 7 18 7.44772 18 8V12H6V8ZM9 10C9 10.5523 9.44772 11 10 11H14C14.5523 11 15 10.5523 15 10C15 9.44772 14.5523 9 14 9H10C9.44772 9 9 9.44772 9 10Z" fill="#1e40af"/>
</svg>
`; // Azul oscuro, simulando un bus con ventanas


// --- Tipos de Datos ---
interface Coords {
    lat: number;
    lng: number;
}

interface RouteData {
    coordinates: Coords[];
    totalDistanceKm: number;
    totalDurationMs: number;
    estimatedArrival: Date;
    // Nueva propiedad para almacenar la velocidad calculada del viaje
    velocityKmh: number; 
}

// Sobrescribir los iconos predeterminados de Leaflet (necesario para que los Markers se vean correctamente)
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Icono personalizado para el bus usando el SVG local
const busIcon = L.divIcon({
    html: BUS_SVG_ICON,
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35],
    className: 'animate-pulse' // Clase para simular movimiento o atención, aunque el SVG no se anime directamente
});

// --- Componente de Control del Mapa para accesibilidad y ajuste de vista ---
interface MapControlsProps {
    route: Coords[];
    busPosition: Coords | null;
}

const MapControls = ({ route, busPosition }: MapControlsProps) => {
    const map = useMap();

    useEffect(() => {
        if (route.length > 0) {
            const bounds = L.latLngBounds(route.map(c => [c.lat, c.lng] as L.LatLngTuple));
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [route, map]);
    
    const handleRecenter = useCallback(() => {
        if (busPosition) {
            map.flyTo([busPosition.lat, busPosition.lng], 14, { duration: 1.5 });
        }
    }, [busPosition, map]);

    return (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] p-1">
            {busPosition && (
                <Button 
                    onClick={handleRecenter} 
                    className="bg-bus-primary hover:bg-bus-primary/90 text-white shadow-lg"
                    aria-label="Centrar mapa en la posición actual del bus"
                >
                    <Bus className="h-4 w-4 mr-2" aria-hidden="true" />
                    Centrar Bus
                </Button>
            )}
        </div>
    );
};

// --- Funciones de Utilidad ---

const geocodeCity = async (city: string): Promise<Coords | null> => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
        return null;
    } catch (error) {
        console.error("Error geocodificando", city, error);
        return null;
    }
};

const getRoute = async (origin: Coords, destination: Coords): Promise<RouteData | null> => {
    const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const geometry = route.geometry.coordinates;
            
            const leafletCoords: Coords[] = geometry.map(([lng, lat]: [number, number]) => ({ lat, lng }));
            
            const totalDistanceMeters = route.distance;
            // La duración de OSRM no se usa directamente para la simulación,
            // sino la calculada con la hora de llegada estimada.
            const totalDurationSeconds = route.duration; 
            
            const totalDistanceKm = totalDistanceMeters / 1000;
            const totalDurationMs = totalDurationSeconds * 1000;
            
            return { 
                coordinates: leafletCoords, 
                totalDistanceKm, 
                totalDurationMs,
                estimatedArrival: new Date(),
                // Valor inicial, se recalculará en el componente principal
                velocityKmh: 0, 
            };
        }
        return null;
    } catch (error) {
        console.error("Error obteniendo la ruta", error);
        return null;
    }
};

// Función modificada para usar la velocidad calculada del viaje (velocityKms)
const calculateBusPosition = (routeData: RouteData | null, departureTime: Date): { busPosition: Coords | null, recorredDistanceKm: number, remainingDistanceKm: number } => {
    if (!routeData || routeData.coordinates.length === 0) {
        return { busPosition: null, recorredDistanceKm: 0, remainingDistanceKm: 0 };
    }

    const currentTime = new Date();
    const elapsedTimeMs = differenceInMilliseconds(currentTime, departureTime);
    
    // Verifica si el viaje aún no ha comenzado
    if (elapsedTimeMs <= 0) {
        return { busPosition: routeData.coordinates[0], recorredDistanceKm: 0, remainingDistanceKm: routeData.totalDistanceKm };
    }
    
    // **USO DE LA VELOCIDAD CALCULADA**
    const velocityKms = routeData.velocityKmh; // Usa la velocidad real calculada y limitada
    
    // Calcula la distancia recorrida basada en el tiempo transcurrido y la velocidad
    const elapsedTimeHours = elapsedTimeMs / (1000 * 60 * 60);
    const recorredDistanceKm = Math.min(velocityKms * elapsedTimeHours, routeData.totalDistanceKm);

    // Verifica si el viaje ha terminado
    if (recorredDistanceKm >= routeData.totalDistanceKm) {
        return { busPosition: routeData.coordinates[routeData.coordinates.length - 1], recorredDistanceKm: routeData.totalDistanceKm, remainingDistanceKm: 0 };
    }

    let accumulatedDistanceKm = 0;
    let busPosition: Coords = routeData.coordinates[0];
    
    for (let i = 0; i < routeData.coordinates.length - 1; i++) {
        const p1 = routeData.coordinates[i];
        const p2 = routeData.coordinates[i + 1];
        
        const segmentDistanceMeters = L.latLng(p1.lat, p1.lng).distanceTo(L.latLng(p2.lat, p2.lng));
        const segmentDistanceKm = segmentDistanceMeters / 1000;

        if (accumulatedDistanceKm + segmentDistanceKm > recorredDistanceKm) {
            const remainingSegmentDistanceKm = recorredDistanceKm - accumulatedDistanceKm;
            const fraction = remainingSegmentDistanceKm / segmentDistanceKm;
            
            busPosition = {
                lat: p1.lat + (p2.lat - p1.lat) * fraction,
                lng: p1.lng + (p2.lng - p1.lng) * fraction,
            };
            break;
        }

        accumulatedDistanceKm += segmentDistanceKm;
        if (i === routeData.coordinates.length - 2) {
             busPosition = routeData.coordinates[routeData.coordinates.length - 1];
        }
    }
    
    const remainingDistanceKm = routeData.totalDistanceKm - recorredDistanceKm;

    return { busPosition, recorredDistanceKm, remainingDistanceKm };
};

// --- Componente Principal ---



const MapPage = () => {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    const origen = searchParams.get('origen') || '';
    const destino = searchParams.get('destino') || '';
    const fechaSalidaStr = searchParams.get('fechaSalida') || '';
    const horaSalidaStr = searchParams.get('horaSalida') || '';
    // NUEVO: Obtener hora de llegada para el cálculo de velocidad
    const horaLlegadaStr = searchParams.get('horaLlegada') || ''; 

    const pasajeroId = useMemo(() => localStorage.getItem('pasajeroId'), []);
    
    // Condición de datos faltantes actualizada
    const isDataMissing = !origen || !destino || !fechaSalidaStr || !horaSalidaStr || !horaLlegadaStr;
    
    const departureTime = useMemo(() => {
        const dateTimeStr = `${fechaSalidaStr}T${horaSalidaStr}:00`;
        const date = new Date(dateTimeStr);
        return isNaN(date.getTime()) ? null : date;
    }, [fechaSalidaStr, horaSalidaStr]);
    
    // MODIFICACIÓN CLAVE: Hora de llegada con lógica de cruce de medianoche
    const arrivalTime = useMemo(() => {
        if (!departureTime) return null;

        // 1. Crear una fecha de llegada inicial con la misma fecha de salida
        const arrivalDateTimeStr = `${fechaSalidaStr}T${horaLlegadaStr}:00`;
        let arrivalDate = new Date(arrivalDateTimeStr);
        
        if (isNaN(arrivalDate.getTime())) return null;

        // 2. Comprobar si la hora de llegada es *anterior* a la de salida.
        // Si (Llegada < Salida), significa que el viaje cruza la medianoche.
        if (arrivalDate.getTime() < departureTime.getTime()) {
            // Sumar un día para que la llegada se posicione al día siguiente.
            arrivalDate = addDays(arrivalDate, 1);
        }

        return arrivalDate;
    }, [fechaSalidaStr, horaLlegadaStr, departureTime]);


    const [routeData, setRouteData] = useState<RouteData | null>(null);
    const [busPosition, setBusPosition] = useState<Coords | null>(null);
    const [recorredDistanceKm, setRecorredDistanceKm] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busArrived, setBusArrived] = useState(false);
    
    const calculatePositionAndETA = useCallback((currentRouteData: RouteData, currentDepartureTime: Date) => {
        const { busPosition: newBusPosition, recorredDistanceKm: newRecorredDistanceKm } = calculateBusPosition(currentRouteData, currentDepartureTime);
        
        setBusPosition(newBusPosition);
        setRecorredDistanceKm(newRecorredDistanceKm);

        if (newRecorredDistanceKm >= currentRouteData.totalDistanceKm * 0.999) {
            setBusArrived(true);
            const finalPosition = currentRouteData.coordinates[currentRouteData.coordinates.length - 1];
            setBusPosition(finalPosition);
            setRecorredDistanceKm(currentRouteData.totalDistanceKm);
            return true;
        }
        return false;
    }, []);

    useEffect(() => {
        const loadRoute = async () => {
            // Validación de datos de llegada
            if (!isAuthenticated || isDataMissing || !departureTime || !arrivalTime) {
                if (isAuthenticated && (isDataMissing || !departureTime || !arrivalTime)) {
                     setError("Por favor, seleccione un viaje desde 'Mis Reservas'");
                }
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            const originCoords = await geocodeCity(origen);
            const destinationCoords = await geocodeCity(destino);

            if (!originCoords || !destinationCoords) {
                setError("No se pudieron obtener las coordenadas de las ciudades.");
                setIsLoading(false);
                return;
            }

            const route = await getRoute(originCoords, destinationCoords);

            if (!route || route.coordinates.length === 0) {
                setError("No se pudo obtener la ruta entre el origen y el destino.");
                setIsLoading(false);
                return;
            }
            
            // --- CÁLCULO DE VELOCIDAD VARIABLE ---
            const totalDistanceKm = route.totalDistanceKm;
            
            // Se usa arrivalTime corregido (incluyendo +1 día si cruza medianoche)
            const plannedDurationMs = differenceInMilliseconds(arrivalTime, departureTime);

            if (plannedDurationMs <= 0) {
                setError("Ha ocurrido un error en la recepción de datos temporales");
                setIsLoading(false);
                return;
            }

            const plannedDurationHours = plannedDurationMs / (1000 * 60 * 60);
            
            // Velocidad requerida para cumplir con la ETA
            let requiredVelocityKmh = totalDistanceKm / plannedDurationHours;

            // Aplica la velocidad máxima de 100 km/h
            const finalVelocityKmh = Math.min(requiredVelocityKmh, VELOCIDAD_MAXIMA_KMH);

            // Recalcula la duración total del viaje con la velocidad final (limitada o requerida)
            const finalDurationHours = totalDistanceKm / finalVelocityKmh;
            const finalDurationMs = finalDurationHours * (1000 * 60 * 60);

            // Recalcula la ETA con la duración basada en la velocidad final
            const recalculatedArrivalTime = addMilliseconds(departureTime, finalDurationMs);
            // -------------------------------------

            const updatedRouteData: RouteData = {
                ...route,
                // Almacena la velocidad calculada para el seguimiento en calculateBusPosition
                velocityKmh: finalVelocityKmh, 
                totalDurationMs: finalDurationMs,
                estimatedArrival: recalculatedArrivalTime,
            };
            setRouteData(updatedRouteData);

            calculatePositionAndETA(updatedRouteData, departureTime);

            setIsLoading(false);

            const interval = setInterval(() => {
                setRouteData(prevRouteData => {
                    if (prevRouteData) {
                        const arrived = calculatePositionAndETA(prevRouteData, departureTime);
                        if (arrived) {
                            clearInterval(interval);
                        }
                        return prevRouteData;
                    }
                    return null;
                });
            }, INTERVALO_ACTUALIZACION_MS);

            return () => clearInterval(interval);

        };

        loadRoute();
    }, [origen, destino, departureTime, arrivalTime, isDataMissing, calculatePositionAndETA, pasajeroId]); // Agregado arrivalTime como dependencia


    const polylineParts = useMemo(() => {
        if (!routeData || !busPosition) return { recorred: [], remaining: [] };

        const route = routeData.coordinates;
        const busLL = L.latLng(busPosition.lat, busPosition.lng);

        let closestIndex = -1;
        let minDistance = Infinity;

        for (let i = 0; i < route.length; i++) {
            const pointLL = L.latLng(route[i].lat, route[i].lng);
            const distance = busLL.distanceTo(pointLL);
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
        }

        const recorredSegment: Coords[] = [];
        if (closestIndex >= 0) {
            recorredSegment.push(...route.slice(0, closestIndex));
            recorredSegment.push(busPosition); 
        } else {
             if (busPosition) recorredSegment.push(busPosition);
        }

        const remainingSegment: Coords[] = [];
        if (closestIndex >= 0) {
            remainingSegment.push(busPosition); 
            remainingSegment.push(...route.slice(closestIndex));
        }

        if (recorredDistanceKm <= 0.01) {
            return { recorred: [routeData.coordinates[0]], remaining: routeData.coordinates };
        }

        return { recorred: recorredSegment, remaining: remainingSegment };
    }, [routeData, busPosition, recorredDistanceKm]);

    if (!isAuthenticated) {
    return (
      <Layout_Auth title="FleetGuard360" subtitle="Búsqueda de Viajes">
        <div className="max-w-xl mx-auto text-center py-20 bg-white shadow-lg rounded-xl p-8">
          <LogIn className="h-12 w-12 text-bus-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Acceso Requerido</h2>
          <p className="text-muted-foreground mb-6">
            Debe ingresar para seguir el vehículo. <br></br>
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
    
    if (error || isDataMissing || !departureTime || !arrivalTime) {
        const title = error ? "Error de Seguimiento" : "Seleccione un Viaje";
        const description = error || "No se ha seleccionado un viaje válido. Por favor, elija uno de sus viajes reservados.";

        return (
            <Layout_Auth title={title} subtitle="Datos de Viaje">
                <div className="text-center py-20 space-y-4">
                <p className="text-xl font-bold text-red-600"> {title}</p>
                <p className="text-sm text-muted-foreground">{description} </p>
                <Button 
                    onClick={() => navigate('/mis-reservas')} 
                    variant="link" 
                    className="text-bus-primary"
                >
                    Ir a Mis reservas
                </Button>
                </div>
             </Layout_Auth>
    );
}
    if (isLoading || !routeData) {
        return (
            <Layout_Auth title="Seguimiento de Viaje" subtitle="Cargando ruta..."> 
                <div className="max-w-xl mx-auto text-center py-20">
                    <Bus className="h-12 w-12 text-bus-primary mx-auto mb-4 animate-spin" />
                    <h2 className="text-2xl font-bold mb-4">Ubicando transporte...</h2>
                    <p className="text-muted-foreground">Esto puede tardar unos segundos.</p>
                </div>
            </Layout_Auth>
        );
    }

    const initialCenter: L.LatLngTuple = routeData.coordinates.length > 0 
        ? [routeData.coordinates[0].lat, routeData.coordinates[0].lng] 
        : [4.5709, -74.2973];

    const ETA = format(routeData.estimatedArrival, "PPPp", { locale: es });
    const ETA_Display = busArrived ? "¡Llegada!" : ETA;
    
    const timeToDeparture = differenceInMilliseconds(departureTime, new Date());
    const journeyNotStarted = timeToDeparture > 0;
    
    let statusMessage = `El bus ${origen} - ${destino} está en camino a ${routeData.velocityKmh.toFixed(0)} km/h.`;
    if (journeyNotStarted) {
        statusMessage = `El bus aún no ha salido. Partirá el ${format(departureTime, "PPPp", { locale: es })}`;
    } else if (busArrived) {
        statusMessage = `¡El bus ha llegado a ${destino}!`;
    } else {
        statusMessage = `El bus ha recorrido ${recorredDistanceKm.toFixed(0)} km.   `;
    }

    return (
        // El contenido del mapa ahora también está dentro de Layout_Auth
        <Layout_Auth title="FleetGuard 360" subtitle="Seguimiento en Vivo">
                <div className="max-w-6xl mx-auto space-y-8">
            
                            {/* Botón para Mis reservas */}
                            <div className="flex justify-start p-2 -mt-4">
                                <Button
                                    variant="ghost"
                                    onClick={() => navigate('/mis-reservas')}
                                    className="text-bus-primary hover:bg-bus-primary/10 font-semibold"
                                    disabled={isLoading}
                                >
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Mis reservas
                                </Button>
                            </div>
                </div>       
                <Card className="shadow-md border-bus-primary/50 border-2">
    <CardHeader className="py-3 px-6 border-b">
        <CardTitle className="flex items-center text-xl text-bus-primary">
            <Clock className="h-5 w-5 mr-2" aria-hidden="true" />
            Tiempo Estimado de Llegada
        </CardTitle>
    </CardHeader>
    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <p className="text-sm font-medium text-gray-500">Ruta</p>
            <p className="text-lg font-bold text-gray-800">{origen} <span className="text-bus-primary">→</span> {destino}</p>
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500">Llegada Estimada</p>
            <p className={`text-lg font-bold ${busArrived ? 'text-green-600' : 'text-orange-600'}`}>
                {ETA_Display}
            </p>
        </div>
        <div className="md:col-span-2">
            <p className="text-sm font-medium text-gray-500">Estado</p>
            <p className="text-base text-gray-700">{statusMessage}</p>
        </div>
    </CardContent>
</Card>  
                {/* --- Bloque del Mapa (ABAJO) --- */}
                {/* Forzado a ocupar todo el ancho, justo después de la información */}
                <div className="relative h-[600px] w-full rounded-lg shadow-xl overflow-hidden border-2 border-gray-200" role="application" aria-label="Mapa de seguimiento de ruta">
                    <MapContainer 
                        center={initialCenter} 
                        zoom={6} 
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                        keyboard={true}
                        aria-label="Mapa interactivo de la ruta del bus"
                    >
                        <TileLayer
                            attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        
                        <Polyline positions={polylineParts.recorred.map(c => [c.lat, c.lng] as L.LatLngTuple)} color="#808080" weight={6} opacity={0.7} />

                        <Polyline positions={polylineParts.remaining.map(c => [c.lat, c.lng] as L.LatLngTuple)} color="#007bff" weight={6} opacity={0.9} />
                        
                        <Marker 
                            position={[routeData.coordinates[0].lat, routeData.coordinates[0].lng]}
                            title={`Origen: ${origen}`}
                            alt={`Ubicación de origen: ${origen}`}
                        >
                            <Popup>
                                <strong aria-label="Punto de origen">Origen: {origen}</strong>
                            </Popup>
                        </Marker>

                        <Marker 
                            position={[routeData.coordinates[routeData.coordinates.length - 1].lat, routeData.coordinates[routeData.coordinates.length - 1].lng]}
                            title={`Destino: ${destino}`}
                            alt={`Ubicación de destino: ${destino}`}
                        >
                            <Popup>
                                <strong aria-label="Punto de destino">Destino: {destino}</strong>
                            </Popup>
                        </Marker>

                        {busPosition && (
                            <Marker 
                                position={[busPosition.lat, busPosition.lng]} 
                                icon={busIcon}
                                title={busArrived ? "El bus ha llegado" : "Posición actual del bus"}
                                alt={busArrived ? `El bus ha llegado a su destino en ${destino}` : `El bus se encuentra a ${recorredDistanceKm.toFixed(2)} kilómetros de la salida`}
                            >
                                <Tooltip permanent>
                                    <strong aria-label="Bus en movimiento">BUS</strong>
                                </Tooltip>
                            </Marker>
                        )}
                        
                        <MapControls route={routeData.coordinates} busPosition={busPosition} />

                    </MapContainer>
                </div>
        </Layout_Auth>
    );
};

export default MapPage;