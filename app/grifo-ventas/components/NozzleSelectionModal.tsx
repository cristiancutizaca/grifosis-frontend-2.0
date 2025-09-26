import React from 'react';
import { Fuel } from 'lucide-react';
import Modal from '../../../src/components/Modal';

interface NozzleInGroup {
  nozzle_id: number;
  nozzle_number: number;
  estado?: string;
}

interface NozzleSelectionModalProps {
  open: boolean;
  onClose: () => void;
  nozzles: NozzleInGroup[];
  onSelect: (nozzleId: number) => void;
  selectedNozzleId: number | null;
}

const NozzleSelectionModal: React.FC<NozzleSelectionModalProps> = ({
  open,
  onClose,
  nozzles,
  onSelect,
  selectedNozzleId,
}) => {
  const Estado = ({ value }: { value?: string }) => {
    if (!value) return null;
    const v = value.toLowerCase();
    const cls =
      v.includes('act') || v.includes('disp')
        ? 'bg-emerald-600/90 text-white'
        : v.includes('manten') || v.includes('fuera')
        ? 'bg-rose-700/80 text-white'
        : v.includes('ocupa') || v.includes('uso')
        ? 'bg-amber-500/90 text-black'
        : 'bg-slate-600/70 text-white';
    return (
      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
        {value}
      </span>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Selecciona una boquilla"
      footer={
        <button
          onClick={onClose}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
        >
          Cerrar
        </button>
      }
    >
      {/* grid auto-fit con ancho mínimo para evitar recortes */}
      <div
        className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]"
        role="listbox"
        aria-label="Boquillas disponibles"
      >
        {nozzles.map((n) => {
          const selected = selectedNozzleId === n.nozzle_id;
          return (
            <button
              key={n.nozzle_id}
              onClick={() => onSelect(n.nozzle_id)}
              role="option"
              aria-selected={selected}
              title={`Boquilla ${n.nozzle_number}`}
              className={[
                'w-full rounded-2xl p-4 text-center transition-all',
                'border bg-slate-800/90',
                selected
                  ? 'border-amber-400 ring-2 ring-amber-300/40 shadow-lg'
                  : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800',
              ].join(' ')}
            >
              <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full bg-white/10 backdrop-blur-[2px]">
                <Fuel size={16} />
              </div>

              {/* SIN truncate, 2 líneas para que no se corte */}
              <div className="leading-tight">
                <div className="text-xs uppercase tracking-wide text-slate-300">
                  Boquilla
                </div>
                <div className="text-xl font-extrabold text-white">
                  {n.nozzle_number}
                </div>
              </div>

              {selected && (
                <div className="mt-2">
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">
                    Seleccionada
                  </span>
                </div>
              )}

              {/* Badge de estado si llega, ID oculto */}
              <Estado value={n.estado} />
            </button>
          );
        })}
      </div>
    </Modal>
  );
};

export default NozzleSelectionModal;
