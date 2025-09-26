import React, { useState, useEffect } from "react";

import { discount } from "../types/discounts";

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<discount, "id" | "created_at">) => void;
  initialData?: discount | null;
}

export const DiscountModal: React.FC<DiscountModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [form, setForm] = useState({
    name: "",
    gallons: 0,
    amount: 0,
    active: true,
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name,
        gallons: initialData.gallons,
        amount: initialData.amount,
        active: initialData.active,
      });
    } else {
      setForm({ name: "", gallons: 0, amount: 0, active: true });
    }
  }, [initialData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">
          {initialData ? "✏️ Editar Descuento" : "➕ Nuevo Descuento"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-slate-300 mb-1">Nombre del descuento</label>
            <input
              type="text"
              placeholder="Ej: Promo de madrugada"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full p-2 rounded bg-slate-700 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Cantidad mínima de galón</label>
            <input
              type="number"
              placeholder="Ej: 10"
              value={form.gallons}
              onChange={(e) =>
                setForm({ ...form, gallons: Number(e.target.value) })
              }
              className="w-full p-2 rounded bg-slate-700 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1">Monto de descuento (S/.) por galón</label>
            <input
              type="number"
              placeholder="Ej: 5"
              value={form.amount}
              onChange={(e) =>
                setForm({ ...form, amount: Number(e.target.value) })
              }
              className="w-full p-2 rounded bg-slate-700 text-white"
            />
          </div>

          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Activo
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onSave(form);
              onClose();
            }}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
