import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { autenticado, emailVerified } = useAuth();
  const { pathname } = useLocation();

  if (!autenticado) return <Navigate to="/" replace />;
  if (!emailVerified && pathname !== "/confirme-seu-email") {
    return <Navigate to="/confirme-seu-email" replace />;
  }

  return children;
}
