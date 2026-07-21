/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(
    () => localStorage.getItem("theme") === "dark"
  );

  function toggleTheme() {
    setDark((prev) => {
      const proximo = !prev;
      localStorage.setItem("theme", proximo ? "dark" : "light");
      return proximo;
    });
  }

  return (
    <ThemeContext.Provider value={{ dark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  return ctx;
}