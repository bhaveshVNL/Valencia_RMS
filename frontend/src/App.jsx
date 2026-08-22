import { Navigate, Route, Routes } from "react-router-dom";

import LoginPage from "./pages/LoginPage";

import AdministratorLayout from "./layouts/Administratorlayout";
import AdministratorOverview from "./pages/administrator/administratorOverview";
import AdministratorProjects from "./pages/administrator/administratorProjects";
import AdministratorTasks from "./pages/administrator/administratorTasks";
import AdministratorReports from "./pages/administrator/administratorReports";
import AdministratorProfile from "./pages/administrator/administratorProfile";
import AdministratorUsers from "./pages/administrator/administratorUsers";
import AdministratorAttendance from "./pages/administrator/administratorAttendance";
import AdministratorLeaveApplications from "./pages/administrator/administratorLeaveApplications";

import EmployeeLayout from "./layouts/Employeelayout";
import EmployeeOverview from "./pages/employee/employeeOverview";
import EmployeeProjects from "./pages/employee/employeeProjects";
import EmployeeTasks from "./pages/employee/employeeTasks";
import EmployeeProfile from "./pages/employee/employeeProfile";
import EmployeeAttendance from "./pages/employee/employeeAttendance";
import EmployeeLeaveApplications from "./pages/employee/employeeLeaveApplications";

import AdminLayout from "./layouts/Adminlayout";
import AdminOverview from "./pages/admin/adminOverview";
import AdminProjects from "./pages/admin/adminProjects";
import AdminTasks from "./pages/admin/adminTasks";
import AdminCalendar from "./pages/admin/adminCalendar";
import AdminProfile from "./pages/admin/adminProfile";
import AdminUsers from "./pages/admin/adminUsers";
import AdminAttendance from "./pages/admin/adminAttendance";
import AdminLeaveApplications from "./pages/admin/adminLeaveApplications";

import SuperadminLayout from "./layouts/Superadminlayout";
import SuperadminOverview from "./pages/superadmin/superadminOverview";
import SuperadminUsers from "./pages/superadmin/superadminUsers";
import SuperadminTasks from "./pages/superadmin/superadminTasks";
import SuperadminProjects from "./pages/superadmin/superadminProjects";

const getStoredUser = () => {
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

const getDefaultRouteByRole = (roleName) => {
  if (roleName === "administrator") {
    return "/administrator/overview";
  }

  if (roleName === "superadmin") {
    return "/superadmin/overview";
  }

  if (roleName === "admin") {
    return "/admin/overview";
  }

  if (roleName === "employee") {
    return "/employee/overview";
  }

  return "/login";
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = sessionStorage.getItem("token");
  const user = getStoredUser();

  if (!token || !user?.role_name) {
    return <Navigate to="/login" replace />;
  }

  if (
    allowedRoles?.length &&
    !allowedRoles.includes(user.role_name)
  ) {
    return (
      <Navigate
        to={getDefaultRouteByRole(user.role_name)}
        replace
      />
    );
  }

  return children;
};

const App = () => {
  return (
    <Routes>
      {/* ================= LOGIN ================= */}

      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />

      <Route
        path="/login"
        element={<LoginPage />}
      />

      {/* ================= ADMINISTRATOR ================= */}

      <Route
        path="/administrator"
        element={
          <ProtectedRoute allowedRoles={["administrator"]}>
            <AdministratorLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <Navigate
              to="/administrator/overview"
              replace
            />
          }
        />

        <Route
          path="overview"
          element={<AdministratorOverview />}
        />

        <Route
          path="projects"
          element={<AdministratorProjects />}
        />

        <Route
          path="tasks"
          element={<AdministratorTasks />}
        />

        <Route
          path="leave-applications"
          element={<AdministratorLeaveApplications />}
        />

        <Route
          path="reports"
          element={<AdministratorReports />}
        />

        <Route
          path="profile"
          element={<AdministratorProfile />}
        />

        <Route
          path="users"
          element={<AdministratorUsers />}
        />

        <Route
          path="attendance"
          element={<AdministratorAttendance />}
        />
      </Route>

      {/* ================= EMPLOYEE ================= */}

      <Route
        path="/employee"
        element={
          <ProtectedRoute allowedRoles={["employee"]}>
            <EmployeeLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <Navigate
              to="/employee/overview"
              replace
            />
          }
        />

        <Route
          path="overview"
          element={<EmployeeOverview />}
        />

        <Route
          path="projects"
          element={<EmployeeProjects />}
        />

        <Route
          path="tasks"
          element={<EmployeeTasks />}
        />

        <Route
          path="profile"
          element={<EmployeeProfile />}
        />

        <Route
          path="attendance"
          element={<EmployeeAttendance />}
        />

        <Route
          path="leave-applications"
          element={<EmployeeLeaveApplications />}
        />
      </Route>

      {/* ================= ADMIN ================= */}

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <Navigate
              to="/admin/overview"
              replace
            />
          }
        />

        <Route
          path="overview"
          element={<AdminOverview />}
        />

        <Route
          path="projects"
          element={<AdminProjects />}
        />

        <Route
          path="tasks"
          element={<AdminTasks />}
        />

        <Route
          path="profile"
          element={<AdminProfile />}
        />

        <Route
          path="users"
          element={<AdminUsers />}
        />

        <Route
          path="attendance"
          element={<AdminAttendance />}
        />

        <Route
          path="leave-applications"
          element={<AdminLeaveApplications />}
        />

        <Route
          path="calendar"
          element={<AdminCalendar />}
        />
      </Route>

      {/* ================= SUPERADMIN ================= */}

      <Route
        path="/superadmin"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <SuperadminLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <Navigate
              to="/superadmin/overview"
              replace
            />
          }
        />

        <Route
          path="overview"
          element={<SuperadminOverview />}
        />

        <Route
          path="users"
          element={<SuperadminUsers />}
        />

        <Route
          path="tasks"
          element={<SuperadminTasks />}
        />

        <Route
          path="projects"
          element={<SuperadminProjects />}
        />
      </Route>

      {/* ================= FALLBACK ================= */}

      <Route
        path="*"
        element={
          <Navigate
            to={getDefaultRouteByRole(
              getStoredUser()?.role_name
            )}
            replace
          />
        }
      />
    </Routes>
  );
};

export default App;