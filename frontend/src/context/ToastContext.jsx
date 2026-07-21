/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useCallback, useRef, useState } from "react";
import { FiCheckCircle, FiXCircle, FiInfo } from "react-icons/fi";
import { ToastViewport, ToastItem, ToastMensagem } from "../styles/ToastStyles";

const ToastContext = createContext(null);

const ICONE_POR_TIPO = {
  sucesso: FiCheckCircle,
  erro: FiXCircle,
  info: FiInfo,
};

const DURACAO_PADRAO = 4000;

let proximoId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  // Guarda os timers de auto-remoção para poder cancelá-los se o
  // usuário fechar o toast manualmente antes do tempo.
  const timers = useRef({});

  const removerToast = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (mensagem, tipo = "info", duracao = DURACAO_PADRAO) => {
      const id = proximoId++;
      setToasts((prev) => [...prev, { id, mensagem, tipo }]);
      timers.current[id] = setTimeout(() => removerToast(id), duracao);
    },
    [removerToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <ToastViewport>
        {toasts.map((toast) => {
          const Icone = ICONE_POR_TIPO[toast.tipo] || FiInfo;
          return (
            <ToastItem
              key={toast.id}
              $tipo={toast.tipo}
              onClick={() => removerToast(toast.id)}
              role="alert"
              title="Clique para dispensar"
            >
              <Icone size={18} />
              <ToastMensagem>{toast.mensagem}</ToastMensagem>
            </ToastItem>
          );
        })}
      </ToastViewport>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de ToastProvider");
  return ctx;
}