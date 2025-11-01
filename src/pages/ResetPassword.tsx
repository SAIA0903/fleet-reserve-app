import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast"; 
import Layout from "@/components/Layout";
import { ArrowLeft, Mail } from "lucide-react"; 

// URL del endpoint GraphQL local
const GRAPHQL_ENDPOINT = "http://localhost:8080/graphql";

type ResetStep = "email"; 

const ResetPassword = () => {
    const [step, setStep] = useState<ResetStep>("email"); 
    const [formData, setFormData] = useState({
        email: "",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast(); 
    const navigate = useNavigate(); 

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

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

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }

    setIsLoading(true);
    
    try {
        // 🚀 MEJORA: Definir la mutación con una variable ($email)
        const sendPasswordResetMutation = `
            mutation SendResetPassword($email: String!) {
                sendPasswordReset(email: $email)
            }
        `;

        // 💡 MEJORA: Pasar las variables en un objeto separado
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
            // Se envía el payload con 'query' y 'variables'
            body: JSON.stringify(graphqlPayload),
        });

        const result = await response.json();
        
        // Manejo de errores de GraphQL (sin notificar al usuario, como se solicitó)
        if (result.errors) {
            console.error("GraphQL Errors:", result.errors);
            // Aunque no notificamos, si hay un error crítico, 
            // no deberíamos limpiar el formulario.
            // Si el backend siempre devuelve un error en caso de fallo (ej: email no encontrado),
            // se puede manejar aquí sin `throw`, solo haciendo `return`.
        }
        
    } catch (error) {
        // Manejo de errores de red o errores inesperados de fetch
        console.error("Error al solicitar restablecimiento de contraseña:", error);
    } finally {
        setIsLoading(false);
        
        // La limpieza del formulario se mantiene aquí. 
        // Si el requisito fuera NO limpiar el email en caso de error, 
        // se debería mover esta línea dentro del 'try' ANTES del `if (result.errors)`.
        setFormData({ email: "" }); 
    }
};

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: "" }));
        }
    };

    const getStepIcon = () => <Mail className="h-8 w-8 text-bus-primary" />;

    const getStepTitle = () => "Restablecer Contraseña";

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