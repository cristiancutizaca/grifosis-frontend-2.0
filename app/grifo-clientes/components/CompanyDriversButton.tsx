'use client';

import React, { useState } from 'react';
import { Users } from 'lucide-react';
import CompanyDriversModal from './CompanyDriversModal';

type Props = {
  companyId: number;
  companyName?: string | null;
  disabled?: boolean;
};

export default function CompanyDriversButton({ companyId, companyName, disabled }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        title="Ver conductores"
      >
        <Users className="h-4 w-4" />
        Conductores
      </button>

      <CompanyDriversModal
        open={open}
        onClose={() => setOpen(false)}
        companyId={companyId}
        companyName={companyName}
      />
    </>
  );
}
