import React, { useState, useEffect } from "react";
import { paymentMethod } from "../types/payment-methods";

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: Omit<paymentMethod, "payment_method_id" | "created_at" | "updated_at">
  ) => void;
  initialData?: paymentMethod | null;
}

export const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [form, setForm] = useState({
    method_name: "",
    description: "",
    is_active: true,
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        method_name: initialData.method_name,
        description: initialData.description || "",
        is_active: initialData.is_active,
      });
    } else {
      setForm({ method_name: "", description: "", is_active: true });
    }
  }, [initialData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">
          {initialData ? "✏️ Editar Método de Pago" : "➕ Nuevo Método de Pago"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-slate-300 mb-1">Nombre del método de pago</label>
            <input
              type="text"
              placeholder="Nombre del método"
              value={form.method_name}
              onChange={(e) => setForm({ ...form, method_name: e.target.value })}
              className="w-full p-2 rounded bg-slate-700 text-white"
            />
          </div>

          <textarea
            placeholder="Descripción (opcional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full p-2 rounded bg-slate-700 text-white"
          />

          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) =>
                setForm({ ...form, is_active: e.target.checked })
              }
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
