// src/components/Modal.tsx
'use client';

import React from 'react';
import { X } from 'lucide-react';

type ModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClassName?: string; // por si quieres cambiar el ancho
};

const Modal: React.FC<ModalProps> = ({
  open,
  title,
  onClose,
  children,
  footer,
  widthClassName = 'max-w-md',
}) => {
  if (!open) return null;

  return (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Card */}
      <div
        className={`relative w-full ${widthClassName} rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <h3 className="text-base font-semibold">
            {title || 'Detalle'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-300 hover:bg-slate-800"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
