"use client";
import Image from "next/image";
import React, { useState, memo } from "react";
import {
  Navbar,
  NavbarBrand,
  NavbarMenuToggle,
  NavbarMenuItem,
  NavbarMenu,
  NavbarContent,
  NavbarItem,
  Button,
} from "@nextui-org/react";
import Link from "next/link";
import { UserCircleIcon } from "@heroicons/react/solid";
import { IoPersonCircle } from "react-icons/io5";
import NavLinks from "./nav-links";

// Componente memoizado para evitar renderizados innecesarios
const Logo = memo(
  ({
    src,
    alt,
    width,
    height,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
  }) => (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority
      className="block"
    />
  )
);

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMenuItemClick = () => {
    setIsMenuOpen(false); // Cierra el menú al hacer clic en un elemento
  };

  const menuItems = [
    { name: "Inicio", href: "/" },
    { name: "Diplomados", href: "/diplomados" },
    { name: "Certificados", href: "/certs" },
    { name: "Contáctanos", href: "/#contacto" },
  ];

  return (
    <>
     <Navbar
        shouldHideOnScroll
        isMenuOpen={isMenuOpen}
        onMenuOpenChange={setIsMenuOpen}
        maxWidth="full"
        position="sticky"
        className="z-10 hidden md:flex bg-gradient-to-b from-blue-900 to-blue-600"
      >
        {/* Logo de la izquierda */}
        <Link href="/">
          <Logo
            src="/image/logo_inal_vert.png"
            alt="Logo Inalta"
            width={210}
            height={150}
          />
        </Link>

        {/* Botones de la derecha */}
        <NavbarContent justify="center">
          <NavbarItem>
            <Link href="/certs" passHref legacyBehavior>
              <Button className="bg-transparent border-white border-1 text-white hover:bg-blue-800 hover:border-blue-200 hover:scale-105">
                Ver Certificados
              </Button>
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Button
              target="_blank"
              as={Link}
              className="bg-transparent border-white border-1 text-white hover:bg-blue-800 hover:border-blue-200 hover:scale-105"
              href="https://site2.q10.com/login?ReturnUrl=%2F&aplentId=0959465f-37c3-4032-803b-bbfc499af7a3"
            >
              Aula Virtual
            </Button>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      {/* Navbar para pantallas pequeñas */}
      <Navbar
        isMenuOpen={isMenuOpen}
        onMenuOpenChange={setIsMenuOpen}
        className="z-20 bg-gradient-to-b from-blue-600 to-blue-400"
        position="sticky"
      >
        <NavbarContent className="sm:hidden w-full" justify="center">
          <NavbarMenuToggle
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          />
          <NavbarBrand>
            <div className="flex items-center justify-between w-full">
              <Link href="/">
                <Logo
                  src="/image/logo_inal_vert.png"
                  alt="Logo Inalta"
                  width={130}
                  height={150}
                />
              </Link>
              <div>
                <Link href="/certs">
                  <button className="bg-transparent border border-white text-white hover:bg-blue-800 hover:border-blue-200 hover:scale-105 mx-2 rounded-md">
                    Certificados
                  </button>
                </Link>
                <a
                  href="https://site2.q10.com/login?ReturnUrl=%2F&aplentId=0959465f-37c3-4032-803b-bbfc499af7a3"
                  target="_blank"
                >
                  <button className="bg-transparent border border-white text-white hover:bg-blue-800 hover:border-blue-200 hover:scale-105 mx-2 rounded-md">
                    Aula Virtual
                  </button>
                </a>
              </div>
            </div>
          </NavbarBrand>
        </NavbarContent>

        {/* Contenido de Navbar para pantallas grandes */}
        <NavbarContent className="hidden sm:flex gap-4" justify="end">
          {false && <NavLinks />}
          <NavbarContent justify="end">
            <Link href="/login">
              <IoPersonCircle className="text-white" size={30} />
            </Link>
          </NavbarContent>
        </NavbarContent>

        {/* Menú desplegable en móviles */}
        <NavbarMenu>
          {menuItems.map((link, index) => (
            <NavbarMenuItem key={index}>
              <Link
                href={link.href}
                onClick={handleMenuItemClick}
                className="w-full"
              >
                <button className="w-full bg-blue-500 text-white py-2 px-6 rounded">
                  {link.name}
                </button>
              </Link>
            </NavbarMenuItem>
          ))}
          {/* Botón de Login en el menú móvil */}
          <div className="flex justify-center w-full my-4">
            <Link href="/login">
              <UserCircleIcon
                width={40}
                height={40}
                onClick={handleMenuItemClick}
              />
            </Link>
          </div>
        </NavbarMenu>
      </Navbar>
    </>
  );
};  {/* Navbar para pantallas grandes */}
     

export default Header;
