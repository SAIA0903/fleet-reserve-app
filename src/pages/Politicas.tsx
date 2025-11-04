import { Link } from "react-router-dom";
// Importaciones de componentes de interfaz de usuario (Shadcn UI o similar)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Layout from "@/components/Layout";
import { Shield, ArrowLeft } from "lucide-react"; // Usamos un ícono de escudo (Shield) para la privacidad

// Nombre de la App
const APP_NAME = "FleetGuard360";

const PrivacyPolicy = () => {
    return (
        // Usamos el mismo Layout para mantener la consistencia
        <Layout title={APP_NAME} subtitle="Política de Privacidad">
            <div className="max-w-4xl mx-auto">
                {/* Usamos el mismo Card para el contenedor principal */}
                <Card className="shadow-elegant bg-gradient-card border-0">
                    <CardHeader className="space-y-4 text-center">
                        {/* Ícono consistente con la estética de círculos de color */}
                        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                            <Shield className="h-8 w-8 text-bus-primary" />
                        </div>
                        {/* Título principal de la página */}
                        <CardTitle className="text-2xl">Política de Privacidad</CardTitle>
                    </CardHeader>
                    <CardContent className="text-muted-foreground space-y-8 p-6 md:p-10">
                        
                        {/* Sección 1: Introducción */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-primary">1. Información que Recopilamos</h2>
                            <p>
                                Recopilamos información para proporcionarle el servicio de reserva de tiquetes de bus de {APP_NAME} de manera eficiente.
                            </p>
                            <ul className="list-disc list-inside space-y-2 pl-4">
                                <li>Información de Registro: Nombre, apellido, nombre de usuario, tipo y número de identificación, número de teléfono y dirección de correo electrónico.</li>
                                <li>Información de Reserva: Origen, destino, fechas de viaje, hora, detalles del tiquete y asientos seleccionados.</li>
                                <li>Datos de Pago: Aunque no almacenamos directamente su información financiera (como números de tarjeta), recopilamos un identificador de transacción y detalles limitados de la pasarela de pago para confirmar su compra.</li>
                                <li>Datos de Uso: Información sobre cómo utiliza nuestra aplicación (dirección IP, tipo de navegador, páginas visitadas, tiempos de acceso).</li>
                            </ul>
                        </div>

                        {/* Sección 2: Uso de la Información */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-primary">2. ¿Cómo Usamos su Información?</h2>
                            <p>
                                Utilizamos su información personal para los siguientes fines:
                            </p>
                            <ul className="list-disc list-inside space-y-2 pl-4">
                                <li>Procesar Reservas: Para completar sus compras de tiquetes y gestionar su viaje.</li>
                                <li>Comunicación: Para enviarle confirmaciones de reserva, notificaciones sobre cambios en el servicio o información de la cuenta.</li>
                                <li>Mejora del Servicio: Analizar el uso de la aplicación para optimizar la experiencia del usuario y la funcionalidad.</li>
                                <li>Seguridad: Prevenir actividades fraudulentas y garantizar la seguridad de nuestra plataforma y nuestros usuarios.</li>
                            </ul>
                        </div>
                        
                        {/* Sección 3: Compartición de Información */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-primary">3. Compartición de Datos con Terceros</h2>
                            <p>
                                Compartimos su información personal solo cuando es necesario para operar el servicio o por obligación legal.
                            </p>
                            <ul className="list-disc list-inside space-y-2 pl-4">
                                <li>Proveedores de Transporte: Compartimos sus datos de nombre, identificación y contacto con la empresa de autobuses seleccionada para la emisión de su tiquete.</li>
                                <li>Proveedores de Servicios: Compartimos datos con empresas que nos ayudan a gestionar pagos (pasarelas de pago) o enviar comunicaciones (servicios de correo electrónico).</li>
                                <li>Cumplimiento Legal: Cuando la ley lo requiera o para responder a procesos legales válidos.</li>
                            </ul>
                        </div>

                        {/* Sección 4: Seguridad de los Datos */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-primary">4. Seguridad de los Datos</h2>
                            <p>
                                Implementamos medidas de seguridad técnicas y organizativas para proteger su información personal contra el acceso, uso o divulgación no autorizados. Sin embargo, ninguna transmisión por Internet es completamente segura, por lo que no podemos garantizar la seguridad absoluta.
                            </p>
                        </div>
                        
                        {/* Sección 5: Enlaces */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-primary">5. Enlaces a Otros Sitios Web</h2>
                            <p>
                                Nuestro Servicio puede contener enlaces a sitios web de terceros (como los Proveedores de transporte). No somos responsables de las prácticas de privacidad de estos sitios. Le recomendamos revisar las políticas de privacidad de cualquier sitio web de terceros que visite.
                            </p>
                        </div>
                        
                        {/* Enlace de regreso al inicio o login */}
                        <div className="pt-6 text-center space-y-4">
                             <h2 className="text-xl font-semibold text-primary">Revisar Términos</h2>
                            <p className="text-sm">
                                Para entender completamente sus derechos y responsabilidades en nuestra plataforma, le invitamos a revisar nuestros <Link to="/terminos" className="underline hover:text-primary font-medium" >Términos y Condiciones de Uso</Link>.
                            </p>
                            <Button variant="ghost" asChild className="text-muted-foreground">
                                <Link to="/" className="flex items-center gap-2" >
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

export default PrivacyPolicy;