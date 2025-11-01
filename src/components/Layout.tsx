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
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 animate-fade-in">

        {children}

      </main>

    </div>

  );

};


export default Layout; 