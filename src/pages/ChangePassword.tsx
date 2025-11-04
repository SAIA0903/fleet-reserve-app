import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { KeyRound, ArrowLeft, CheckCircle, XCircle } from "lucide-react";

// URL del endpoint GraphQL
const GRAPHQL_ENDPOINT = "http://localhost:8080/graphql";

/**
 * Componente que permite a un usuario cambiar su contraseña utilizando un token
 * de restablecimiento obtenido de la URL.
 */
const ChangePassword = () => {
    // Hooks para navegación, ubicación y notificaciones
    const location = useLocation();
    const navigate = useNavigate();
    const { toast } = useToast();

    // Obtiene el token de restablecimiento de los parámetros de la URL
    const queryParams = new URLSearchParams(location.search);
    const token = queryParams.get("token");

    // Estado del formulario
    const [formData, setFormData] = useState({
        newPassword: "",
        confirmPassword: "",
    });
    // Estado para gestionar los errores de validación
    const [errors, setErrors] = useState<Record<string, string>>({});
    // Estado para indicar si la solicitud está en curso
    const [isLoading, setIsLoading] = useState(false);
    // Estado para mostrar el mensaje de respuesta del servidor
    const [responseMessage, setResponseMessage] = useState("");

    /**
     * Efecto que se ejecuta al cargar el componente.
     * Si no hay token presente, muestra una notificación y redirige a la página de inicio.
     */
    useEffect(() => {
        if (!token) {
            toast({
                title: "Acceso denegado",
                description: "Token de cambio de contraseña no encontrado. Redirigiendo a inicio.",
                variant: "destructive",
            });
            navigate("/");
        }
    }, [token, navigate, toast]);

    // Expresión regular para la complejidad de la contraseña:
    // Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un dígito. Sin espacios.
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?!.*\s).{8,}$/;

    /**
     * Valida los campos del formulario de la nueva contraseña y su confirmación.
     * Retorna true si ambos campos son válidos.
     */
    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        // Validar nueva contraseña
        if (!formData.newPassword) {
            newErrors.newPassword = "La nueva contraseña es obligatoria";
        } else if (!passwordRegex.test(formData.newPassword)) {
            newErrors.newPassword = "La contraseña debe tener: Mín. 8 caracteres, mayúscula, minúscula y dígito.";
        }

        // Validar confirmación de contraseña
        if (!formData.confirmPassword) {
            newErrors.confirmPassword = "Confirmar la contraseña es obligatorio";
        } else if (formData.newPassword !== formData.confirmPassword) {
            newErrors.confirmPassword = "Las contraseñas no coinciden";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    /**
     * Maneja los cambios en los campos del formulario y limpia los errores asociados.
     */
    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        
        // Limpiar error al empezar a escribir
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: "" }));
        }
        // También limpiar el error de confirmación si se modifica la nueva contraseña
        if (field === "newPassword" && errors.confirmPassword) {
            setErrors(prev => ({ ...prev, confirmPassword: "" }));
        }
        setResponseMessage(""); // Limpiar el mensaje de respuesta al cambiar los datos
    };

    /**
     * Procesa el envío del formulario.
     * Envía la mutación GraphQL para cambiar la contraseña usando el token y la nueva contraseña.
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setResponseMessage("");

        if (!token || !validateForm()) {
            return;
        }

        setIsLoading(true);

        // Mutación GraphQL para restablecer la contraseña
        const graphqlQuery = {
            query: `
                mutation { 
                    resetPassword(input: {
                        token: "${token}", 
                        newPassword: "${formData.newPassword}"
                    }) { 
                        success 
                        message 
                    } 
                }
            `,
        };

        try {
            const res = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(graphqlQuery),
            });

            const result = await res.json();
            
            // Si la respuesta no contiene la data esperada o hay errores de GraphQL
            if (result.errors || !result.data || !result.data.resetPassword) {
                console.error("Error en la respuesta de GraphQL del servidor:", result.errors || result);
                setResponseMessage("Ha ocurrido un error al intentar cambiar la contraseña. Intenta nuevamente.");
                
                toast({
                    title: "Error de Cambio",
                    description: "No se pudo completar la operación. Por favor, verifica el token o intenta más tarde.",
                    variant: "destructive",
                });
                return;
            }

            const { success, message } = result.data.resetPassword;
            
            setResponseMessage(message); // Mostrar el mensaje del backend en pantalla

            if (success) {
                toast({
                    title: "Éxito",
                    description: message,
                });
                // Redirigir al login después de un éxito
                setTimeout(() => navigate("/login"), 3000); 
            } else {
                toast({
                    title: "Error de Cambio",
                    description: message,
                    variant: "destructive",
                });
            }
        } catch (error) {
            // Manejo de errores de red o fetch (no se muestra al usuario final, solo a consola)
            console.error("Error de red o solicitud GraphQL fallida:", error);
            setResponseMessage("Error de conexión. Por favor, verifica tu conexión e intenta nuevamente.");
            toast({
                title: "Error de red",
                description: "No se pudo conectar con el servicio de cambio de contraseña.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Si no hay token, se muestra una pantalla de carga mientras se espera la redirección del useEffect
    if (!token) {
        return (
            <Layout title="FleetGuard360" subtitle="Cargando...">
                <div className="flex justify-center items-center h-40">
                    <p className="text-muted-foreground">Verificando token...</p>
                </div>
            </Layout>
        );
    }

    // Renderizado del Componente
    return (
        <Layout title="FleetGuard360" subtitle="Cambio de contraseña">
            <div className="max-w-md mx-auto">
                <Card className="shadow-elegant bg-gradient-card border-0">
                    <CardHeader className="space-y-4 text-center">
                        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                            <KeyRound className="h-8 w-8 text-bus-success" />
                        </div>
                        <CardTitle className="text-2xl">Establecer Nueva Contraseña</CardTitle>
                        <CardDescription>
                            Usa una contraseña fuerte que cumpla con los requisitos de seguridad.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                            
                            {/* Campo Nueva Contraseña */}
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">Nueva Contraseña</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    value={formData.newPassword}
                                    onChange={(e) => handleInputChange("newPassword", e.target.value)}
                                    className={errors.newPassword ? "border-bus-danger focus:ring-bus-danger" : ""}
                                    placeholder="Ej: Fg360@2025" 
                                    aria-describedby={errors.newPassword ? "new-password-error" : undefined}
                                    aria-invalid={!!errors.newPassword}
                                    required
                                />
                                <div className="h-5">
                                    {errors.newPassword ? (
                                        <p id="new-password-error" className="text-sm text-bus-danger" role="alert">
                                            {errors.newPassword}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            Mín. 8 caracteres. Debe incluir Mayúscula, minúscula y dígito.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Campo Confirmar Nueva Contraseña */}
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={formData.confirmPassword}
                                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                                    className={errors.confirmPassword ? "border-bus-danger focus:ring-bus-danger" : ""}
                                    placeholder="Repite la nueva contraseña" 
                                    aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
                                    aria-invalid={!!errors.confirmPassword}
                                    required
                                />
                                <div className="h-5">
                                    {errors.confirmPassword && (
                                        <p id="confirm-password-error" className="text-sm text-bus-danger" role="alert">
                                            {errors.confirmPassword}
                                        </p>
                                    )}
                                </div>
                            </div>
                            
                            {/* Mensaje de respuesta del backend */}
                            {responseMessage && (
                                <div className={`p-3 rounded-md text-sm ${responseMessage.includes("Error") || responseMessage.includes("fallido") ? "bg-bus-danger/10 text-bus-danger" : "bg-bus-success/10 text-bus-success"}`}>
                                    {responseMessage}
                                </div>
                            )}

                            {/* Botón de Cambiar Contraseña */}
                            <Button
                                type="submit"
                                className="w-full bg-accent hover:bg-accent-hover text-accent-foreground shadow-button transition-smooth"
                                disabled={isLoading}
                            >
                                {isLoading 
                                    ? "Cambiando Contraseña..." 
                                    : "Cambiar Contraseña"
                                }
                            </Button>
                        </form>

                        <div className="mt-6 text-center space-y-4">
                            {/* Botón para volver al inicio */}
                            <Button variant="ghost" asChild className="text-muted-foreground">
                                <Link to="/" className="flex items-center gap-2">
                                    <ArrowLeft className="h-4 w-4" />
                                    Volver al Inicio
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
};

export default ChangePassword;