
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  MessageCircle,
  Brain,
  Settings,
  Wrench,
  LogOut
} from "lucide-react";

export default function ProtectedLayout() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("joi_token");
    navigate("/");
  }

  const navItems = [
    { name: "Chat", path: "/chat", icon: MessageCircle },
    { name: "Memory Bank", path: "/memory", icon: Brain },
    { name: "Settings", path: "/settings", icon: Settings },
    { name: "Tools", path: "/tools", icon: Wrench }
  ];

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <h2 className="app-logo">
          JOI<span>.</span>
        </h2>

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
                <Icon size={19} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <button className="app-logout" onClick={logout}>
          <LogOut size={19} />
          <span>Logout</span>
        </button>
      </aside>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
