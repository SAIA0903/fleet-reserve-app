import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast"; 
import Layout from "@/components/Layout";
import { ArrowLeft, Mail } from "lucide-react"; 

// Define el endpoint para la comunicación con el servidor GraphQL
const GRAPHQL_ENDPOINT = "http://localhost:8080/graphql";

type ResetStep = "email"; 

/**
 * Componente principal para el flujo de restablecimiento de contraseña.
 * Permite al usuario ingresar su correo electrónico para solicitar un restablecimiento.
 */
const ResetPassword = () => {
    // Estado para controlar el paso actual del proceso (solo "email" por ahora)
    const [step, setStep] = useState<ResetStep>("email"); 
    // Estado para almacenar los datos del formulario (correo electrónico)
    const [formData, setFormData] = useState({
        email: "",
    });
    // Estado para gestionar los mensajes de error de validación del formulario
    const [errors, setErrors] = useState<Record<string, string>>({});
    // Estado para indicar si la solicitud al servidor está en curso
    const [isLoading, setIsLoading] = useState(false);
    // Hook para mostrar notificaciones al usuario
    const { toast } = useToast(); 
    // Hook de navegación para redirigir al usuario
    const navigate = useNavigate(); 

    /**
     * Valida si la cadena proporcionada tiene un formato de correo electrónico válido.
     */
    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    /**
     * Realiza la validación de los campos del formulario según el paso actual.
     * Devuelve true si el formulario es válido, false en caso contrario.
     */
    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (step === "email") {
            if (!formData.email.trim()) {
                newErrors.email = "Ingresar Correo Electrónico";
            } else if (!validateEmail(formData.email)) {
                newErrors.email = "Formato de correo electrónico inválido";
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    /**
     * Maneja el envío del formulario.
     * Realiza la validación y envía la mutación GraphQL para solicitar el restablecimiento.
     */
    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }

    setIsLoading(true);
    
    try {
        // Mutación GraphQL para solicitar el envío del correo de restablecimiento
        const sendPasswordResetMutation = `
            mutation SendResetPassword($email: String!) {
                sendPasswordReset(email: $email)
            }
        `;

        // Datos a enviar al endpoint GraphQL
        const graphqlPayload = {
            query: sendPasswordResetMutation,
            variables: {
                email: formData.email, 
            },
        };

        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(graphqlPayload),
        });

        const result = await response.json();
        
        // Manejo de errores de GraphQL 
        if (result.errors) {
            console.error("Errores en la respuesta del servidor.");
            // No se notifica al usuario final sobre errores internos/del servidor 
        }
        
    } catch (error) {
        // Manejo de errores de red. No se notifica al usuario final.
        console.error("Error inesperado en la solicitud.");
    } finally {
        setIsLoading(false);
        
        // Limpia el campo del formulario tras intentar el envío
        setFormData({ email: "" }); 
    }
};

    /**
     * Actualiza el estado del formulario con el nuevo valor.
     * También limpia el error asociado al campo si existe.
     */
    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: "" }));
        }
    };

    // Devuelve el icono de correo para el encabezado
    const getStepIcon = () => <Mail className="h-8 w-8 text-bus-primary" />;

    // Devuelve el título de la tarjeta
    const getStepTitle = () => "Restablecer Contraseña";

    // Devuelve la descripción de la tarjeta
    const getStepDescription = () => 
        "Ingresa tu correo electrónico para restablcer tu contraseña"; 

    return (
        <Layout title="FleetGuard360" subtitle="Restablecer Contraseña">
            <div className="max-w-md mx-auto">
                <Card className="shadow-elegant bg-gradient-card border-0">
                    <CardHeader className="space-y-4 text-center">
                        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                            {getStepIcon()}
                        </div>
                        <CardTitle className="text-2xl">{getStepTitle()}</CardTitle>
                        <CardDescription>
                            {getStepDescription()}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                            
                            {step === "email" && (
                                <div className="space-y-2">
                                    <Label htmlFor="email">Correo Electrónico</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => handleInputChange("email", e.target.value)}
                                        className={errors.email ? "border-bus-danger focus:ring-bus-danger" : ""}
                                        placeholder="usuario@dominio.com"
                                        aria-describedby={errors.email ? "email-error" : undefined}
                                        aria-invalid={!!errors.email}
                                    />
                                    <div className="h-5">
                                        {errors.email && (
                                            <p id="email-error" className="text-sm text-bus-danger" role="alert">
                                                {errors.email}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full bg-accent hover:bg-accent-hover text-accent-foreground shadow-button transition-smooth"
                                disabled={isLoading}
                            >
                                {isLoading 
                                    ? "Procesando..." 
                                    : "Enviar Correo Electrónico" 
                                }
                            </Button>
                        </form>

                        <div className="mt-6 text-center space-y-4">
                            <p className="text-sm text-muted-foreground">
                                ¿Recordaste tu contraseña?{" "}
                                <Link to="/login" className="text-primary hover:text-primary-hover font-medium transition-smooth">
                                    Iniciar Sesión
                                </Link>
                            </p>
                            
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

export default ResetPassword;