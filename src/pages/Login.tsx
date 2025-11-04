import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
// Ajuste de ruta para el componente de layout.
import Layout from "../components/Layout"; 
import { LogIn, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// URL del endpoint GraphQL de Spring Boot
const GRAPHQL_ENDPOINT = "http://localhost:8080/graphql";

// Componente principal de la página de inicio de sesión.
const Login = () => {
    // Estado para capturar el nombre de usuario y la contraseña.
    const [formData, setFormData] = useState({
        username: "",
        password: ""
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    
    // Hooks para notificaciones, navegación y contexto de autenticación.
    const { toast } = useToast();
    const navigate = useNavigate();
    const { setAuthData } = useAuth();

    // Función para validar que los campos de usuario y contraseña no estén vacíos.
    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.username.trim()) {
            newErrors.username = "Ingresar Nombre de Usuario";
        }
        if (!formData.password) {
            newErrors.password = "Ingresar Contraseña";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Manejador de envío del formulario para iniciar sesión.
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) {
            toast({
                title: "Campos incompletos",
                description: "Por favor revisa y completa los campos.",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        
        const { username, password } = formData;
        
        // Mutación GraphQL para el inicio de sesión.
        const loginMutation = `
            mutation LoginPasajero {
                login(input: { 
                    username: "${username}", 
                    password: "${password}" 
                }) {
                    success
                    message
                    token
                    pasajero {id nombre apellido}
                }
            }
        `;

        try {
            // Realiza la petición POST al endpoint de GraphQL.
            const response = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: loginMutation }),
            });
            
            const result = await response.json();
            
            // Manejo de errores a nivel de red, servidor o protocolo GraphQL.
            if (!response.ok || result.errors) {
                // Se simplifica el mensaje de error para el usuario final.
                const errorMessage = "No se pudo acceder al servicio. Por favor, revisa tus datos e intenta de nuevo.";
                
                toast({
                    title: "Error de Acceso",
                    description: errorMessage,
                    variant: "destructive",
                });
                return;
            }
            
            const loginData = result.data.login;
            
            // Proceso de inicio de sesión exitoso.
            if (loginData.success && loginData.token && loginData.pasajero) {
                // Almacena los datos de autenticación localmente.
                localStorage.setItem('authToken', loginData.token);
                localStorage.setItem('pasajeroId',loginData.pasajero.id)
                localStorage.setItem('pasajeroNombre',loginData.pasajero.nombre)
                localStorage.setItem('pasajeroApellido',loginData.pasajero.apellido)
                setAuthData(loginData.token, loginData.pasajero);
                
                toast({
                    title: "Inicio de sesión exitoso",
                    description: loginData.message || "Bienvenido.",
                });
                
                // Redirige al usuario a la página de búsqueda.
                navigate("/search");
            } else {
                // Manejo de error de credenciales incorrectas (validación del backend).
                toast({
                    title: "Error de Autenticación",
                    description: loginData.message || "Credenciales incorrectas o usuario no encontrado.",
                    variant: "destructive",
                });
            }
            
        } catch (error) {
            // Manejo de error de conexión fallida (ej: backend apagado).
            console.error("Error al conectar con la API:", error);
            toast({
                title: "Error de Conexión",
                description: "No se pudo conectar con el servidor. Por favor, intenta más tarde.", // Mensaje simplificado.
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Actualiza el estado del formulario y limpia el mensaje de error al escribir.
    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: "" }));
        }
    };

    return (
        <Layout title="FleetGuard360" subtitle="Inicio de Sesión">
            <div className="max-w-md mx-auto">
                <Card className="shadow-elegant bg-gradient-card border-0">
                    <CardHeader className="space-y-4 text-center">
                        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                            <LogIn className="h-8 w-8 text-bus-primary" />
                        </div>
                        <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
                        <CardDescription>
                            Ingresa tus credenciales para acceder a tu cuenta
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                            
                            {/* Campo de Nombre de Usuario */}
                            <div className="space-y-2">
                                <Label htmlFor="username">Nombre de Usuario</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => handleInputChange("username", e.target.value)}
                                    className={errors.username ? "border-bus-danger focus:ring-bus-danger" : ""}
                                    placeholder="Ingresa tu nombre de usuario"
                                    aria-describedby={errors.username ? "username-error" : undefined}
                                    aria-invalid={!!errors.username}
                                />
                                <div className="h-5">
                                    {errors.username && (
                                        <p id="username-error" className="text-sm text-bus-danger" role="alert">
                                            {errors.username}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Campo de Contraseña */}
                            <div className="space-y-2">
                                <Label htmlFor="password">Contraseña</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => handleInputChange("password", e.target.value)}
                                    className={errors.password ? "border-bus-danger focus:ring-bus-danger" : ""}
                                    placeholder="Ingresa tu contraseña"
                                    aria-describedby={errors.password ? "password-error" : undefined}
                                    aria-invalid={!!errors.password}
                                />
                                <div className="h-5">
                                    {errors.password && (
                                        <p id="password-error" className="text-sm text-bus-danger" role="alert">
                                            {errors.password}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-accent hover:bg-accent-hover text-accent-foreground shadow-button transition-smooth"
                                disabled={isLoading}
                            >
                                {isLoading ? "Iniciando Sesión..." : "Iniciar Sesión"}
                            </Button>
                        </form>

                        <div className="mt-6 text-center space-y-4">
                            <Link 
                                to="/reset-password" 
                                className="text-sm text-primary hover:text-primary-hover font-medium transition-smooth block"
                            >
                                ¿Olvidaste tu contraseña?
                            </Link>
                            
                            <p className="text-sm text-muted-foreground">
                                ¿No tienes cuenta?{" "}
                                <Link to="/register" className="text-primary hover:text-primary-hover font-medium transition-smooth">
                                    Registrarse
                                </Link>
                            </p>
                            
                            <Button variant="ghost" asChild className="text-muted-foreground">
                                <Link to="/search" className="flex items-center gap-2">
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

export default Login;