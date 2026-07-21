import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { ThemeProvider as StyledThemeProvider } from "styled-components";

import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { ProjectProvider } from "./context/ProjectContext";

import GlobalStyle from "./styles/global";
import { lightTheme, darkTheme } from "./styles/theme";

import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import PageLoader from "./components/PageLoader";

// Carregadas sob demanda: reduzem o bundle inicial, já que só são
// necessárias depois do login (ou da navegação para /registro).
const Registro = lazy(() => import("./pages/Registro"));
const EsqueciSenha = lazy(() => import("./pages/EsqueciSenha"));
const RedefinirSenha = lazy(() => import("./pages/RedefinirSenha"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Projetos = lazy(() => import("./pages/Projetos"));
const Tarefas = lazy(() => import("./pages/Tarefas"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));

// Componente interno para acessar o ThemeContext
function ThemedApp() {
  const { dark } = useTheme();

  return (
    <StyledThemeProvider theme={dark ? darkTheme : lightTheme}>
      <GlobalStyle />

      <ToastProvider>
        <ProjectProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/registro" element={<Registro />} />
              <Route path="/esqueci-senha" element={<EsqueciSenha />} />
              <Route path="/redefinir-senha" element={<RedefinirSenha />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/projetos"
                element={
                  <ProtectedRoute>
                    <Projetos />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/tarefas"
                element={
                  <ProtectedRoute>
                    <Tarefas />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/perfil"
                element={
                  <ProtectedRoute>
                    <Perfil />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/configuracoes"
                element={
                  <ProtectedRoute>
                    <Configuracoes />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </ProjectProvider>
      </ToastProvider>
    </StyledThemeProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedApp />
      </AuthProvider>
    </ThemeProvider>
  );
}