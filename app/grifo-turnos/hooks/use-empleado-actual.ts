'use client';
import { useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import UserService from './../../../src/services/userService';
import { getAuthToken } from '../../grifo-turnos/turnos/auth';

export const useEmpleadoActual = () => {
  const [empleadoActual, setEmpleadoActual] = useState<any>(null);
  const [empleados, setEmpleados] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const token = getAuthToken();
        if (!token) {
          setEmpleadoActual({ full_name: 'Operador', username: 'operador', user_id: 1 });
          return;
        }
        const decoded: any = jwtDecode(token);
        const userId = decoded.user_id || decoded.sub;

        let currentUser: any | null = null;
        try { if (userId != null) currentUser = await UserService.getById(Number(userId)); } catch {}
        if (!currentUser) {
          currentUser = {
            user_id: userId ?? 0,
            username: decoded?.username ?? '@usuario',
            full_name: decoded?.full_name ?? decoded?.name ?? decoded?.username ?? 'Operador',
          };
        }
        setEmpleadoActual(currentUser);
      } catch {
        setEmpleadoActual({ full_name: 'Operador', username: 'operador', user_id: 1 });
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = getAuthToken();
        if (!token) {
          setEmpleados([
            { full_name: 'Operador 1', user_id: 1 },
            { full_name: 'Operador 2', user_id: 2 },
            { full_name: 'Operador 3', user_id: 3 },
          ]);
          return;
        }
        const usuarios = await UserService.getUsersByRole('seller');
        setEmpleados(
          usuarios.length
            ? usuarios
            : [
                { full_name: 'Operador 1', user_id: 1 },
                { full_name: 'Operador 2', user_id: 2 },
                { full_name: 'Operador 3', user_id: 3 },
              ]
        );
      } catch {
        setEmpleados([
          { full_name: 'Operador 1', user_id: 1 },
          { full_name: 'Operador 2', user_id: 2 },
          { full_name: 'Operador 3', user_id: 3 },
        ]);
      }
    })();
  }, []);

  return { empleadoActual, empleados };
};
