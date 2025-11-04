import { Link } from "react-router-dom";
// Importaciones de componentes de interfaz de usuario (Shadcn UI o similar)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Layout from "@/components/Layout";
import { Scale, ArrowLeft } from "lucide-react"; // Usamos un ícono de balanza (Scale) para lo legal

// Nombre de la App
const APP_NAME = "FleetGuard360";

const TermsAndConditions = () => {
    return (
        // Usamos el mismo Layout que envuelve la página de registro
        <Layout title={APP_NAME} subtitle="Términos de Uso">
            <div className="max-w-4xl mx-auto">
                {/* Usamos el mismo Card para la estructura principal */}
                <Card className="shadow-elegant bg-gradient-card border-0">
                    <CardHeader className="space-y-4 text-center">
                        {/* Ícono consistente con la estética de círculos de color */}
                        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                            <Scale className="h-8 w-8 text-bus-primary" />
                        </div>
                        {/* Título principal de la página */}
                        <CardTitle className="text-2xl">Términos y Condiciones de Servicio</CardTitle>
                    </CardHeader>
                    <CardContent className="text-muted-foreground space-y-8 p-6 md:p-10">
                        
                        {/* Sección 1: Introducción */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-primary">1. Aceptación de los Términos</h2>
                            <p>
                                Al acceder o utilizar el servicio web de reserva de tiquetes de autobús {APP_NAME} ("el Servicio"), usted ("el Usuario") acepta estar legalmente obligado por los presentes Términos y Condiciones de Uso ("los Términos"). Si no está de acuerdo con la totalidad de los Términos, no debe utilizar el Servicio.
                            </p>
                        </div>

                        {/* Sección 2: El Servicio */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-primary">2. Descripción del Servicio</h2>
                            <p>
                                {APP_NAME} actúa como una plataforma intermediaria que facilita la búsqueda, comparación y reserva de tiquetes de autobús ofrecidos por diversas empresas de transporte de terceros ("Proveedores"). 
                            </p>
                            <ul className="list-disc list-inside space-y-2 pl-4">
                                <li>Reservas: El contrato de transporte se establece directamente entre usted y el Proveedor. {APP_NAME} no es el transportista.</li>
                                <li>Información: Hacemos todo lo posible por asegurar la exactitud de los horarios y precios, pero no garantizamos que la información sea libre de errores.</li>
                            </ul>
                        </div>
                        
                        {/* Sección 3: Obligaciones del Usuario */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-primary">3. Uso de la Cuenta y Conducta</h2>
                            <ul className="list-disc list-inside space-y-2 pl-4">
                                <li>Registro: Usted se compromete a proporcionar información veraz, precisa y completa durante el proceso de registro y reserva.</li>
                                <li>Seguridad: Usted es responsable de mantener la confidencialidad de su contraseña y de todas las actividades que ocurran bajo su cuenta.</li>
                                <li>Uso Prohibido: No utilizará la plataforma para realizar reservas fraudulentas, spam o cualquier actividad que infrinja leyes o derechos de terceros.</li>
                            </ul>
                        </div>

                        {/* Sección 4: Precios, Pagos y Cancelaciones */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-primary">4. Políticas de Compra</h2>
                            <p>
                                Los precios de los tiquetes son fijados por los Proveedores y pueden incluir tarifas de servicio de {APP_NAME}.
                            </p>
                            <ul className="list-disc list-inside space-y-2 pl-4">
                                <li>Métodos de Pago: Aceptamos los métodos de pago indicados en la plataforma. Todos los pagos son procesados por pasarelas de pago de terceros seguras.</li>
                                <li>Cancelaciones y Reembolsos: Las políticas de cancelación, cambio y reembolso son definidas por el Proveedor de transporte y se aplican en cada tiquete. {APP_NAME} facilita el proceso, pero el reembolso está sujeto a la política del Proveedor.</li>
                            </ul>
                        </div>

                        {/* Sección 5: Limitación de Responsabilidad */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-primary">5. Exclusión de Garantías y Limitación de Responsabilidad</h2>
                            <p>
                                {APP_NAME} ofrece el Servicio "tal cual" y "según disponibilidad". No somos responsables de retrasos, cancelaciones, pérdidas de equipaje, daños o lesiones causados por el Proveedor o por fuerza mayor durante el viaje. Nuestra responsabilidad máxima se limita al monto de la tarifa de servicio cobrada por {APP_NAME} en la transacción específica.
                            </p>
                        </div>
                        
                        {/* Enlace a la Política de Privacidad */}
                        <div className="space-y-2 pt-4">
                            <h2 className="text-xl font-semibold text-primary">6. Política de Privacidad</h2>
                            <p>
                                Su uso del Servicio también se rige por nuestra <Link to="/politicas" className="underline hover:text-primary font-medium" >Política de Privacidad</Link>, que explica cómo recopilamos, usamos y protegemos su información personal.
                            </p>
                        </div>
                        
                        {/* Enlace de regreso al inicio o login */}
                        <div className="pt-6 text-center">
                            <Button variant="ghost" asChild className="text-muted-foreground">
                                <Link to="/" className="flex items-center gap-2">
                                    <ArrowLeft className="h-4 w-4" />
                                    Volver a la Página Principal
                                </Link>
                            </Button>
                        </div>

                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
};

export default TermsAndConditions;