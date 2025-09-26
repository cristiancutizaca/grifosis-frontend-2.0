import React, { memo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiLock } from "react-icons/fi"; // Asegúrate de instalar react-icons si no lo has hecho

// Definición de los enlaces de navegación
const links = [
  { name: "Inicio", href: "/" },
  { name: "Diplomados", href: "/diplomados" },
  { name: "Certificados", href: "/certs" },
  { name: "Cursos", href: "/curs", isBlocked: true }, // Añadir un flag isBlocked
  { name: "Nuestras Redes", href: "/#footer" },
];

// Componente optimizado con memo
const NavLinks = () => {
  const pathname = usePathname();
  const [isCourseBlocked, setIsCourseBlocked] = useState(true); // Estado para bloquear el enlace de cursos

  return (
    <React.Fragment>
      {links.map((link) => {
        const isActive = pathname === link.href;

        return (
          <div key={link.name} className="relative">
            {link.isBlocked && isCourseBlocked ? ( // Verifica si el enlace está bloqueado
              <span className="flex items-center">
                <FiLock className="mr-1 text-gray-500" /> {/* Ícono de bloqueo */}
                <p className="text-lg text-gray-500 cursor-not-allowed">
                  {link.name}
                </p>
              </span>
            ) : (
              <Link
                href={link.href}
                className={`text-lg text-blackblue hover:underline hover:text-primaryblue dark:hover:text-blue-100 ${
                  isActive ? "underline text-primaryblue dark:text-blue-100 " : "dark:text-white"
                }`}
              >
                <p className="hidden md:block">{link.name}</p>
              </Link>
            )}
          </div>
        );
      })}
    </React.Fragment>
  );
};

// Exportación con memo para evitar re-renders innecesarios
export default memo(NavLinks);
