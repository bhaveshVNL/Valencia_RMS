import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  Filter,
  FolderKanban,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../../api/axios";
import "./administratorReports.css";

const COLORS = [
  "#ff5733",
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
];

const INITIAL_FILTERS = {
  from_date: "",
  to_date: "",
  department_id: "",
  user_id: "",
  project_id: "",
  project_status: "",
  task_status: "",
};

const formatStatus = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const AdministratorReports = () => {
  const [reports, setReports] = useState(null);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const fetchReports = async (nextFilters = appliedFilters) => {
    try {
      setLoading(true);
      setMessage("");

      const params = Object.fromEntries(
        Object.entries(nextFilters).filter(([, value]) => value !== "")
      );

      const response = await api.get("/administrator/reports", { params });
      setReports(response.data || {});
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Failed to load reports."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(INITIAL_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => {
    setAppliedFilters(filters);
    fetchReports(filters);
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    fetchReports(INITIAL_FILTERS);
  };

  const filterOptions = reports?.filters || {};
  const summary = reports?.summary || {};

  const employeeData = useMemo(
    () =>
      [...(reports?.employee_analysis || [])]
        .filter((item) => item.name)
        .slice(0, 12),
    [reports]
  );

  const departmentData = useMemo(
    () =>
      [...(reports?.department_analysis || [])].filter(
        (item) => item.name
      ),
    [reports]
  );

  const projectProgressData = useMemo(
    () => [...(reports?.project_progress || [])].slice(0, 15),
    [reports]
  );

  const summaryCards = [
    {
      title: "Total Employees",
      value: summary.total_employees || 0,
      note: "Employees in selected scope",
      icon: Users,
    },
    {
      title: "Total Admins",
      value: summary.total_admins || 0,
      note: "Department administrators",
      icon: UserCog,
    },
    {
      title: "Total Projects",
      value: summary.total_projects || 0,
      note: `${summary.completed_projects || 0} completed`,
      icon: FolderKanban,
    },
    {
      title: "Total Tasks",
      value: summary.total_tasks || 0,
      note: `${summary.completed_tasks || 0} completed`,
      icon: ClipboardList,
    },
    {
      title: "Overall Progress",
      value: `${summary.overall_progress || 0}%`,
      note: "Projects and tasks combined",
      icon: TrendingUp,
    },
    {
      title: "Attention Required",
      value:
        Number(summary.blocked_tasks || 0) +
        Number(summary.overdue_tasks || 0) +
        Number(summary.under_review_projects || 0),
      note: "Blocked, overdue and review items",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="administrator-reports-page">
   <div className="administrator-reports-header">
  <div className="administrator-reports-heading">
    <h1>Reports</h1>

    <p>
      Company-wide analysis of all departments, users, admins,
      projects and tasks.
    </p>
  </div>

  <button
    type="button"
    className="administrator-reports-refresh"
    onClick={() => fetchReports(appliedFilters)}
    disabled={loading}
  >
    <RefreshCw
      size={14}
      className={loading ? "spinning" : ""}
    />

    <span>Refresh</span>
  </button>
</div>

      <section className="administrator-report-filter-card">
        <div className="administrator-report-filter-title">
          <Filter size={18} />
          <div>
            <h2>Report Filters</h2>
            <p>Customise the complete report using any combination.</p>
          </div>
        </div>

        <div className="administrator-report-filter-grid">
          <label>
            <span>From Date</span>
            <input
              type="date"
              value={filters.from_date}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  from_date: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>To Date</span>
            <input
              type="date"
              value={filters.to_date}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  to_date: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>Department</span>
            <select
              value={filters.department_id}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  department_id: event.target.value,
                  user_id: "",
                  project_id: "",
                }))
              }
            >
              <option value="">All Departments</option>
              {(filterOptions.departments || []).map((department) => (
                <option
                  key={department.department_id}
                  value={department.department_id}
                >
                  {department.department_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Employee / Admin</span>
            <select
              value={filters.user_id}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  user_id: event.target.value,
                }))
              }
            >
              <option value="">All Employees and Admins</option>
              {(filterOptions.users || [])
                .filter(
                  (user) =>
                    !filters.department_id ||
                    String(user.department_id) ===
                      String(filters.department_id)
                )
                .map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.full_name} — {formatStatus(user.role_name)}
                  </option>
                ))}
            </select>
          </label>

          <label>
            <span>Project</span>
            <select
              value={filters.project_id}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  project_id: event.target.value,
                }))
              }
            >
              <option value="">All Projects</option>
              {(filterOptions.projects || [])
                .filter(
                  (project) =>
                    !filters.department_id ||
                    String(project.department_id) ===
                      String(filters.department_id)
                )
                .map((project) => (
                  <option
                    key={project.project_id}
                    value={project.project_id}
                  >
                    {project.project_title}
                  </option>
                ))}
            </select>
          </label>

          <label>
            <span>Project Status</span>
            <select
              value={filters.project_status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  project_status: event.target.value,
                }))
              }
            >
              <option value="">All Project Statuses</option>
              {(filterOptions.project_statuses || []).map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Task Status</span>
            <select
              value={filters.task_status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  task_status: event.target.value,
                }))
              }
            >
              <option value="">All Task Statuses</option>
              {(filterOptions.task_statuses || []).map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </label>

          <div className="administrator-report-filter-actions">
            <button type="button" onClick={applyFilters}>
              <Filter size={15} />
              Apply Filters
            </button>

            <button
              type="button"
              className="reset"
              onClick={resetFilters}
            >
              <RotateCcw size={15} />
              Reset
            </button>
          </div>
        </div>
      </section>

      {message && (
        <div className="administrator-reports-message">{message}</div>
      )}

      {loading ? (
        <div className="administrator-reports-loader">
          Loading company-wide report analytics...
        </div>
      ) : (
        <>
          <section className="administrator-report-stat-grid">
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <article
                  className="administrator-report-stat-card"
                  key={card.title}
                >
                  <div className="administrator-report-stat-icon">
                    <Icon size={21} />
                  </div>

                  <div>
                    <p>{card.title}</p>
                    <h2>{card.value}</h2>
                    <span>{card.note}</span>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="administrator-report-overall-card">
            <div>
              <h2>Overall Company Progress</h2>
              <p>
                Average progress calculated from the filtered projects
                and tasks.
              </p>
            </div>

            <strong>{summary.overall_progress || 0}%</strong>

            <div className="administrator-report-progress-track">
              <div
                style={{
                  width: `${Math.min(
                    Number(summary.overall_progress || 0),
                    100
                  )}%`,
                }}
              />
            </div>

            <div className="administrator-report-progress-pairs">
              <span>
                Project Progress
                <strong>
                  {summary.average_project_progress || 0}%
                </strong>
              </span>

              <span>
                Task Progress
                <strong>{summary.average_task_progress || 0}%</strong>
              </span>
            </div>
          </section>

          <section className="administrator-report-two-column">
            <article className="administrator-report-chart-card">
              <h2>Project Status</h2>
              <p>All filtered projects grouped by workflow stage.</p>

              {(reports?.project_status || []).length ? (
                <ResponsiveContainer width="100%" height={330}>
                  <PieChart>
                    <Pie
                      data={reports.project_status}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={105}
                      paddingAngle={3}
                    >
                      {reports.project_status.map((item, index) => (
                        <Cell
                          key={item.name}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="administrator-report-empty">
                  No project data found.
                </div>
              )}
            </article>

            <article className="administrator-report-chart-card">
              <h2>Task Status</h2>
              <p>All filtered main tasks and subtasks by status.</p>

              {(reports?.task_status || []).length ? (
                <ResponsiveContainer width="100%" height={330}>
                  <PieChart>
                    <Pie
                      data={reports.task_status}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={105}
                      paddingAngle={3}
                    >
                      {reports.task_status.map((item, index) => (
                        <Cell
                          key={item.name}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="administrator-report-empty">
                  No task data found.
                </div>
              )}
            </article>
          </section>

          <section className="administrator-report-chart-card administrator-report-full">
            <h2>Project Progress Comparison</h2>
            <p>Progress of the highest-ranking filtered projects.</p>

            {projectProgressData.length ? (
              <ResponsiveContainer
                width="100%"
                height={Math.max(380, projectProgressData.length * 44)}
              >
                <BarChart
                  data={projectProgressData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={170}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, "Progress"]}
                  />
                  <Bar
                    dataKey="progress"
                    fill="#ff5733"
                    radius={[0, 8, 8, 0]}
                    barSize={19}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="administrator-report-empty">
                No project progress data found.
              </div>
            )}
          </section>

          <section className="administrator-report-two-column">
            <article className="administrator-report-chart-card">
              <h2>Department Workload</h2>
              <p>Total tasks across every department.</p>

              {departmentData.length ? (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(340, departmentData.length * 45)}
                >
                  <BarChart
                    data={departmentData}
                    layout="vertical"
                    margin={{ top: 10, right: 25, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                    />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="total_tasks"
                      name="Tasks"
                      fill="#2563eb"
                      radius={[0, 8, 8, 0]}
                      barSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="administrator-report-empty">
                  No department data found.
                </div>
              )}
            </article>

            <article className="administrator-report-chart-card">
              <h2>Department Project Progress</h2>
              <p>Average project progress by department.</p>

              {departmentData.length ? (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(340, departmentData.length * 45)}
                >
                  <BarChart
                    data={departmentData}
                    layout="vertical"
                    margin={{ top: 10, right: 25, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value) => [
                        `${value}%`,
                        "Average Progress",
                      ]}
                    />
                    <Bar
                      dataKey="average_project_progress"
                      fill="#16a34a"
                      radius={[0, 8, 8, 0]}
                      barSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="administrator-report-empty">
                  No department progress data found.
                </div>
              )}
            </article>
          </section>

          <section className="administrator-report-two-column">
            <article className="administrator-report-chart-card">
              <h2>Employee Task Workload</h2>
              <p>Assigned tasks for employees and admins.</p>

              {employeeData.length ? (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(350, employeeData.length * 44)}
                >
                  <BarChart
                    data={employeeData}
                    layout="vertical"
                    margin={{ top: 10, right: 25, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                    />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={125}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="total_tasks"
                      name="Assigned Tasks"
                      fill="#8b5cf6"
                      radius={[0, 8, 8, 0]}
                      barSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="administrator-report-empty">
                  No employee workload data found.
                </div>
              )}
            </article>

            <article className="administrator-report-chart-card">
              <h2>Employee Completion Rate</h2>
              <p>Completed tasks as a percentage of assigned tasks.</p>

              {employeeData.length ? (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(350, employeeData.length * 44)}
                >
                  <BarChart
                    data={employeeData}
                    layout="vertical"
                    margin={{ top: 10, right: 25, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={125}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value) => [
                        `${value}%`,
                        "Completion Rate",
                      ]}
                    />
                    <Bar
                      dataKey="completion_rate"
                      fill="#f59e0b"
                      radius={[0, 8, 8, 0]}
                      barSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="administrator-report-empty">
                  No employee completion data found.
                </div>
              )}
            </article>
          </section>

          <section className="administrator-report-attention">
            <div className="administrator-report-attention-heading">
              <AlertTriangle size={21} />
              <div>
                <h2>Attention Required</h2>
                <p>Items requiring administrator action.</p>
              </div>
            </div>

            <div className="administrator-report-attention-grid">
              <div>
                <span>Blocked Tasks</span>
                <strong>{summary.blocked_tasks || 0}</strong>
              </div>
              <div>
                <span>Overdue Tasks</span>
                <strong>{summary.overdue_tasks || 0}</strong>
              </div>
              <div>
                <span>Overdue Projects</span>
                <strong>{summary.overdue_projects || 0}</strong>
              </div>
              <div>
                <span>Under Review</span>
                <strong>{summary.under_review_projects || 0}</strong>
              </div>
              <div>
                <span>On Hold Projects</span>
                <strong>{summary.on_hold_projects || 0}</strong>
              </div>
              <div>
                <span>Unassigned Tasks</span>
                <strong>{summary.unassigned_tasks || 0}</strong>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default AdministratorReports;