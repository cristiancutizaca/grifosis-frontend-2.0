'use client';
import { useEffect, useMemo, useState } from 'react';
import type { ShiftHours, ShiftName } from '../../grifo-turnos/turnos/shifts';
import { resolveShiftName, getShiftRange, toLocalYMD } from '../../grifo-turnos/turnos/shifts';

export const useActiveShift = (hours: ShiftHours) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(id); }, []);
  const turnoActivo = useMemo<ShiftName>(() => resolveShiftName(hours, now), [hours, now]);
  const { from, to } = useMemo(() => getShiftRange(hours, turnoActivo, now), [hours, turnoActivo, now]);
  const storageDay = useMemo(() => toLocalYMD(from), [from]);

  return { now, setNow, turnoActivo, from, to, storageDay };
};
