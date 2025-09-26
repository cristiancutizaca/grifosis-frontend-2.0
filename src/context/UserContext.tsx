"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getToken, getUserRole } from '../utils/auth';

// Tipado explícito para el usuario y para el contexto
interface UserContextType {
  user: { role: string } | null;
  setUser: React.Dispatch<React.SetStateAction<{ role: string } | null>>;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<{ role: string } | null>(null);

  useEffect(() => {
    const token = getToken();
    const role = getUserRole();
    setUser(role ? { role } : null);
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) throw new Error("useUser must be used within a UserProvider");
  return context;
};
