import { useEffect, useRef, useState } from "react";
import {
  CalendarCheck,
  Download,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import api from "../../api/axios";
import LeaveApplicationButton from "../../components/LeaveApplicationButton";
import "./administratorAttendance.css";

const AdministratorAttendance = () => {
  const fileInputRef = useRef(null);

  const [myAttendance, setMyAttendance] = useState(null);
  const [overallAttendance, setOverallAttendance] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await api.get("/administrator/attendance");

      setMyAttendance(response.data.my_attendance);
      setOverallAttendance(response.data.overall_attendance || []);
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to load attendance."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  const getNumber = (...values) => {
    for (const value of values) {
      const number = Number(value);

      if (!Number.isNaN(number)) {
        return number;
      }
    }

    return 0;
  };

  const getMyAttendancePercentage = () => {
    return getNumber(
      myAttendance?.attendance_percentage,
      myAttendance?.percentage
    );
  };

  const getMyHalfDays = () => {
    return getNumber(
      myAttendance?.half_days,
      myAttendance?.half_day_days
    );
  };

  const getEmployeeAttendancePercentage = (employee) => {
    return getNumber(
      employee.attendance_percentage,
      employee.percentage
    );
  };

  const getEmployeeTotalDays = (employee) => {
    return getNumber(
      employee.total_marked_days,
      employee.total_days
    );
  };

  const getEmployeeHalfDays = (employee) => {
    return getNumber(
      employee.half_days,
      employee.half_day_days
    );
  };

  const filteredAttendance = overallAttendance.filter((employee) => {
    const value = search.toLowerCase();

    return (
      employee.full_name?.toLowerCase().includes(value) ||
      employee.email?.toLowerCase().includes(value) ||
      employee.employee_code?.toLowerCase().includes(value) ||
      employee.designation?.toLowerCase().includes(value) ||
      employee.department_name?.toLowerCase().includes(value)
    );
  });

  const totalEmployees = overallAttendance.length;

  const averageAttendance =
    totalEmployees > 0
      ? Math.round(
          overallAttendance.reduce(
            (sum, employee) =>
              sum + getEmployeeAttendancePercentage(employee),
            0
          ) / totalEmployees
        )
      : 0;

  const employeesWithAttendance = overallAttendance.filter(
    (employee) => getEmployeeTotalDays(employee) > 0
  ).length;

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const importAttendance = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setImporting(true);
      setMessage("");

      const response = await api.post(
        "/administrator/attendance/import",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const importedRows =
        response.data.importedRows ||
        response.data.imported_rows ||
        response.data.inserted_rows ||
        0;

      const updatedRows =
        response.data.updatedRows ||
        response.data.updated_rows ||
        0;

      const skippedRows =
        response.data.skippedRows ||
        response.data.skipped_rows ||
        0;

      const unmatchedRows =
        response.data.unmatchedRows ||
        response.data.unmatched_rows ||
        response.data.missing_users ||
        0;

      setMessage(
        `${response.data.message} Imported: ${importedRows}, Updated: ${updatedRows}, Skipped: ${skippedRows}, Unmatched/Missing Users: ${unmatchedRows}`
      );

      fetchAttendance();
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to import attendance."
      );
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const exportAttendanceCsv = () => {
    const headers = [
      "employee_code",
      "full_name",
      "email",
      "designation",
      "department_name",
      "attendance_percentage",
      "total_days",
      "present_days",
      "absent_days",
      "half_day_days",
      "leave_days",
      "holiday_days",
      "total_minutes",
    ];

    const rows = filteredAttendance.map((employee) => {
      const normalizedEmployee = {
        ...employee,
        attendance_percentage:
          getEmployeeAttendancePercentage(employee),
        total_days: getEmployeeTotalDays(employee),
        half_day_days: getEmployeeHalfDays(employee),
      };

      return headers
        .map((header) => {
          const value = normalizedEmployee[header] || "";
          const stringValue = String(value);

          if (
            stringValue.includes(",") ||
            stringValue.includes('"') ||
            stringValue.includes("\n")
          ) {
            return `"${stringValue.replaceAll('"', '""')}"`;
          }

          return stringValue;
        })
        .join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.setAttribute(
      "download",
      "valencia-rms-attendance.csv"
    );

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  };

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="attendance-page">
      <div className="administrator-attendance-header">
        <div className="administrator-attendance-heading">
          <h1>Attendance</h1>

          <p>
            View Jay More&apos;s attendance and overall employee
            attendance.
          </p>
        </div>

        <div className="administrator-attendance-actions">
          <button
            type="button"
            className="administrator-attendance-action-btn"
            onClick={fetchAttendance}
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="administrator-attendance-action-btn"
            onClick={exportAttendanceCsv}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            className="administrator-attendance-action-btn"
            onClick={handleImportClick}
            disabled={importing}
          >
            <Upload size={14} />

            <span>
              {importing
                ? "Importing..."
                : "Import Attendance"}
            </span>
          </button>

          <div className="administrator-attendance-leave-btn">
            <LeaveApplicationButton />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={importAttendance}
          />
        </div>
      </div>

      {message && (
        <div className="projects-message">
          {message}
        </div>
      )}

      {loading ? (
        <div className="page-loader">
          Loading attendance...
        </div>
      ) : (
        <>
          <section className="my-attendance-card">

  <div className="my-attendance-info">

    <h2>
      Jay More
    </h2>


    <p>
      Your attendance percentage based on marked
      working days.
    </p>



    <div className="attendance-mini-grid">


      <div>

        <strong>
          {myAttendance?.present_days || 0}
        </strong>

        <span>
          Present
        </span>

      </div>



      <div>

        <strong>
          {myAttendance?.absent_days || 0}
        </strong>

        <span>
          Absent
        </span>

      </div>




      <div>

        <strong>
          {getMyHalfDays()}
        </strong>

        <span>
          Half Day
        </span>

      </div>




      <div>

        <strong>
          {myAttendance?.leave_days || 0}
        </strong>

        <span>
          Leave
        </span>

      </div>



    </div>


  </div>


</section>

          <section className="overall-attendance-section">
            <div className="section-title-row">
              <div>
                <h2>Overall Attendance</h2>

                <p>
                  Every employee and their attendance
                  percentage.
                </p>
              </div>
            </div>

            <div className="attendance-overall-summary">
              <div>
                <span>Total Employees</span>
                <strong>{totalEmployees}</strong>
              </div>

              <div>
                <span>Average Attendance</span>
                <strong>
                  {averageAttendance}%
                </strong>
              </div>

              <div>
                <span>
                  Employees With Attendance
                </span>

                <strong>
                  {employeesWithAttendance}
                </strong>
              </div>

              <div>
                <span>Visible Records</span>
                <strong>
                  {filteredAttendance.length}
                </strong>
              </div>
            </div>

            <div className="projects-toolbar">
              <div className="projects-search">
                <Search size={16} />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search employee, email, department, designation..."
                />
              </div>
            </div>

            <div className="administrator-attendance-table-card">
              <table className="administrator-attendance-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Attendance %</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Half Day</th>
                    <th>Leave</th>
                    <th>Total Days</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAttendance.length > 0 ? (
                    filteredAttendance.map((employee) => {
                      const attendancePercentage =
                        getEmployeeAttendancePercentage(
                          employee
                        );

                      return (
                        <tr key={employee.user_id}>
                          <td>
                            <div className="user-name-cell">
                              <div className="user-avatar-small">
                                <CalendarCheck size={16} />
                              </div>

                              <div>
                                <strong>
                                  {employee.full_name}
                                </strong>

                                <p>
                                  {employee.email}
                                </p>

                                <p>
                                  {employee.employee_code ||
                                    "-"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td>
                            {employee.department_name ||
                              "-"}
                          </td>

                          <td>
                            {employee.designation || "-"}
                          </td>

                          <td>
                            <div className="attendance-percent-cell">
                              <div className="table-progress-track">
                                <div
                                  className="table-progress-fill"
                                  style={{
                                    width: `${attendancePercentage}%`,
                                  }}
                                />
                              </div>

                              <strong>
                                {attendancePercentage}%
                              </strong>
                            </div>
                          </td>

                          <td>
                            {employee.present_days || 0}
                          </td>

                          <td>
                            {employee.absent_days || 0}
                          </td>

                          <td>
                            {getEmployeeHalfDays(
                              employee
                            )}
                          </td>

                          <td>
                            {employee.leave_days || 0}
                          </td>

                          <td>
                            {getEmployeeTotalDays(
                              employee
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan="9"
                        className="empty-projects"
                      >
                        No attendance found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="recent-attendance-card">
            <div className="section-title-row">
              <div>
                <h2>My Recent Attendance</h2>

                <p>
                  Latest 15 attendance records for Jay More.
                </p>
              </div>
            </div>

            <div className="recent-attendance-list">
              {myAttendance?.recent_attendance?.length >
              0 ? (
                myAttendance.recent_attendance.map(
                  (item) => (
                    <div
                      className="recent-attendance-row"
                      key={item.attendance_id}
                    >
                      <div>
                        <strong>
                          {formatDate(
                            item.attendance_date
                          )}
                        </strong>

                        <p>
                          {item.remarks ||
                            "No remarks"}
                        </p>
                      </div>

                      <span
                        className={`attendance-status-badge ${item.status}`}
                      >
                        {item.status?.replaceAll(
                          "_",
                          " "
                        )}
                      </span>
                    </div>
                  )
                )
              ) : (
                <div className="empty-projects">
                  No attendance marked yet.
                </div>
              )}
            </div>
          </section>

          <div className="csv-help-card">
            <h3>Attendance Import Format</h3>

            <p>
              Import only the approved Excel/CSV attendance
              sheet from Administrator Dashboard. Attendance
              is matched with users using Employee ID /
              Employee Code.
            </p>

            <p className="csv-note">
              Allowed status values: present, absent,
              half_day, leave, holiday. If status is late, it
              will be treated as present.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default AdministratorAttendance;