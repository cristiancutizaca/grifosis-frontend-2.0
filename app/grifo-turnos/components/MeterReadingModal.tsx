import React, { useState, useEffect } from "react";
import {
  CreateMeterReading,
  UpdateMeterReading,
  ShiftReading,
} from "../types/meter-reading";
import { useMeterReading } from "../hooks/use-meter-reading";
import { getCurrentUser } from "../../grifo-usuario/GrifoUsuarios";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nozzleId: number;
  reading?: ShiftReading | null;
  onSaved: () => void;
}

export function useModal<T>() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);

  const open = (item?: T) => {
    setData(item ?? null);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setData(null);
  };

  return { isOpen, data, open, close };
}

const MeterReadingModal: React.FC<Props> = ({
  isOpen,
  onClose,
  nozzleId,
  reading,
  onSaved,
}) => {
  const { createReading, updateReading } = useMeterReading();
  const [form, setForm] = useState<CreateMeterReading | UpdateMeterReading>({
    nozzle_id: nozzleId,
    initial_reading: 0,
    final_reading: 0,
    user_id: getCurrentUser()?.user_id,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reading?.lastReading) {
      // Caso edición: solo cargar la última lectura
      setForm({
        nozzle_id: nozzleId,
        initial_reading: reading.lastReading.initial_reading,
        final_reading: reading.lastReading.final_reading,
        user_id: reading.lastReading.user_id ?? getCurrentUser()?.user_id,
      });
    } else {
      // Caso creación: no hay lecturas previas
      setForm({
        nozzle_id: nozzleId,
        initial_reading: 0,
        final_reading: 0,
        user_id: getCurrentUser()?.user_id,
      });
    }
    setError(null);
  }, [reading, nozzleId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (
        form.initial_reading === undefined ||
        form.final_reading === undefined ||
        form.initial_reading < 0 ||
        form.final_reading < 0
      ) {
        throw new Error("Las lecturas no pueden ser negativas");
      }
      if (form.final_reading < form.initial_reading) {
        throw new Error("La lectura final no puede ser menor que la inicial");
      }

      if (!reading?.lastReading) {
        // Crear nueva lectura
        await createReading(form as CreateMeterReading);
      } else {
        // Editar la última lectura
        await updateReading(reading.lastReading.reading_id, form);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error("❌ Error al guardar:", err);
      setError(err.message || "Error al guardar lecturas");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 p-6 rounded-xl shadow-xl w-96">
        <h2 className="text-lg font-bold mb-4 text-white">
          {reading?.lastReading ? "Editar Última Lectura" : "Nueva Lectura"}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="bg-slate-700 p-4 rounded-lg space-y-3">
          <div>
            <label className="block text-slate-300 mb-1">Lectura Inicial</label>
            <input
              className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
              type="number"
              min="0"
              step="0.01"
              value={form.initial_reading}
              onChange={(e) =>
                setForm({ ...form, initial_reading: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <label className="block text-slate-300 mb-1">Lectura Final</label>
            <input
              className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
              type="number"
              min="0"
              step="0.01"
              value={form.final_reading}
              onChange={(e) =>
                setForm({ ...form, final_reading: Number(e.target.value) })
              }
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-slate-600 hover:bg-slate-500 text-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed text-white"
          >
            {isSubmitting ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeterReadingModal;
