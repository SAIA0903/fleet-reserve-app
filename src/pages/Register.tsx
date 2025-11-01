import { useState, useCallback } from "react";
// Se asume que estos componentes existen en tu librería de UI
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox"; // Nuevo: para Términos y Condiciones
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Nuevo: para Tipo de Identificación
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { UserPlus, ArrowLeft } from "lucide-react";

// URL de tu endpoint GraphQL de Spring Boot
const GRAPHQL_ENDPOINT = "http://localhost:8080/graphql";
// Constante para el tamaño mínimo de la contraseña
const MIN_PASSWORD_LENGTH = 8;
// Constantes para longitudes mínimas y máximas
const MIN_LENGTH = 2;
const MAX_LENGTH = 60;
// Tipos de Identificación
const ID_TYPES = ["CC", "CE", "PP"];

// Definición de tipos para los datos del formulario (Actualizado)
interface FormData {
  nombre: string;
  apellido: string;
  username: string;
  tipoIdentificacion: string; // Nuevo campo
  identificacion: string; // Nuevo campo
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean; // Nuevo campo para checkbox
}

const Register = () => {
  const [formData, setFormData] = useState<FormData>({
    nombre: "",
    apellido: "",
    username: "",
    tipoIdentificacion: "", // Valor inicial vacío
    identificacion: "", // Valor inicial vacío
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false, // Valor inicial para checkbox
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // --- Lógica de Validación ---

  // Regex de Correo Electrónico
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Regex E.164 (simplificado para validación front-end: empieza con +, seguido de 1 a 15 dígitos)
  const E164_REGEX = /^\+\d{1,15}$/;
  // Regex de Contraseña: Mínimo 8 caracteres, incluye mayúscula, minúscula y dígito, sin espacios
  const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?!.*\s).{8,}$/;

  const validateEmail = useCallback((email: string) => EMAIL_REGEX.test(email), []);
  const validatePhone = useCallback((phone: string) => E164_REGEX.test(phone), []);
  const validatePasswordComplexity = useCallback((password: string) => PASSWORD_COMPLEXITY_REGEX.test(password), []);
  const validateLength = useCallback((value: string) => {
    const len = value.length;
    return len < MIN_LENGTH || len > MAX_LENGTH
      ? `Debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres`
      : null;
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Campos con validación de longitud (2 a 60)
    // NOTA: 'acceptTerms' fue eliminado de aquí ya que es un booleano.
    const lengthFields: Array<keyof Omit<FormData, 'tipoIdentificacion' | 'acceptTerms'>> = [
      'nombre',
      'apellido',
      'username',
      'identificacion',
      'phone', // Aunque 'phone' tiene su propia regex, se valida la longitud aquí
      'email', // Aunque 'email' tiene su propia regex, se valida la longitud aquí
      'password', 
      'confirmPassword',
    ];
    
    // 1. Validación de Campos de Texto (Longitud y Vacío)
    lengthFields.forEach(field => {
      const value = formData[field].trim(); // Ahora 'value' es definitivamente un string
      const label = field.charAt(0).toUpperCase() + field.slice(1);
      
      if (!value) {
        newErrors[field] = `Ingresar ${label}`;
      } else {
        // Aplica validación de longitud (solo a campos relevantes para 2-60)
        if (['nombre', 'apellido', 'username', 'identificacion'].includes(field)) {
             const lengthError = validateLength(value);
             if (lengthError) {
                 newErrors[field] = lengthError;
             }
        }
      }
    });

    // 2. Validación de Campos Específicos

    // Tipo de Identificación (obligatorio)
    if (!formData.tipoIdentificacion) {
      newErrors.tipoIdentificacion = "Seleccionar Tipo de Identificación";
    }

    // Teléfono (formato E.164)
    if (formData.phone && !newErrors.phone && !validatePhone(formData.phone)) {
      newErrors.phone = "Formato de teléfono inválido (ej: +573001234567)";
    }

    // Correo Electrónico (formato válido)
    if (formData.email && !newErrors.email && !validateEmail(formData.email)) {
      newErrors.email = "Formato de correo electrónico inválido";
    }

    // Contraseña (obligatorio + complejidad)
    if (formData.password && !newErrors.password && !validatePasswordComplexity(formData.password)) {
      newErrors.password = "Mínimo 8 caracteres, incluye mayúscula, minúscula y dígito; sin espacios";
    }

    // Confirmación de Contraseña (coincidencia)
    if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Las contraseñas no coinciden";
    }
    
    // 3. Validación del Checkbox (Obligatorio)
    // ESTA ES LA CLAVE: Se valida 'acceptTerms' de forma independiente
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = "Debes aceptar los Términos y Política de Privacidad";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Lógica de la API (GraphQL) ---

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    // **[CAMBIO]** Query de GraphQL actualizado para incluir tipoIdentificacion e identificacion
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
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: registerMutation }),
      });

      const result = await response.json();

      if (!response.ok || result.errors) {
        const errorMessage = result.errors
          ? result.errors[0].message
          : "Error de red o servidor al procesar la solicitud.";

        toast({
          title: "Error en la conexión o GraphQL",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      const registrationData = result.data.registerPasajero;

      if (registrationData.success) {
        toast({
          title: "¡Registro exitoso! 🚀",
          description: registrationData.message,
        });

        navigate("/login");
      } else {
        toast({
          title: "Error de Validación",
          description: registrationData.message,
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

  // Función para manejar cambios en Input y Select
  const handleInputChange = (field: keyof Omit<FormData, 'acceptTerms'>, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Limpiar error al empezar a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }

    // Validación de email en tiempo real
    if (field === "email" && value.trim()) {
      if (!validateEmail(value)) {
        setErrors(prev => ({ ...prev, email: "Formato de correo electrónico inválido" }));
      } else if (errors.email === "Formato de correo electrónico inválido") {
        setErrors(prev => ({ ...prev, email: "" }));
      }
    }

    // Validación de Contraseña en tiempo real
    if (field === "password" && value.length > 0) {
      if (!validatePasswordComplexity(value)) {
        setErrors(prev => ({ ...prev, password: "Mínimo 8 caracteres, incluye mayúscula, minúscula y dígito; sin espacios" }));
      } else if (errors.password) {
        setErrors(prev => ({ ...prev, password: "" }));
      }
    }

    // Validación de coincidencia de contraseñas en tiempo real
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

  // Función para manejar el checkbox
  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, acceptTerms: checked }));
    if (errors.acceptTerms) {
      setErrors(prev => ({ ...prev, acceptTerms: "" }));
    }
  };

  // Componente de Error Reutilizable (Mantiene la altura fija)
  const ErrorMessage = ({ field }: { field: keyof FormData | 'acceptTerms' }) => (
    <div className="h-5">
      {errors[field] && (
        <p id={`${String(field)}-error`} className="text-sm text-bus-danger" role="alert">
          {errors[field]}
        </p>
      )}
    </div>
  );

  // --- Renderizado (Actualizado) ---
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
                    onValueChange={(value: string) => setFormData(prev => ({ ...prev, tipoIdentificacion: value }))}
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
                  Acepto los <Link to="/terms" className="underline hover:text-primary">Términos</Link> y la <Link to="/privacy" className="underline hover:text-primary">Política de Privacidad</Link> *.
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