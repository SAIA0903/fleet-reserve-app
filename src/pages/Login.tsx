import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
// [CORRECCIÓN] Se cambia la ruta absoluta (@) por una relativa para solucionar el error de compilación.
import Layout from "../components/Layout"; 
import { LogIn, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// URL de tu endpoint GraphQL de Spring Boot
const GRAPHQL_ENDPOINT = "http://localhost:8080/graphql";

const Login = () => {
  // Se usa 'username' en lugar de 'email' para el login
  const [formData, setFormData] = useState({
    username: "",
    password: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { setAuthData } = useAuth();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validación por nombre de usuario
    if (!formData.username.trim()) {
      newErrors.username = "Ingresar Nombre de Usuario";
    }
    if (!formData.password) {
      newErrors.password = "Ingresar Contraseña";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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
    
    // Mutación GraphQL para el login
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
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: loginMutation }),
      });
      
      const result = await response.json();
      
      // Manejo de errores de conexión o GraphQL
      if (!response.ok || result.errors) {
        const errorMessage = result.errors 
            ? result.errors[0].message 
            : "Error de red o servidor al procesar la solicitud.";
        
        toast({
          title: "Error de Conexión o GraphQL",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }
      
      const loginData = result.data.login;
      
      if (loginData.success && loginData.token && loginData.pasajero) {
        // Almacena el token para futuras peticiones autenticadas
        localStorage.setItem('authToken', loginData.token);
        localStorage.setItem('pasajeroId',loginData.pasajero.id)
        localStorage.setItem('pasajeroNombre',loginData.pasajero.nombre)
        localStorage.setItem('pasajeroApellido',loginData.pasajero.apellido)
        setAuthData(loginData.token, loginData.pasajero);
        toast({
          title: "¡Inicio de sesión exitoso! 🚀",
          description: loginData.message || "Bienvenido a FleetGuard360.",
        });
        
        navigate("/search");
      } else {
        // Manejo de error de validación del backend (ej: credenciales incorrectas)
        toast({
          title: "Error de Autenticación",
          description: loginData.message || "Credenciales incorrectas o usuario no encontrado.",
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error("Error al conectar con la API:", error);
      toast({
        title: "Error de Conexión",
        description: "No se pudo conectar con el servidor. Verifica que el backend esté activo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Limpia el error cuando el usuario comienza a escribir
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
