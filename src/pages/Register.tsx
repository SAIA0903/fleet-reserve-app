import { useState, useCallback } from "react";
// Importaciones de componentes de interfaz de usuario
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox"; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; 
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { UserPlus, ArrowLeft } from "lucide-react";

// URL del endpoint GraphQL
const GRAPHQL_ENDPOINT = "http://localhost:8080/graphql";
// Longitud mínima para la contraseña
const MIN_PASSWORD_LENGTH = 8;
// Constantes para longitudes de campos
const MIN_LENGTH = 2;
const MAX_LENGTH = 60;
// Tipos de Identificación permitidos
const ID_TYPES = ["CC", "CE", "PP"];

// Definición de tipos para los datos del formulario
interface FormData {
    nombre: string;
    apellido: string;
    username: string;
    tipoIdentificacion: string;
    identificacion: string;
    phone: string;
    email: string;
    password: string;
    confirmPassword: string;
    acceptTerms: boolean;
}

const Register = () => {
    // Estado para gestionar los datos del formulario
    const [formData, setFormData] = useState<FormData>({
        nombre: "",
        apellido: "",
        username: "",
        tipoIdentificacion: "",
        identificacion: "",
        phone: "",
        email: "",
        password: "",
        confirmPassword: "",
        acceptTerms: false,
    });
    // Estado para manejar los errores de validación por campo
    const [errors, setErrors] = useState<Record<string, string>>({});
    // Estado para indicar si la solicitud está en progreso
    const [isLoading, setIsLoading] = useState(false);
    
    // Hooks para notificaciones y navegación
    const { toast } = useToast();
    const navigate = useNavigate();

    // --- Lógica de Validación ---

    // Expresiones regulares para la validación de campos específicos
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const E164_REGEX = /^\+\d{1,15}$/;
    const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?!.*\s).{8,}$/;

    // Funciones de validación
    const validateEmail = useCallback((email: string) => EMAIL_REGEX.test(email), []);
    const validatePhone = useCallback((phone: string) => E164_REGEX.test(phone), []);
    const validatePasswordComplexity = useCallback((password: string) => PASSWORD_COMPLEXITY_REGEX.test(password), []);
    const validateLength = useCallback((value: string) => {
        const len = value.length;
        return len < MIN_LENGTH || len > MAX_LENGTH
            ? `Debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres`
            : null;
    }, []);

    // Función principal para validar todo el formulario antes del envío
    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        const lengthFields: Array<keyof Omit<FormData, 'tipoIdentificacion' | 'acceptTerms'>> = [
            'nombre',
            'apellido',
            'username',
            'identificacion',
            'phone',
            'email',
            'password', 
            'confirmPassword',
        ];
        
        // 1. Validación de Campos de Texto (Longitud y Vacío)
        lengthFields.forEach(field => {
            const value = formData[field].trim();
            const label = field.charAt(0).toUpperCase() + field.slice(1);
            
            if (!value) {
                newErrors[field] = `Ingresar ${label}`;
            } else {
                if (['nombre', 'apellido', 'username', 'identificacion'].includes(field)) {
                    const lengthError = validateLength(value);
                    if (lengthError) {
                        newErrors[field] = lengthError;
                    }
                }
            }
        });

        // 2. Validación de Campos Específicos

        // Valida la selección de tipo de identificación
        if (!formData.tipoIdentificacion) {
            newErrors.tipoIdentificacion = "Seleccionar Tipo de Identificación";
        }

        // Valida el formato del teléfono
        if (formData.phone && !newErrors.phone && !validatePhone(formData.phone)) {
            newErrors.phone = "Formato de teléfono inválido (ej: +573001234567)";
        }

        // Valida el formato del correo electrónico
        if (formData.email && !newErrors.email && !validateEmail(formData.email)) {
            newErrors.email = "Formato de correo electrónico inválido";
        }

        // Valida la complejidad de la contraseña
        if (formData.password && !newErrors.password && !validatePasswordComplexity(formData.password)) {
            newErrors.password = "Mínimo 8 caracteres, incluye mayúscula, minúscula y dígito; sin espacios";
        }

        // Valida la coincidencia de contraseñas
        if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Las contraseñas no coinciden";
        }
        
        // 3. Validación del Checkbox (Obligatorio)
        if (!formData.acceptTerms) {
            newErrors.acceptTerms = "Debes aceptar los Términos y Política de Privacidad";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // --- Lógica de la API (GraphQL) ---

    // Maneja el envío del formulario y la llamada a la API de registro
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Muestra toast si la validación falla
        if (!validateForm()) {
            toast({
                title: "Campos Incompletos/Inválidos",
                description: "Por favor revisa y completa correctamente todos los campos marcados.",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);

        const {
            nombre,
            apellido,
            phone,
            username,
            email,
            password,
            confirmPassword,
            identificacion,
            tipoIdentificacion
        } = formData;

        // Construcción de la mutación GraphQL
        const registerMutation = `
            mutation RegisterPasajero {
                registerPasajero(
                    input: {
                        nombre: "${nombre}",
                        apellido: "${apellido}",
                        telefono: "${phone}",
                        username: "${username}",
                        email: "${email}",
                        password: "${password}",
                        passwordConfirm: "${confirmPassword}",
                        identificacion: "${identificacion}"
                    }
                ) {
                    success
                    message
                    pasajero {
                        id
                        username
                        email
                    }
                }
            }
        `;

        try {
            // Envía la solicitud GraphQL
            const response = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: registerMutation }),
            });

            const result = await response.json();

            // Manejo de errores de red o del servidor
            if (!response.ok || result.errors) {
                // Mensaje simplificado para el usuario final
                const errorMessage = "Ocurrió un error en el registro. Por favor, verifica tus datos e intenta de nuevo.";

                toast({
                    title: "Error en el registro",
                    description: errorMessage,
                    variant: "destructive",
                });
                return;
            }

            const registrationData = result.data.registerPasajero;

            // Manejo de registro exitoso
            if (registrationData.success) {
                toast({
                    title: "¡Registro exitoso!",
                    description: registrationData.message,
                });

                // Redirige a la página de login
                navigate("/login");
            } else {
                // Manejo de errores de validación del backend
                toast({
                    title: "Error de Validación",
                    description: registrationData.message,
                    variant: "destructive",
                });
            }

        } catch (error) {
            console.error("Error al conectar con la API:", error);
            // Mensaje simplificado para el usuario final
            toast({
                title: "Error de Conexión",
                description: "No se pudo conectar con el servicio. Por favor, intenta más tarde.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Maneja los cambios en los campos de texto y select
    const handleInputChange = (field: keyof Omit<FormData, 'acceptTerms'>, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Limpia errores al empezar a escribir
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: "" }));
        }

        // Lógica de validación en tiempo real (opcional)
        if (field === "email" && value.trim()) {
             if (!validateEmail(value)) {
                setErrors(prev => ({ ...prev, email: "Formato de correo electrónico inválido" }));
             } else if (errors.email === "Formato de correo electrónico inválido") {
                 setErrors(prev => ({ ...prev, email: "" }));
             }
        }

        if (field === "password" && value.length > 0) {
            if (!validatePasswordComplexity(value)) {
                setErrors(prev => ({ ...prev, password: "Mínimo 8 caracteres, incluye mayúscula, minúscula y dígito; sin espacios" }));
            } else if (errors.password) {
                setErrors(prev => ({ ...prev, password: "" }));
            }
        }

        if (field === "confirmPassword" || field === "password") {
            const passwordValue = field === "password" ? value : formData.password;
            const confirmValue = field === "confirmPassword" ? value : formData.confirmPassword;

            if (passwordValue.length > 0 && confirmValue.length > 0 && passwordValue !== confirmValue) {
                setErrors(prev => ({ ...prev, confirmPassword: "Las contraseñas no coinciden" }));
            } else if (passwordValue === confirmValue && errors.confirmPassword === "Las contraseñas no coinciden") {
                setErrors(prev => ({ ...prev, confirmPassword: "" }));
            }
        }
    };

    // Maneja el cambio en el checkbox de términos y condiciones
    const handleCheckboxChange = (checked: boolean) => {
        setFormData(prev => ({ ...prev, acceptTerms: checked }));
        if (errors.acceptTerms) {
            setErrors(prev => ({ ...prev, acceptTerms: "" }));
        }
    };

    // Componente para mostrar mensajes de error de validación
    const ErrorMessage = ({ field }: { field: keyof FormData | 'acceptTerms' }) => (
        <div className="h-5">
            {errors[field] && (
                <p id={`${String(field)}-error`} className="text-sm text-bus-danger" role="alert">
                    {errors[field]}
                </p>
            )}
        </div>
    );

    // --- Renderizado ---
    return (
        <Layout title="FleetGuard360" subtitle="Registro de Usuario">
            <div className="max-w-xl mx-auto">
                <Card className="shadow-elegant bg-gradient-card border-0">
                    <CardHeader className="space-y-4 text-center">
                        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                            <UserPlus className="h-8 w-8 text-bus-primary" />
                        </div>
                        <CardTitle className="text-2xl">Crear Cuenta Nueva</CardTitle>
                        <CardDescription>
                            Completa todos los campos obligatorios para registrarte en FleetGuard360
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-3" noValidate>

                            {/* Nombre y Apellido */}
                            <div className="flex space-x-4">
                                <div className="flex-1 space-y-2">
                                    <Label htmlFor="nombre">Nombre *</Label>
                                    <Input
                                        id="nombre"
                                        type="text"
                                        value={formData.nombre}
                                        onChange={(e) => handleInputChange("nombre", e.target.value)}
                                        className={errors.nombre ? "border-bus-danger focus:ring-bus-danger" : ""}
                                        placeholder="Ej: Juan"
                                        maxLength={MAX_LENGTH}
                                        aria-describedby={errors.nombre ? "nombre-error" : undefined}
                                        aria-invalid={!!errors.nombre}
                                    />
                                    <ErrorMessage field="nombre" />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <Label htmlFor="apellido">Apellido *</Label>
                                    <Input
                                        id="apellido"
                                        type="text"
                                        value={formData.apellido}
                                        onChange={(e) => handleInputChange("apellido", e.target.value)}
                                        className={errors.apellido ? "border-bus-danger focus:ring-bus-danger" : ""}
                                        placeholder="Ej: Pérez"
                                        maxLength={MAX_LENGTH}
                                        aria-describedby={errors.apellido ? "apellido-error" : undefined}
                                        aria-invalid={!!errors.apellido}
                                    />
                                    <ErrorMessage field="apellido" />
                                </div>
                            </div>

                            {/* Nombre de Usuario */}
                            <div className="space-y-2">
                                <Label htmlFor="username">Nombre de Usuario *</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => handleInputChange("username", e.target.value)}
                                    className={errors.username ? "border-bus-danger focus:ring-bus-danger" : ""}
                                    placeholder="Ej: juanperez123"
                                    maxLength={MAX_LENGTH}
                                    aria-describedby={errors.username ? "username-error" : undefined}
                                    aria-invalid={!!errors.username}
                                />
                                <ErrorMessage field="username" />
                            </div>

                            {/* Tipo y Número de Identificación */}
                            <div className="flex space-x-4">
                                <div className="w-1/3 space-y-2">
                                    <Label htmlFor="tipoIdentificacion">Tipo ID *</Label>
                                    <Select
                                        value={formData.tipoIdentificacion}
                                        onValueChange={(value: string) => handleInputChange("tipoIdentificacion", value)}
                                    >
                                        <SelectTrigger className={errors.tipoIdentificacion ? "border-bus-danger focus:ring-bus-danger" : ""}>
                                            <SelectValue placeholder="Seleccionar" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ID_TYPES.map(type => (
                                                <SelectItem key={type} value={type}>{type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <ErrorMessage field="tipoIdentificacion" />
                                </div>
                                <div className="w-2/3 space-y-2">
                                    <Label htmlFor="identificacion">Identificación *</Label>
                                    <Input
                                        id="identificacion"
                                        type="text"
                                        value={formData.identificacion}
                                        onChange={(e) => handleInputChange("identificacion", e.target.value)}
                                        className={errors.identificacion ? "border-bus-danger focus:ring-bus-danger" : ""}
                                        placeholder="Ej: 1020304050"
                                        maxLength={MAX_LENGTH}
                                        aria-describedby={errors.identificacion ? "identificacion-error" : undefined}
                                        aria-invalid={!!errors.identificacion}
                                    />
                                    <ErrorMessage field="identificacion" />
                                </div>
                            </div>

                            {/* Teléfono */}
                            <div className="space-y-2">
                                <Label htmlFor="phone">Teléfono *</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => handleInputChange("phone", e.target.value)}
                                    className={errors.phone ? "border-bus-danger focus:ring-bus-danger" : ""}
                                    placeholder="Ej: +573001234567"
                                    aria-describedby={errors.phone ? "phone-error" : undefined}
                                    aria-invalid={!!errors.phone}
                                />
                                <p className="text-xs text-muted-foreground mt-1">Formato internacional requerido (ej: +57...).</p>
                                <ErrorMessage field="phone" />
                            </div>

                            {/* Correo Electrónico */}
                            <div className="space-y-2">
                                <Label htmlFor="email">Correo Electrónico *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange("email", e.target.value)}
                                    className={errors.email ? "border-bus-danger focus:ring-bus-danger" : ""}
                                    placeholder="Ej: usuario@dominio.com"
                                    aria-describedby={errors.email ? "email-error" : undefined}
                                    aria-invalid={!!errors.email}
                                />
                                <ErrorMessage field="email" />
                            </div>

                            {/* Contraseña */}
                            <div className="space-y-2">
                                <Label htmlFor="password">Contraseña *</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => handleInputChange("password", e.target.value)}
                                    className={errors.password ? "border-bus-danger focus:ring-bus-danger" : ""}
                                    placeholder="Escribe tu contraseña aquí"
                                    aria-describedby={errors.password ? "password-error" : undefined}
                                    aria-invalid={!!errors.password}
                                />
                                <p className="text-xs text-muted-foreground mt-1">Debe ser de mínimo 8 caracteres, contar con mayúscula, minúscula, dígitos y sin espacios</p>
                                <ErrorMessage field="password" />
                            </div>

                            {/* Confirmar Contraseña */}
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirmar Contraseña *</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={formData.confirmPassword}
                                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                                    className={errors.confirmPassword ? "border-bus-danger focus:ring-bus-danger" : ""}
                                    placeholder="Repite tu contraseña"
                                    aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
                                    aria-invalid={!!errors.confirmPassword}
                                />
                                <ErrorMessage field="confirmPassword" />
                            </div>
                            
                            {/* Checkbox Términos y Condiciones */}
                            <div className="flex items-center space-x-2 pt-2">
                                <Checkbox
                                    id="acceptTerms"
                                    checked={formData.acceptTerms}
                                    onCheckedChange={(checked: boolean) => handleCheckboxChange(checked)}
                                    className={errors.acceptTerms ? "border-bus-danger data-[state=checked]:bg-bus-danger data-[state=checked]:text-white" : ""}
                                />
                                <Label
                                    htmlFor="acceptTerms"
                                    className={`text-sm font-medium leading-none ${errors.acceptTerms ? "text-bus-danger" : "peer-disabled:cursor-not-allowed peer-disabled:opacity-70"}`}
                                >
                                    Acepto los <Link to="/terminos" className="underline hover:text-primary" target="_blank" 
                                    rel="noopener noreferrer">Términos</Link> y la <Link to="/politicas" className="underline hover:text-primary" target="_blank" 
                                    rel="noopener noreferrer">Política de Privacidad</Link>.
                                </Label>
                            </div>
                            <ErrorMessage field="acceptTerms" />


                            <Button
                                type="submit"
                                className="w-full mt-6 bg-accent hover:bg-accent-hover text-accent-foreground shadow-button transition-smooth"
                                disabled={isLoading}
                            >
                                {isLoading ? "Registrando..." : "Registrarse"}
                            </Button>
                        </form>

                        <div className="mt-6 text-center space-y-4">
                            <p className="text-sm text-muted-foreground">
                                ¿Ya tienes cuenta?{" "}
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

export default Register;