'use client';

import { useRouter } from 'next/navigation';
import React from 'react';

type Props = {
  current: 'user' | 'client';
  userHref: string;   // ruta de la vista de usuarios (ej. "/grifo-reportes")
  clientHref: string; // ruta de la vista de clientes (ej. "/grifo-reportes/clients")
};

export default function ReportModeToggle({ current, userHref, clientHref }: Props) {
  const router = useRouter();

  return (
    <div className="inline-flex rounded-xl bg-white/10 p-1">
      <button
        type="button"
        className={`px-3 py-1 rounded-lg text-sm transition ${
          current === 'user' ? 'bg-white text-slate-900' : 'text-white/80 hover:text-white'
        }`}
        onClick={() => router.push(userHref)}
      >
        Usuarios
      </button>
      <button
        type="button"
        className={`ml-1 px-3 py-1 rounded-lg text-sm transition ${
          current === 'client' ? 'bg-white text-slate-900' : 'text-white/80 hover:text-white'
        }`}
        onClick={() => router.push(clientHref)}
      >
        Clientes
      </button>
    </div>
  );
}
