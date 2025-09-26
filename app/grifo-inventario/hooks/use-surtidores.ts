import { useState, useEffect, useCallback } from "react";
import { Surtidores } from "../types/surtidores";
import { SurtidoresTanques } from "../types/surtidores-tanques";
import PumpService from "../../../src/services/pumpService";
import PumpsTanksService from "../../../src/services/PumpsTanksService";
import { useNotification } from '../../../src/hooks/use-notification';
import { NotificationType } from "../../../src/types/notification";
import { CommonMessages, PumpMessages } from "../constants/messages";

export function useSurtidores() {
  const { notifications, addNotification, removeNotification } = useNotification();

  // --- Estados de Surtidores ---
  const [surtidores, setSurtidores] = useState<Surtidores[]>([]);
  const [form, setForm] = useState<Partial<Surtidores>>({
    pump_id: 0,
    pump_number: "",
    pump_name: "",
    location_description: "",
    created_at: "",
    updated_at: "",
  });
  const [editingSurtidor, setEditingSurtidor] = useState<Surtidores | null>(null);
  const [showModal, setShowModal] = useState(false);

  // --- Estados de Relaciones Surtidores-Tanques ---
  const [surtidoresTanques, setSurtidoresTanques] = useState<SurtidoresTanques[]>([]);
  const [selectedTanks, setSelectedTanks] = useState<number[]>([]);

  // --- Estados generales ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // --- Gestión de Modal ---
  const handleOpenModal = (surtidor?: Surtidores) => {
    if (surtidor) {
      setEditingSurtidor(surtidor);
      setForm(surtidor);
      const tankIds = getTankIdsByPumpId(surtidor.pump_id);
      setSelectedTanks(tankIds);
    } else {
      setEditingSurtidor(null);
      setForm({
        pump_id: 0,
        pump_number: "",
        pump_name: "",
        location_description: "",
        created_at: "",
        updated_at: "",
      });
      setSelectedTanks([]);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSurtidor(null);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // --- Guardar (crear o actualizar) un surtidor + relaciones ---
  const handleSave = async () => {
    if (!form.pump_name || !form.pump_number) {
      addNotification(CommonMessages.REQUIRED_FIELDS, NotificationType.WARNING);
      return;
    }

    const payload = {
      ...form,
      pump_id: undefined,
      created_at: undefined,
      updated_at: undefined,
      location_description: form.location_description?.trim() || null,
    };

    try {
      setLoading(true);
      let pumpId: number;

      if (editingSurtidor) {
        // actualizar
        const updatedSurtidor = await PumpService.updatePump(
          editingSurtidor.pump_id,
          payload
        );
        pumpId = updatedSurtidor.pump_id;

        if (selectedTanks.length > 0) {
          await PumpsTanksService.replaceTanksForPump(pumpId, selectedTanks);
        }

        setSurtidores((prev) =>
          prev.map((s) => (s.pump_id === pumpId ? updatedSurtidor : s))
        );
        addNotification(PumpMessages.UPDATED, NotificationType.SUCCESS);
      } else {
        // Agregar un nuevo surtidor
        const newSurtidor = await PumpService.createPump(payload);
        pumpId = newSurtidor.pump_id;

        setSurtidores((prev) => [...prev, newSurtidor]);

        if (selectedTanks.length > 0) {
          await PumpsTanksService.assignTanksToPump(pumpId, selectedTanks);
        }
        addNotification(PumpMessages.CREATED, NotificationType.SUCCESS);
      }

      await fetchSurtidores();
      await fetchSurtidoresTanques();

      setSuccess(true);
      handleCloseModal();
    } catch (err: any) {
      addNotification(err.message || PumpMessages.ERROR_SAVE, NotificationType.ERROR);
    } finally {
      setLoading(false);
    }
  };

  const fetchSurtidores = useCallback(async () => {
    try {
      setLoading(true);
      const data = await PumpService.getAllPumps();
      setSurtidores(data);
    } catch (err: any) {
      addNotification(err.message || PumpMessages.ERROR_LOAD, NotificationType.ERROR);
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  const fetchSurtidoresTanques = useCallback(async () => {
    try {
      setLoading(true);
      const data = await PumpsTanksService.getAllPumpTanks();
      setSurtidoresTanques(data);
    } catch (err: any) {
      addNotification(err.message || PumpMessages.ERROR_LOAD + "-tanques", NotificationType.ERROR);
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  // --- Cargar datos al montar ---
  useEffect(() => {
    fetchSurtidores();
    fetchSurtidoresTanques();
  }, [fetchSurtidores, fetchSurtidoresTanques]);

  // --- Eliminar ---
  const handleDelete = async (pump_id: number) => {
    if (window.confirm(CommonMessages.CONFIRM_DELETE)) {
      try {
        setLoading(true);
        await PumpService.deletePump(pump_id);
        setSurtidores((prev) => prev.filter((s) => s.pump_id !== pump_id));
        addNotification(PumpMessages.DELETED, NotificationType.INFO)
      } catch (err: any) {
        addNotification(err.message || PumpMessages.ERROR_DELETE, NotificationType.ERROR);
      } finally {
        setLoading(false);
      }
    }
  };

  // --- Utilidades ---
  const toggleTankSelection = (tankId: number) => {
    setSelectedTanks((prev) =>
      prev.includes(tankId) ? prev.filter((id) => id !== tankId) : [...prev, tankId]
    );
  };

  const getTankNamesByPumpId = (pumpId: number): string[] => {
    return surtidoresTanques
      .filter((rel) => rel.pump.pump_id === pumpId)
      .map((rel) => rel.tank.tank_name);
  };

  const getTankIdsByPumpId = (pumpId: number): number[] => {
    return surtidoresTanques
      .filter((rel) => rel.pump.pump_id === pumpId)
      .map((rel) => rel.tank.tank_id);
  };

  return {
    // Surtidores
    surtidores,
    form,
    editingSurtidor,
    showModal,
    setForm,

    // Relaciones
    surtidoresTanques,
    selectedTanks,
    setSelectedTanks,
    toggleTankSelection,

    // Estados
    loading,
    error,
    success,

    // Acciones
    handleOpenModal,
    handleCloseModal,
    handleChange,
    handleSave,
    handleDelete,
    getTankNamesByPumpId,
    getTankIdsByPumpId,
    fetchSurtidores,
    fetchSurtidoresTanques,

    // notificaciones
    notifications,
    removeNotification,    
  };
}
