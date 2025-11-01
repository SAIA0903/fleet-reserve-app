// src/hooks/useAuth.jsx (Conceptual)
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Inicializa el estado leyendo de localStorage al cargar la app
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('authToken')
  );
  const [pasajeroData, setPasajeroData] = useState(null);

  // Función para establecer los datos de autenticación DESDE EL LOGIN
  const setAuthData = (token, data) => {
    // 1. Persistencia (ya la haces en el login)
    // 2. Estado en memoria:
    setIsAuthenticated(true);
    setPasajeroData(data);
  };
  
  // (Lógica de rehidratación inicial en useEffect...)

  return (
    <AuthContext.Provider value={{ isAuthenticated, pasajeroData, setAuthData }}>
      {children}
    </AuthContext.Provider>
  );

  

};

export const useAuth = () => useContext(AuthContext);