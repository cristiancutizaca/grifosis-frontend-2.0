import React from "react";

const ModalTable: React.FC<{
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ open, onClose, children }) => {
  const overlayClass = open
    ? "visible bg-black bg-opacity-50 backdrop-blur"
    : "invisible";
  const modalClass = open
    ? "scale-100 opacity-100 z-50"
    : "scale-110 opacity-0";
  const modalWidth = "max-w-screen-2xl";

  const handleClickOverlay = () => {
    console.log("Clic en el overlay");
    onClose();
  };

  const handleClickCloseButton = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Evita que el clic en el botón se propague al contenedor
    console.log("Clic en el botón de cierre");
    onClose();
  };

  return (
    <div
      className={`z-30 fixed inset-0 p-4 flex flex-col justify-center items-center transition-all ${overlayClass}`}
      onClick={handleClickOverlay}
    >
      <div
        className={`relative bg-blue-50 rounded-2xl shadow p-2 transition-all w-full sm:${modalWidth} ${
          open ? "" : "h-0 overflow-hidden"
        } ${modalClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl dark:text-blackblue font-bold">
          Participantes repetidos:
        </h2>
        <button
          className="absolute top-1 right-1 py-1 px-3 border border-red-400 rounded-lg text-red-400 bg-red-50 hover:bg-red-100 hover:text-red-700"
          onClick={handleClickCloseButton}
        >
          X
        </button>

        {children}
      </div>
    </div>
  );
};

export default ModalTable;
