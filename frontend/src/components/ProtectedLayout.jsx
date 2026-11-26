
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  MessageCircle,
  Brain,
  Settings,
  Wrench,
  LogOut,
  Flame,
} from "lucide-react";

export default function ProtectedLayout() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("joi_token");
    navigate("/", { replace: true });
  }

  const navItems = [
    { name: "Chat", path: "/chat", icon: MessageCircle },
    { name: "Memory Bank", path: "/memory", icon: Brain },
    { name: "Settings", path: "/settings", icon: Settings },
    { name: "Tools", path: "/tools", icon: Wrench },
  ];

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Flame size={21} />
          </div>

          <div className="brand-text">
            <h2 className="app-logo">
              JOI<span>.</span>
            </h2>
            <p>AI COMPANION</p>
          </div>
        </div>

        <div className="sidebar-divider" />

        <p className="nav-heading">WORKSPACE</p>

        <nav className="app-navigation">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="status-indicator" />
            <span>JOI is ready</span>
          </div>

          <button className="app-logout" onClick={logout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
