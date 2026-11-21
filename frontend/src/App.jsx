
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import Auth from "./pages/Auth";
import Chat from "./pages/Chat";
import MemoryBank from "./pages/MemoryBank";
import Settings from "./pages/Settings";
import Tools from "./pages/Tools";
import ProtectedLayout from "./components/ProtectedLayout";

import "./App.css";

function ProtectedRoute({ children }) {
  return localStorage.getItem("joi_token")
    ? children
    : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} />

        <Route
          element={
            <ProtectedRoute>
              <ProtectedLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/chat" element={<Chat />} />
          <Route path="/memory" element={<MemoryBank />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/tools" element={<Tools />} />
        </Route>

        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
