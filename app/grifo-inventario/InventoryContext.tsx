'use client'
import React, { createContext, useContext, ReactNode } from "react";
import { useProducts } from "./hooks/use-products";
import { useTanques } from "./hooks/use-tanks";
import { useInventario } from "./hooks/use-inventario";
import { useSurtidores } from "./hooks/use-surtidores";
import { useDispensador } from "./hooks/use-dispendador";

const InventoryContext = createContext<any>(null);

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const productosContext = useProducts();
  const tanquesContext = useTanques();
  const inventarioContext = useInventario();
  const surtidoresContext = useSurtidores();
  const dispensadorContext = useDispensador();

  return (
    <InventoryContext.Provider
      value={{
        productosContext,
        tanquesContext,
        inventarioContext,
        surtidoresContext,
        dispensadorContext,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory debe usarse dentro de InventoryProvider");
  return ctx;
};
