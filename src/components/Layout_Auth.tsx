 import { ReactNode } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import { User, LogOut } from "lucide-react";

import {

  DropdownMenu,

  DropdownMenuContent,

  DropdownMenuItem,

  DropdownMenuTrigger,

} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { useAuth } from "@/hooks/useAuth";

interface LayoutProps {

  children: ReactNode;

  title: string;

  subtitle: string;

}


const Layout = ({ children, title, subtitle }: LayoutProps) => {

  const location = useLocation();

  const navigate = useNavigate();

 

  // Show user icon only on Search page (authenticated pages)

  const showUserIcon = location.pathname === "/search" || location.pathname === "/reservar" || location.pathname === "/mis-reservas";


  const handleLogout = () => {

    // 1. ELIMINAR LA INFORMACIÓN DEL FRONTEND (Local Storage)

   

    // Opción A: Eliminar todas las claves (token, user_data, settings, etc.)

    // Si tienes información que NO quieres borrar (ej. tema oscuro), usa la Opción B.

    localStorage.clear();

    // Opción B: Eliminar claves específicas (Recomendado para mayor control)

    //localStorage.removeItem("authToken"); // Clave del token de autenticación

    //localStorage.removeItem("userData"); // Clave de los datos del usuario

    // Agrega aquí cualquier otra clave que uses para la sesión


    // 2. Redirigir al usuario a la página de inicio o login

    navigate("/");

  };


  return (

    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30">

      <header className="bg-gradient-primary shadow-elegant relative">

        <div className="container mx-auto px-4 py-6">

          <h1 className="text-3xl font-bold text-primary-foreground text-center">

            {title}

          </h1>

          <p className="text-primary-foreground/90 text-center mt-2 text-lg">

            {subtitle}

          </p>

         

          {showUserIcon && (

            <div className="absolute top-6 right-4">

              <DropdownMenu>

                <DropdownMenuTrigger asChild>

                  <Button

                    variant="ghost"

                    size="icon"

                    className="rounded-full hover:bg-primary-foreground/10 text-primary-foreground"

                    aria-label="Menú de usuario"

                  >

                    <Avatar className="h-8 w-8">

                      <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground">

                        <User className="h-4 w-4" />

                      </AvatarFallback>

                    </Avatar>

                  </Button>

                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48">

                  <DropdownMenuItem

                    onClick={handleLogout}

                    className="cursor-pointer focus:bg-accent focus:text-accent-foreground"

                  >

                    <LogOut className="mr-2 h-4 w-4" />

                    Cerrar sesión

                  </DropdownMenuItem>

                </DropdownMenuContent>

              </DropdownMenu>

            </div>

          )}

        </div>

      </header>

     

      <main className="container mx-auto px-4 py-8 animate-fade-in">

        {children}

      </main>

    </div>

  );

};


export default Layout; 