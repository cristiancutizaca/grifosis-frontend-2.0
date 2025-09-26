"use client";
import React, { memo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  FaFacebookF,
  FaInstagram,
  FaTiktok,
  FaWhatsapp,
  FaYoutube,
} from "react-icons/fa";
import { HiOutlineMail, HiOutlinePhone } from "react-icons/hi";
import { usePathname } from "next/navigation"; // 👈 importar hook

const Footer = () => {
  const pathname = usePathname(); // 👈 detectar ruta actual

  if (pathname === "/login") return null; // 👈 ocultar en /login

  return (
    <footer>
      {/* Tu contenido del footer aquí */}
    </footer>
  );
};

export default Footer;
