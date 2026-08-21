import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderKanban,
  LogOut,
  User,
  Users,
} from "lucide-react";

import valenciaLogo from "../assets/VNL_logo.webp";
import "./Administratorlayout.css";

const getStoredUser = () => {
  try {
    return JSON.parse(
      sessionStorage.getItem("user") || localStorage.getItem("user") || "{}"
    );
  } catch {
    return {};
  }
};

const AdministratorLayout = () => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const user = getStoredUser();

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
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "JM";


  return (
    <div
      className={`admin-dashboard-shell ${
        sidebarCollapsed ? "sidebar-collapsed" : ""
      }`}
    >

      <aside className="admin-sidebar">


        <button
          type="button"
          className="admin-sidebar-toggle"
          onClick={() =>
            setSidebarCollapsed((previous) => !previous)
          }
          title={
            sidebarCollapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
        >

          {sidebarCollapsed ? (
            <ChevronRight size={22} />
          ) : (
            <ChevronLeft size={22} />
          )}

        </button>



        <div className="admin-brand">

          <img
            src={valenciaLogo}
            alt="Valencia Nutrition"
            className="admin-brand-logo-img"
          />

        </div>



        <nav className="admin-nav">


          <NavLink
            to="/administrator/overview"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
            title="Overview"
          >

            <BarChart3 size={20} />

            <span>
              Overview
            </span>

          </NavLink>




          <NavLink
            to="/administrator/projects"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
            title="Projects"
          >

            <FolderKanban size={20} />

            <span>
              Projects
            </span>

          </NavLink>




          <NavLink
            to="/administrator/tasks"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
            title="Tasks"
          >

            <ClipboardList size={20} />

            <span>
              Tasks
            </span>

          </NavLink>





          <NavLink
            to="/administrator/leave-applications"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
            title="Leave Applications"
          >

            <CalendarDays size={20} />

            <span>
              Leave Applications
            </span>

          </NavLink>





          <NavLink
            to="/administrator/attendance"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
            title="Attendance"
          >

            <CalendarCheck size={20} />

            <span>
              Attendance
            </span>

          </NavLink>





          <NavLink
            to="/administrator/reports"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
            title="Reports"
          >

            <FileText size={20} />

            <span>
              Reports
            </span>

          </NavLink>





          <NavLink
            to="/administrator/profile"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
            title="Profile"
          >

            <User size={20} />

            <span>
              Profile
            </span>

          </NavLink>





          <NavLink
            to="/administrator/users"
            className={({ isActive }) =>
              isActive ? "active" : ""
            }
            title="Users"
          >

            <Users size={20} />

            <span>
              Users
            </span>

          </NavLink>


        </nav>




        <div className="admin-sidebar-bottom">


          <div className="admin-user-card">


            <div className="admin-user-avatar">
              {initials}
            </div>



            <div className="admin-user-info">

              <strong>
                {user?.full_name || "Administrator"}
              </strong>

              <p>
                {user?.email || "-"}
              </p>

              <span>
                {user?.role_name || "administrator"}
              </span>

            </div>


          </div>





          <button
            type="button"
            className="admin-logout-btn"
            onClick={logout}
            title="Logout"
          >

            <LogOut size={18} />

            <span>
              Logout
            </span>


          </button>


        </div>


      </aside>




      <main className="admin-main">

        <Outlet />

      </main>


    </div>
  );
};


export default AdministratorLayout;