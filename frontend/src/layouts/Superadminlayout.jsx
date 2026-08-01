import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  LogOut,
  Users,
} from "lucide-react";
import vnlLogo from "../assets/VNL_logo.webp";
import "./Superadminlayout.css";

const getUser = () => {
  try {
    return JSON.parse(
      sessionStorage.getItem("user") ||
        localStorage.getItem("user") ||
        "{}"
    );
  } catch {
    return {};
  }
};

const SuperadminLayout = () => {
  const navigate = useNavigate();
  const user = getUser();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const logout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login", { replace: true });
  };

  const initials =
    user?.full_name
      ?.split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SA";

  return (
    <div
      className={`sa-shell ${
        sidebarCollapsed ? "sa-sidebar-collapsed" : ""
      }`}
    >
      <aside className="sa-sidebar">
        <button
          type="button"
          className="sa-sidebar-toggle"
          onClick={() => setSidebarCollapsed((previous) => !previous)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <ChevronRight size={18} />
          ) : (
            <ChevronLeft size={18} />
          )}
        </button>

        <div className="sa-logo-wrap">
          <img
            src={vnlLogo}
            alt="Valencia Nutrition"
            className="sa-logo-img"
          />
        </div>

        <nav className="sa-nav">
          <NavLink to="/superadmin/overview" title="Overview">
            <BarChart3 />
            <span>Overview</span>
          </NavLink>

          <NavLink to="/superadmin/projects" title="Projects">
            <FolderKanban />
            <span>Projects</span>
          </NavLink>

          <NavLink to="/superadmin/tasks" title="Tasks">
            <ClipboardList />
            <span>Tasks</span>
          </NavLink>

          <NavLink to="/superadmin/users" title="Users">
            <Users />
            <span>Users</span>
          </NavLink>
        </nav>

        <div className="sa-sidebar-bottom">
          <div className="sa-user-card">
            <div className="sa-user-avatar">{initials}</div>

            <div className="sa-user-info">
              <strong>{user?.full_name || "Superadmin"}</strong>
              <p>{user?.email || "-"}</p>
              <span>{user?.role_name || "superadmin"}</span>
            </div>
          </div>

          <button type="button" className="sa-logout-btn" onClick={logout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="sa-main">
        <Outlet />
      </main>
    </div>
  );
};

export default SuperadminLayout;