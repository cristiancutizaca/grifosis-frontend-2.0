'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, Pencil, Trash2, Loader2, Search } from 'lucide-react';
import clientDriversService, {
  ClientDriver,
  CreateClientDriverBody,
  UpdateClientDriverBody,
} from '../../../src/services/clientDriversService';

type Props = {
  open: boolean;
  onClose: () => void;
  companyId: number;
  companyName?: string | null;
};

const emptyForm: CreateClientDriverBody = {
  full_name: '',
  dni: '',
  plate: '',
  phone: '',
  notes: '',
  // ocultamos/omitimos los demás campos
};

export default function CompanyDriversModal({ open, onClose, companyId, companyName }: Props) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [drivers, setDrivers] = useState<ClientDriver[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // form
  const [form, setForm] = useState<CreateClientDriverBody>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  // cerrar al hacer click fuera
  const backdropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await clientDriversService.list(companyId);
        setDrivers(rows ?? []);
      } catch (e: any) {
        setError(e?.response?.data?.message ?? e?.message ?? 'No se pudo cargar la lista');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, companyId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return drivers;
    const q = query.trim().toLowerCase();
    return drivers.filter((d) =>
      [d.full_name, d.dni, d.plate]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [drivers, query]);

  const startCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError(null);
  };

  const startEdit = (d: ClientDriver) => {
    setEditingId(d.driver_id);
    setForm({
      full_name: d.full_name ?? '',
      dni: d.dni ?? '',
      plate: d.plate ?? '',
      phone: d.phone ?? '',
      notes: d.notes ?? '',
    });
    setError(null);
  };

  const clearForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError(null);
  };

  // ====== NORMALIZADORES / LIMITES ======
  const onDniChange = (val: string) => {
    // solo dígitos, máximo 8
    const cleaned = val.replace(/\D+/g, '').slice(0, 8);
    setForm((s) => ({ ...s, dni: cleaned }));
  };

  const onPlateChange = (val: string) => {
    // mayúsculas, solo A-Z 0-9 y '-', máximo 8 (p.e. ABC-123)
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8);
    setForm((s) => ({ ...s, plate: cleaned }));
  };

  const onPhoneChange = (val: string) => {
    // opcional: permitimos +, dígitos y espacio, máximo 15
    const cleaned = val.replace(/[^\d+ ]/g, '').slice(0, 15);
    setForm((s) => ({ ...s, phone: cleaned }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones mínimas
    if (!form.full_name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (form.dni && form.dni.length !== 8) {
      setError('El DNI debe tener 8 dígitos.');
      return;
    }
    if (form.plate && form.plate.length > 8) {
      setError('La placa no puede exceder 8 caracteres (ej. ABC-123).');
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      const body: CreateClientDriverBody | UpdateClientDriverBody = {
        full_name: form.full_name.trim(),
        dni: form.dni?.trim() || undefined,
        plate: form.plate?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
      };

      const saved = editingId
        ? await clientDriversService.update(companyId, editingId, body)
        : await clientDriversService.create(companyId, body as CreateClientDriverBody);

      // merge ordenado
      setDrivers((prev) => {
        const map = new Map(prev.map((x) => [x.driver_id, x]));
        map.set(saved.driver_id, saved);
        return Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
      });

      clearForm();
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          'No se pudo guardar el conductor. Revisa los datos.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const remove = async (d: ClientDriver) => {
    if (!confirm(`Eliminar conductor "${d.full_name}"?`)) return;
    try {
      await clientDriversService.remove(companyId, d.driver_id);
      setDrivers((prev) => prev.filter((x) => x.driver_id !== d.driver_id));
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'No se pudo eliminar.');
    }
  };

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3"
    >
      <div className="w-full max-w-5xl rounded-2xl bg-slate-900 border border-slate-700 shadow-xl"
           onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div>
            <div className="text-white font-semibold">Conductores</div>
            <div className="text-xs text-slate-400">
              Empresa: <span className="text-slate-200">{companyName ?? `#${companyId}`}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:opacity-80" aria-label="Cerrar">
            <X className="h-5 w-5 text-slate-300" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Listado */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 flex items-center rounded-lg border border-slate-600 bg-slate-800 px-2">
                <Search className="h-4 w-4 text-slate-400 mr-1" />
                <input
                  className="w-full bg-transparent py-2 text-white outline-none placeholder-slate-400"
                  placeholder="Buscar por nombre, DNI o placa…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <button
                onClick={startCreate}
                className="inline-flex items-center gap-1 rounded-lg bg-green-500 hover:bg-green-600 text-white px-3 py-2 text-sm"
              >
                <Plus className="h-4 w-4" />
                Nuevo
              </button>
            </div>

            <div className="rounded-lg border border-slate-700 overflow-hidden">
              <div className="grid grid-cols-12 bg-slate-800/60 text-slate-300 text-xs font-semibold px-3 py-2">
                <div className="col-span-6">Nombre</div>
                <div className="col-span-3">DNI</div>
                <div className="col-span-2">Placa</div>
                <div className="col-span-1 text-right">Acciones</div>
              </div>

              <div className="max-h-[52vh] overflow-auto divide-y divide-slate-800">
                {loading ? (
                  <div className="flex items-center gap-2 p-3 text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="p-3 text-slate-400 text-sm">Sin registros.</div>
                ) : (
                  filtered.map((d) => (
                    <div key={d.driver_id} className="grid grid-cols-12 items-center px-3 py-2">
                      <div className="col-span-6 text-slate-200">{d.full_name}</div>
                      <div className="col-span-3 text-slate-300">{d.dni ?? '—'}</div>
                      <div className="col-span-2 text-slate-300">{d.plate ?? '—'}</div>
                      <div className="col-span-1 flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(d)}
                          className="p-1.5 rounded-md border border-slate-600 text-slate-200 hover:bg-slate-700"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(d)}
                          className="p-1.5 rounded-md border border-slate-600 text-red-300 hover:bg-red-500/10"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={submit} className="rounded-xl border border-slate-700 p-3 bg-slate-800/30">
            <div className="text-slate-200 font-medium mb-2">
              {editingId ? 'Editar conductor' : 'Nuevo conductor'}
            </div>

            <label className="block mb-2 text-sm">
              <span className="text-slate-300">Nombre completo</span>
              <input
                className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-green-500"
                value={form.full_name}
                onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
                required
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="text-slate-300">DNI</span>
                <input
                  className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-green-500"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={8}
                  value={form.dni ?? ''}
                  onChange={(e) => onDniChange(e.target.value)}
                  placeholder="8 dígitos"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-300">Placa</span>
                <input
                  className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-green-500"
                  value={form.plate ?? ''}
                  onChange={(e) => onPlateChange(e.target.value)}
                  maxLength={8}
                  placeholder="Ej. ABC-123"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-300">Celular</span>
                <input
                  className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-green-500"
                  value={form.phone ?? ''}
                  onChange={(e) => onPhoneChange(e.target.value)}
                  maxLength={15}
                  placeholder="+51 999999999"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-300">Notas</span>
                <input
                  className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-green-500"
                  value={form.notes ?? ''}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Observaciones opcionales"
                />
              </label>
            </div>

            {error && <div className="text-sm text-red-400 mt-2">{error}</div>}

            <div className="flex gap-2 justify-end mt-3">
              {editingId && (
                <button
                  type="button"
                  onClick={clearForm}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200"
                >
                  Nuevo
                </button>
              )}
              <button
                type="submit"
                disabled={processing}
                className="rounded-lg bg-green-500 hover:bg-green-600 text-white px-4 py-2 text-sm disabled:opacity-50"
              >
                {processing ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
