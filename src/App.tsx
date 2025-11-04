import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Search from "./pages/Search";
import NotFound from "./pages/NotFound";
import MyReservations from "@/pages/MyReservations";
import Reservar from "@/pages/Reservar";
import ChangePassword from "./pages/ChangePassword";
import BusTrackingPage from "./pages/BusTrackingPage";
import { AuthProvider } from "./hooks/useAuth";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/search" element={<Search />} />
        <Route path="/mis-reservas" element={<MyReservations />} />
        <Route path="/reservar" element={<Reservar />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/mapa" element={<BusTrackingPage/>}/>
        <Route path="*" element={<NotFound />} />
      </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
