// src/hooks/useAuth.jsx
import { createContext, useContext, useState, useEffect } from 'react';

// Función auxiliar para obtener el objeto de almacenamiento basado en el tipo guardado.
const getStorage = () => {
    const storageType = localStorage.getItem('authStorageType');
    // Si el tipo es 'local', usamos localStorage. Si no está definido o es cualquier otra cosa, usamos sessionStorage como predeterminado/seguro.
    return storageType === 'local' ? localStorage : sessionStorage;
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pasajeroData, setPasajeroData] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // 2. FUNCIÓN DE REHIDRATACIÓN (useEffect) - Ahora usa el storage apropiado.
    useEffect(() => {
        // Al montar, primero revisamos si existe un token en localStorage (persistencia a largo plazo)
        let token = localStorage.getItem('authToken');
        let dataString = localStorage.getItem('pasajeroData');
        let storageUsed = 'local';

        // Si no hay datos en localStorage, revisamos sessionStorage (persistencia solo de sesión)
        if (!token) {
            token = sessionStorage.getItem('authToken');
            dataString = sessionStorage.getItem('pasajeroData');
            storageUsed = 'session';
        }

        if (token && dataString) {
            try {
                const data = JSON.parse(dataString);
                // Si los datos son válidos, rehidratar el estado en memoria
                setPasajeroData(data);
                setIsAuthenticated(true);

                // IMPORTANTE: Asegurarse de que el storage type esté correcto en localStorage 
                // para que futuras llamadas a getStorage() sean correctas (ej: logout).
                // Esto es más un control, pero la función setAuthData lo maneja.
                localStorage.setItem('authStorageType', storageUsed);

            } catch (error) {
                // En caso de que el JSON esté corrupto, limpiar ambos y no autenticar
                console.error("Error al parsear datos de pasajero:", error);
                localStorage.clear();
                sessionStorage.clear();
            }
        }

        // Marcar la autenticación como lista
        setIsAuthReady(true);
    }, []);

    // 3. FUNCIÓN PARA ESTABLECER DATOS (usada en Login)
    // 🛑 ACEPTA UN NUEVO PARÁMETRO: rememberMe
    const setAuthData = (token, data, rememberMe) => {
        // 1. Limpiar ambos (por si acaso, para evitar datos residuales).
        localStorage.clear();
        sessionStorage.clear();

        // 2. Determinar el objeto de almacenamiento.
        const storage = rememberMe ? localStorage : sessionStorage;
        const storageType = rememberMe ? 'local' : 'session';

        // 3. Guardar en el storage seleccionado.
        storage.setItem('authToken', token);
        storage.setItem('pasajeroData', JSON.stringify(data));

        // 4. Guardar el tipo de storage en localStorage (siempre) para que getStorage() funcione en la próxima carga.
        localStorage.setItem('authStorageType', storageType);
        
        // 5. Actualizar estado en memoria.
        setPasajeroData(data);
        setIsAuthenticated(true);
    };

    // 4. FUNCIÓN DE LOGOUT - Ahora limpia ambos (o usa getStorage si quieres ser más preciso, pero limpiar ambos es más seguro).
    const logout = () => {
        // Limpiamos la clave del tipo de storage para asegurar que en la próxima carga inicie 'vacío'.
        localStorage.removeItem('authStorageType'); 
        // Por seguridad, limpiamos ambos.
        localStorage.clear(); 
        sessionStorage.clear(); 
        setPasajeroData(null);
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            pasajeroData,
            isAuthReady,
            setAuthData, // <--- FUNCIÓN ACTUALIZADA
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);