import React from "react";

type ButtonProps = {
    children: React.ReactNode;
    onClick?: () => void;
    type?: "button" | "submit" | "reset";
    className?: string;
    disabled?: boolean;
};

const SaveButton: React.FC<ButtonProps> = ({
    children,
    onClick,
    type = "button",
    className = "",
    disabled = false,
    }) => {
    return (
        <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 text-sm lg:text-base ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
        >
        {children}
        </button>
    );
};

export default SaveButton;
