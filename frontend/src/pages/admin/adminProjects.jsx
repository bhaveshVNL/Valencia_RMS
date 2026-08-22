import { useEffect, useMemo, useState } from "react";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Edit,
  Eye,
  FolderKanban,
  PauseCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import api from "../../api/axios";
import * as XLSX from "xlsx";
const PROJECT_DIVISIONS = [
  "POS",
  "NutraCare",
  "ADV",
  "Cans",
  "PET",
  "Crunzo",
  "Healthybites",
];

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  return [];
};

const getApiData = (response) => {
  return response?.data?.data || response?.data || {};
};

const normalizeDateForInput = (value) => {
  if (!value) return "";

  const stringValue = String(value);

  if (/^\d{4}-\d{2}-\d{2}/.test(stringValue)) {
    return stringValue.slice(0, 10);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalizeStatus = (status) => {
  const value = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (["todo", "to_do", "not_started", "pending"].includes(value)) return "to_do";
  if (["ongoing", "in_progress", "progress"].includes(value)) return "in_progress";
  if (["under_review", "review"].includes(value)) return "under_review";
  if (["completed", "done", "complete"].includes(value)) return "done";
  if (["rejected", "reject"].includes(value)) return "rejected";
  if (["on_hold", "hold"].includes(value)) return "on_hold";

  return "to_do";
};

const getStatusLabel = (status) => {
  const value = normalizeStatus(status);

  if (value === "to_do") return "To Do";
  if (value === "in_progress") return "In Progress";
  if (value === "under_review") return "Under Review";
  if (value === "done") return "Done";
  if (value === "rejected") return "Rejected";
  if (value === "on_hold") return "On Hold";

  return "To Do";
};

const canEditMainTasks = (status) => {
  const value = normalizeStatus(status);
  return value === "to_do" || value === "in_progress";
};

const getUserId = (user) => {
  return (
    user?.user_id ||
    user?.id ||
    user?.employee_id ||
    user?.assigned_to_user_id ||
    user?.assignee_id ||
    ""
  );
};

const getUserName = (user) => {
  return (
    user?.full_name ||
    user?.name ||
    user?.employee_name ||
    user?.assignee_name ||
    "-"
  );
};

const getUserEmail = (user) => {
  return user?.email || user?.employee_email || user?.assignee_email || "";
};

const getInitials = (name = "") => {
  const cleanName = String(name || "").trim();

  if (!cleanName) return "U";

  return cleanName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const dedupeUsers = (users) => {
  const map = new Map();

  asArray(users).forEach((user) => {
    const id = getUserId(user);
    const email = getUserEmail(user);
    const key = id || email;

    if (!key) return;

    if (!map.has(String(key))) {
      map.set(String(key), {
        ...user,
        user_id: id,
        full_name: getUserName(user),
        email,
        department_name: user.department_name || user.department || "-",
        designation: user.designation || "-",
      });
    }
  });

  return [...map.values()];
};

const normalizeProject = (project) => {
  const rawAssignees =
    project.assignees ||
    project.project_assignees ||
    project.assigned_users ||
    project.project_users ||
    project.users ||
    [];

  const rawMainTasks =
    project.main_tasks ||
    project.mainTasks ||
    project.tasks ||
    project.project_tasks ||
    [];

  const mainTasks = asArray(rawMainTasks).map((task) => {
    const taskAssignees =
      task.assignees ||
      task.task_assignees ||
      task.assigned_users ||
      task.users ||
      [];

    return {
      ...task,
      task_id: task.task_id || task.main_task_id || task.id,
      task_title:
        task.task_title || task.main_task_title || task.title || "Main Task",
      task_description:
        task.task_description ||
        task.description ||
        task.main_task_description ||
        "-",
      status: normalizeStatus(task.status || task.task_status),
      progress: Number(task.progress || task.task_progress || 0),
      start_date: normalizeDateForInput(
        task.start_date || task.task_start_date
      ),
      due_date: normalizeDateForInput(
        task.due_date || task.end_date || task.task_end_date
      ),
      end_date: normalizeDateForInput(
        task.due_date || task.end_date || task.task_end_date
      ),
      assignees: dedupeUsers(taskAssignees),
      completed_subtasks:
        task.completed_subtasks ||
        task.completedSubtasks ||
        task.done_subtasks ||
        0,
      total_subtasks:
        task.total_subtasks ||
        task.totalSubtasks ||
        task.subtask_count ||
        0,
    };
  });

  const assigneesFromTasks = mainTasks.flatMap((task) => task.assignees || []);
  const assignees = dedupeUsers([...asArray(rawAssignees), ...assigneesFromTasks]);

  const projectStatus = normalizeStatus(project.status || project.project_status);

  return {
    ...project,
    division:
  project.division ||
  project.project_division ||
  project.category ||
  "-",
    project_id: project.project_id || project.id,
    project_title:
      project.project_title ||
      project.title ||
      project.project_name ||
      "Untitled Project",
    project_description:
      project.project_description ||
      project.description ||
      project.project_details ||
      "-",
    start_date: normalizeDateForInput(
      project.start_date || project.project_start_date
    ),
    end_date: normalizeDateForInput(
      project.end_date || project.due_date || project.project_end_date
    ),
    status: projectStatus,
    overall_progress: Number(
      project.overall_progress ?? project.progress ?? project.project_progress ?? 0
    ),
    created_by_name:
      project.created_by_name ||
      project.created_by ||
      project.admin_name ||
      project.assigned_by_name ||
      "-",
    created_by_email:
      project.created_by_email ||
      project.admin_email ||
      project.assigned_by_email ||
      "",
    department_name: project.department_name || project.department || "-",
    assignees,
    main_tasks: mainTasks,
  };
};

const tryGet = async (urls) => {
  let lastError;

  for (const url of urls) {
    try {
      return await api.get(url);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const tryPost = async (urls, payload) => {
  let lastError;

  for (const url of urls) {
    try {
      return await api.post(url, payload);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const tryPut = async (urls, payload) => {
  let lastError;

  for (const url of urls) {
    try {
      return await api.put(url, payload);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const tryDelete = async (urls) => {
  let lastError;

  for (const url of urls) {
    try {
      return await api.delete(url);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const AdminProjects = () => {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [searchText, setSearchText] = useState("");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);

  const [assignSearch, setAssignSearch] = useState("");
  const [editAssigneeSearch, setEditAssigneeSearch] = useState("");

  const [editingMainTaskId, setEditingMainTaskId] = useState(null);
  const [reviewRemark, setReviewRemark] = useState("");
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");

  const [newProject, setNewProject] = useState({
  project_title: "",
  division: "",
  start_date: "",
  end_date: "",
  project_description: "",
  assignee_ids: [],
});

  const [editProject, setEditProject] = useState({
  project_title: "",
  division: "",
  start_date: "",
  end_date: "",
  project_description: "",
  assignee_ids: [],
});

  const [newMainTask, setNewMainTask] = useState({
    task_title: "",
    task_description: "",
    start_date: "",
    due_date: "",
    assignee_ids: [],
  });

  const [editMainTask, setEditMainTask] = useState({
    task_title: "",
    task_description: "",
    start_date: "",
    due_date: "",
    assignee_ids: [],
  });

  const fetchProjects = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await tryGet([
        "/admin-projects",
        "/admin-projects/projects",
        "/admin-projects/department-projects",
        "/admin-projects/all",
      ]);

      const data = getApiData(response);

      const projectRows =
        data.projects ||
        data.department_projects ||
        data.departmentProjects ||
        data.rows ||
        data;

      const normalizedProjects = asArray(projectRows).map(normalizeProject);

      setProjects(normalizedProjects);

      return normalizedProjects;
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to fetch projects."
      );

      return [];
    } finally {
      setLoading(false);
    }
  };

const fetchUsers = async () => {
  try {
    const response = await api.get("/admin-projects/assignable-users");
    const data = getApiData(response);

    const userRows =
      data.users ||
      data.employees ||
      data.rows ||
      data;

    setUsers(dedupeUsers(asArray(userRows)));
  } catch (err) {
    console.error("Fetch assignable department employees error:", err);
    setUsers([]);
    setError(
      err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to fetch department employees."
    );
  }
};

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

  const filteredProjects = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) return projects;

    return projects.filter((project) => {
      const searchable = [
        project.project_title,
        project.project_description,
        project.status,
        project.department_name,
        project.created_by_name,
        project.created_by_email,
        ...project.assignees.map((user) => getUserName(user)),
        ...project.assignees.map((user) => getUserEmail(user)),
        ...project.main_tasks.map((task) => task.task_title),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [projects, searchText]);

  const projectStats = useMemo(() => {
    return {
      total: projects.length,
      toDo: projects.filter((project) => normalizeStatus(project.status) === "to_do").length,
      inProgress: projects.filter(
        (project) => normalizeStatus(project.status) === "in_progress"
      ).length,
      underReview: projects.filter(
        (project) => normalizeStatus(project.status) === "under_review"
      ).length,
      done: projects.filter((project) => normalizeStatus(project.status) === "done").length,
      rejected: projects.filter(
        (project) => normalizeStatus(project.status) === "rejected"
      ).length,
      onHold: projects.filter(
        (project) => normalizeStatus(project.status) === "on_hold"
      ).length,
    };
  }, [projects]);

  const groupedProjects = useMemo(() => {
    return {
      to_do: filteredProjects.filter(
        (project) => normalizeStatus(project.status) === "to_do"
      ),
      in_progress: filteredProjects.filter(
        (project) => normalizeStatus(project.status) === "in_progress"
      ),
      under_review: filteredProjects.filter(
        (project) => normalizeStatus(project.status) === "under_review"
      ),
      done: filteredProjects.filter(
        (project) => normalizeStatus(project.status) === "done"
      ),
      rejected: filteredProjects.filter(
        (project) => normalizeStatus(project.status) === "rejected"
      ),
      on_hold: filteredProjects.filter(
        (project) => normalizeStatus(project.status) === "on_hold"
      ),
    };
  }, [filteredProjects]);

  const filteredAssignUsers = useMemo(() => {
    const query = assignSearch.trim().toLowerCase();

    if (!query) return users;

    return users.filter((user) => {
      return [getUserName(user), getUserEmail(user), user.department_name, user.designation]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [users, assignSearch]);

  const editProjectUserPool = useMemo(() => {
    return dedupeUsers([...(selectedProject?.assignees || []), ...users]);
  }, [selectedProject, users]);

  const filteredEditAssignees = useMemo(() => {
    const query = editAssigneeSearch.trim().toLowerCase();

    if (!query) return editProjectUserPool;

    return editProjectUserPool.filter((user) => {
      return [getUserName(user), getUserEmail(user), user.department_name, user.designation]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [editProjectUserPool, editAssigneeSearch]);

  const currentProjectAssignees = useMemo(() => {
    return dedupeUsers(selectedProject?.assignees || []);
  }, [selectedProject]);

  const selectedEditProjectAssignees = useMemo(() => {
    const selectedIds = new Set(editProject.assignee_ids.map(String));

    return editProjectUserPool.filter((user) =>
      selectedIds.has(String(getUserId(user)))
    );
  }, [editProjectUserPool, editProject.assignee_ids]);

  const cancelEditMainTask = () => {
    setEditingMainTaskId(null);
    setEditMainTask({
      task_title: "",
      task_description: "",
      start_date: "",
      due_date: "",
      assignee_ids: [],
    });
  };

  const openProjectDetails = (project) => {
    const normalizedProject = normalizeProject(project);
    const assigneeIds = normalizedProject.assignees
      .map((user) => getUserId(user))
      .filter(Boolean)
      .map(String);

    setSelectedProject(normalizedProject);
    setShowEditProjectModal(false);
    setReviewRemark("");
    setReviewError("");
    setReviewSuccess("");

setEditProject({
  project_title: normalizedProject.project_title || "",
  division: normalizedProject.division || "",
      start_date: normalizeDateForInput(normalizedProject.start_date),
      end_date: normalizeDateForInput(normalizedProject.end_date),
      project_description: normalizedProject.project_description || "",
      assignee_ids: [...new Set(assigneeIds)],
    });

    setNewMainTask({
      task_title: "",
      task_description: "",
      start_date: "",
      due_date: "",
      assignee_ids: [],
    });

    cancelEditMainTask();
    setEditAssigneeSearch("");
  };

  const closeProjectDetails = () => {
    setSelectedProject(null);
    setShowEditProjectModal(false);
    setReviewRemark("");
    setReviewError("");
    setReviewSuccess("");

    setNewMainTask({
      task_title: "",
      task_description: "",
      start_date: "",
      due_date: "",
      assignee_ids: [],
    });

    cancelEditMainTask();
  };

  const resetAssignForm = () => {
    setNewProject({
  project_title: "",
  division: "",
  start_date: "",
      end_date: "",
      project_description: "",
      assignee_ids: [],
    });

    setAssignSearch("");
  };

  const refreshSelectedProject = async (projectId) => {
    const latestProjects = await fetchProjects();

    const refreshedProject = latestProjects.find(
      (project) => String(project.project_id) === String(projectId)
    );

    if (refreshedProject) {
      openProjectDetails(refreshedProject);
    }

    return refreshedProject;
  };

  const toggleNewProjectAssignee = (userId) => {
    const value = String(userId);

    setNewProject((previous) => {
      const selected = new Set(previous.assignee_ids.map(String));

      if (selected.has(value)) {
        selected.delete(value);
      } else {
        selected.add(value);
      }

      return {
        ...previous,
        assignee_ids: [...selected],
      };
    });
  };

  const toggleEditProjectAssignee = (userId) => {
    const value = String(userId);

    setEditProject((previous) => {
      const selected = new Set(previous.assignee_ids.map(String));

      if (selected.has(value)) {
        selected.delete(value);
      } else {
        selected.add(value);
      }

      return {
        ...previous,
        assignee_ids: [...selected],
      };
    });
  };

  const toggleMainTaskAssignee = (userId) => {
    const value = String(userId);

    setNewMainTask((previous) => {
      const selected = new Set(previous.assignee_ids.map(String));

      if (selected.has(value)) {
        selected.delete(value);
      } else {
        selected.add(value);
      }

      return {
        ...previous,
        assignee_ids: [...selected],
      };
    });
  };

  const startEditMainTask = (task) => {
    const assigneeIds = asArray(task.assignees)
      .map((user) => getUserId(user))
      .filter(Boolean)
      .map(String);

    setEditingMainTaskId(String(task.task_id));

    setEditMainTask({
      task_title: task.task_title || "",
      task_description: task.task_description || "",
      start_date: normalizeDateForInput(task.start_date),
      due_date: normalizeDateForInput(task.due_date || task.end_date),
      assignee_ids: [...new Set(assigneeIds)],
    });
  };

  const toggleEditMainTaskAssignee = (userId) => {
    const value = String(userId);

    setEditMainTask((previous) => {
      const selected = new Set(previous.assignee_ids.map(String));

      if (selected.has(value)) {
        selected.delete(value);
      } else {
        selected.add(value);
      }

      return {
        ...previous,
        assignee_ids: [...selected],
      };
    });
  };

  const createProject = async () => {
    setError("");
    setSuccessMessage("");

    if (!newProject.project_title.trim()) {
      setError("Project title is required.");
      return;
    }

    if (!newProject.start_date || !newProject.end_date) {
      setError("Project start date and deadline are required.");
      return;
    }

    if (newProject.start_date > newProject.end_date) {
      setError("Project start date cannot be after project deadline.");
      return;
    }

    if (!newProject.assignee_ids.length) {
      setError("Select at least one project assignee.");
      return;
    }

    setActionLoading(true);

    try {
      const payload = {
        project_title: newProject.project_title.trim(),
        division: newProject.division,
        title: newProject.project_title.trim(),
        project_description: newProject.project_description.trim(),
        description: newProject.project_description.trim(),
        start_date: newProject.start_date,
        due_date: newProject.end_date,
        end_date: newProject.end_date,
        assignee_ids: newProject.assignee_ids,
        assignees: newProject.assignee_ids,
        project_assignees: newProject.assignee_ids,
      };

      const response = await tryPost(
        ["/admin-projects", "/admin-projects/projects", "/admin-projects/create"],
        payload
      );

      setSuccessMessage(response?.data?.message || "Project created successfully.");
      setShowAssignModal(false);
      resetAssignForm();
      await fetchProjects();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to create project."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const updateProject = async () => {
    if (!selectedProject?.project_id) return;

    setError("");
    setSuccessMessage("");

    if (!editProject.project_title.trim()) {
      setError("Project title is required.");
      return;
    }

    if (!editProject.start_date || !editProject.end_date) {
      setError("Project start date and deadline are required.");
      return;
    }

    if (editProject.start_date > editProject.end_date) {
      setError("Project start date cannot be after project deadline.");
      return;
    }

    if (!editProject.assignee_ids.length) {
      setError("Select at least one project assignee.");
      return;
    }

    setActionLoading(true);

    try {
      const projectId = selectedProject.project_id;

      const payload = {
        project_title: editProject.project_title.trim(),
        division: editProject.division,
        title: editProject.project_title.trim(),
        project_description: editProject.project_description.trim(),
        description: editProject.project_description.trim(),
        priority: selectedProject.priority || "medium",
        start_date: editProject.start_date,
        due_date: editProject.end_date,
        end_date: editProject.end_date,
        assignee_ids: editProject.assignee_ids,
        assignees: editProject.assignee_ids,
        project_assignees: editProject.assignee_ids,
      };

      const response = await tryPut(
        [
          `/admin-projects/${projectId}`,
          `/admin-projects/projects/${projectId}`,
          `/admin-projects/${projectId}/details`,
          `/admin-projects/update/${projectId}`,
        ],
        payload
      );

      setSuccessMessage(response?.data?.message || "Project updated successfully.");
      setShowEditProjectModal(false);

      await refreshSelectedProject(projectId);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to update project."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const deleteProject = async () => {
    if (!selectedProject?.project_id) return;

    const confirmed = window.confirm(
      `Delete project "${selectedProject.project_title}"?`
    );

    if (!confirmed) return;

    setActionLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const projectId = selectedProject.project_id;

      const response = await tryDelete([
        `/admin-projects/${projectId}`,
        `/admin-projects/projects/${projectId}`,
        `/admin-projects/delete/${projectId}`,
      ]);

      setSuccessMessage(response?.data?.message || "Project deleted successfully.");
      closeProjectDetails();
      await fetchProjects();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to delete project."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const addMainTask = async () => {
    if (!selectedProject?.project_id) return;

    setError("");
    setSuccessMessage("");

    if (!newMainTask.task_title.trim()) {
      setError("Main task title is required.");
      return;
    }

    if (!newMainTask.start_date || !newMainTask.due_date) {
      setError("Main task start date and deadline are required.");
      return;
    }

    if (newMainTask.start_date > newMainTask.due_date) {
      setError("Main task start date cannot be after its deadline.");
      return;
    }

    if (
      selectedProject.start_date &&
      newMainTask.start_date < selectedProject.start_date
    ) {
      setError(
        `Main task start date cannot be before project start date (${selectedProject.start_date}).`
      );
      return;
    }

    if (
      selectedProject.end_date &&
      newMainTask.due_date > selectedProject.end_date
    ) {
      setError(
        `Main task deadline cannot exceed project deadline (${selectedProject.end_date}).`
      );
      return;
    }

    if (!newMainTask.assignee_ids.length) {
      setError("Select at least one assignee for the main task.");
      return;
    }

    setActionLoading(true);

    try {
      const projectId = selectedProject.project_id;

      const payload = {
        project_id: projectId,
        task_title: newMainTask.task_title.trim(),
        title: newMainTask.task_title.trim(),
        task_description: newMainTask.task_description.trim(),
        description: newMainTask.task_description.trim(),
        start_date: newMainTask.start_date,
        due_date: newMainTask.due_date,
        end_date: newMainTask.due_date,
        assignee_ids: newMainTask.assignee_ids,
        assigned_to_user_ids: newMainTask.assignee_ids,
        assignees: newMainTask.assignee_ids,
      };

      const response = await tryPost(
        [
          `/admin-projects/${projectId}/tasks`,
          `/admin-projects/projects/${projectId}/tasks`,
          `/admin-projects/${projectId}/main-tasks`,
          "/admin-projects/tasks",
        ],
        payload
      );

      setSuccessMessage(
        response?.data?.message || "Main task added successfully."
      );

      setNewMainTask({
        task_title: "",
        task_description: "",
        start_date: "",
        due_date: "",
        assignee_ids: [],
      });

      await refreshSelectedProject(projectId);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to add main task."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const updateMainTask = async (task) => {
    if (!selectedProject?.project_id || !task?.task_id) return;

    setError("");
    setSuccessMessage("");

    if (!editMainTask.task_title.trim()) {
      setError("Main task title is required.");
      return;
    }

    if (!editMainTask.start_date || !editMainTask.due_date) {
      setError("Main task start date and deadline are required.");
      return;
    }

    if (editMainTask.start_date > editMainTask.due_date) {
      setError("Main task start date cannot be after its deadline.");
      return;
    }

    if (
      selectedProject.start_date &&
      editMainTask.start_date < selectedProject.start_date
    ) {
      setError(
        `Main task start date cannot be before project start date (${selectedProject.start_date}).`
      );
      return;
    }

    if (
      selectedProject.end_date &&
      editMainTask.due_date > selectedProject.end_date
    ) {
      setError(
        `Main task deadline cannot exceed project deadline (${selectedProject.end_date}).`
      );
      return;
    }

    if (!editMainTask.assignee_ids.length) {
      setError("Select at least one assignee for the main task.");
      return;
    }

    setActionLoading(true);

    try {
      const projectId = selectedProject.project_id;
      const taskId = task.task_id;

      const payload = {
        project_id: projectId,
        task_id: taskId,
        task_title: editMainTask.task_title.trim(),
        title: editMainTask.task_title.trim(),
        task_description: editMainTask.task_description.trim(),
        description: editMainTask.task_description.trim(),
        priority: task.priority || "medium",
        start_date: editMainTask.start_date,
        due_date: editMainTask.due_date,
        end_date: editMainTask.due_date,
        assignee_ids: editMainTask.assignee_ids,
        assigned_to_user_ids: editMainTask.assignee_ids,
        assignees: editMainTask.assignee_ids,
      };

      const response = await tryPut(
        [
          `/admin-projects/tasks/${taskId}`,
          `/admin-projects/${projectId}/tasks/${taskId}`,
          `/admin-projects/projects/${projectId}/tasks/${taskId}`,
          `/admin-projects/main-tasks/${taskId}`,
        ],
        payload
      );

      setSuccessMessage(
        response?.data?.message || "Main task updated successfully."
      );

      cancelEditMainTask();
      await refreshSelectedProject(projectId);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to update main task."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleProjectReviewAction = async (action) => {
    if (!selectedProject?.project_id || reviewActionLoading) return;

    setReviewError("");
    setReviewSuccess("");

    if (
      (action === "reject" || action === "on_hold") &&
      !reviewRemark.trim()
    ) {
      setReviewError(
        "Please add a remark before rejecting or putting the project on hold."
      );
      return;
    }

    setReviewActionLoading(true);

    try {
      const projectId = selectedProject.project_id;

      const response = await api.post(
        `/admin-review/projects/${projectId}/action`,
        {
          action,
          remark: reviewRemark.trim(),
        }
      );

      const message =
        response?.data?.message || "Project review updated successfully.";

      setReviewSuccess(message);
      setSuccessMessage(message);
      setReviewRemark("");

      await fetchProjects();
      closeProjectDetails();
    } catch (err) {
      console.error("Project review action failed:", err);

      setReviewError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to update project review."
      );
    } finally {
      setReviewActionLoading(false);
    }
  };
  const formatExportDuration = (seconds) => {
  const s = Math.max(0, Number(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
};

const formatExportDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatExportTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const exportProjectData = async () => {
  try {
    setActionLoading(true);
    setError("");
    setSuccessMessage("");

    const usersResponse = await api.get("/admin/users");
    const departmentUsers = usersResponse?.data?.users || [];

    const responses = await Promise.all(
      departmentUsers.map(async (user) => {
        const userId = user.user_id || user.id;
        if (!userId) return null;

        try {
          const response = await api.get(
            `/admin/users/${userId}/time-summary`
          );
          return response?.data || null;
        } catch (error) {
          console.error(`Could not load time for employee ${userId}`, error);
          return null;
        }
      })
    );

    const summaries = responses.filter(Boolean);
    const projectMap = new Map();

    projects.forEach((project) => {
      projectMap.set(String(project.project_id), {
        project_id: project.project_id,
        project_title: project.project_title || "Untitled Project",
status: getStatusLabel(project.status),
start_date: project.start_date || "",
end_date: project.end_date || "",
department: project.department_name || "-",
division: project.division || "-",
total_seconds: 0,
        employees: new Map(),
        tasks: new Map(),
        sessions: [],
      });
    });

    summaries.forEach((summary) => {
      const employee = summary.employee || {};

      (summary.projects || []).forEach((project) => {
        const key = String(project.project_id);

        if (!projectMap.has(key)) {
          projectMap.set(key, {
            project_id: project.project_id,
            project_title: project.project_title || "Untitled Project",
            status: "-",
            start_date: "",
            end_date: "",
            department: employee.department_name || "-",
            division: project.division || "-",
            total_seconds: 0,
            employees: new Map(),
            tasks: new Map(),
            sessions: [],
          });
        }

        const p = projectMap.get(key);

        (project.tasks || []).forEach((task) => {
          const taskSeconds = Number(task.total_seconds || 0);
          p.total_seconds += taskSeconds;

          const employeeKey = String(
            employee.user_id || employee.employee_code || employee.full_name
          );

          if (!p.employees.has(employeeKey)) {
            p.employees.set(employeeKey, {
              name: employee.full_name || "-",
              code: employee.employee_code || "-",
              seconds: 0,
            });
          }

          p.employees.get(employeeKey).seconds += taskSeconds;

          const taskKey = String(task.task_id);

          if (!p.tasks.has(taskKey)) {
            p.tasks.set(taskKey, {
              title: task.task_title || "Untitled Task",
              status: getStatusLabel(task.status),
              seconds: 0,
            });
          }

          p.tasks.get(taskKey).seconds += taskSeconds;

          (task.sessions || []).forEach((session) => {
            p.sessions.push({
              Project: p.project_title,
              Employee: employee.full_name || "-",
              "Employee Code": employee.employee_code || "-",
              Task: task.task_title || "-",
              "Task Status": getStatusLabel(task.status),
              Date: formatExportDate(session.started_at),
              "Start Time": formatExportTime(session.started_at),
              "End Time": session.currently_running
                ? "Running"
                : formatExportTime(session.ended_at),
              Duration: formatExportDuration(session.seconds_worked),
              "Duration Seconds": Number(session.seconds_worked || 0),
              Reason: session.currently_running
                ? "Running"
                : String(session.end_reason || "-").replace(/_/g, " "),
              "Session ID": session.session_id,
            });
          });
        });
      });
    });

    const workbook = XLSX.utils.book_new();
    const summaryRows = [];

    Array.from(projectMap.values()).forEach((project, index) => {
      if (index) summaryRows.push([], []);

      summaryRows.push([`PROJECT: ${project.project_title}`]);
      summaryRows.push([]);
      summaryRows.push(["Project Status", project.status]);
summaryRows.push(["Start Date", project.start_date || "-"]);
summaryRows.push(["End Date", project.end_date || "-"]);
summaryRows.push(["Department", project.department || "-"]);
summaryRows.push(["Division", project.division || "-"]);
summaryRows.push([]);
      summaryRows.push([
        "Total Tracked Time",
        formatExportDuration(project.total_seconds),
      ]);
      summaryRows.push(["Employees Worked", project.employees.size]);
      summaryRows.push(["Tasks Worked", project.tasks.size]);
      summaryRows.push([]);
      summaryRows.push(["EMPLOYEE BREAKDOWN"]);
      summaryRows.push(["Employee", "Employee Code", "Tracked Time"]);

      const employees = Array.from(project.employees.values()).sort(
        (a, b) => b.seconds - a.seconds
      );

      if (!employees.length) {
        summaryRows.push(["No employee time recorded", "-", "0s"]);
      } else {
        employees.forEach((employee) => {
          summaryRows.push([
            employee.name,
            employee.code,
            formatExportDuration(employee.seconds),
          ]);
        });
      }

      summaryRows.push([]);
      summaryRows.push(["TASK BREAKDOWN"]);
      summaryRows.push(["Task", "Status", "Tracked Time"]);

      const tasks = Array.from(project.tasks.values()).sort(
        (a, b) => b.seconds - a.seconds
      );

      if (!tasks.length) {
        summaryRows.push(["No task time recorded", "-", "0s"]);
      } else {
        tasks.forEach((task) => {
          summaryRows.push([
            task.title,
            task.status,
            formatExportDuration(task.seconds),
          ]);
        });
      }
    });

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet["!cols"] = [
      { wch: 38 },
      { wch: 24 },
      { wch: 20 },
    ];

    const allSessions = Array.from(projectMap.values()).flatMap(
      (project) => project.sessions
    );

    const sessionsSheet = XLSX.utils.json_to_sheet(
      allSessions.length
        ? allSessions
        : [
            {
              Project: "No work sessions recorded",
              Employee: "-",
              "Employee Code": "-",
              Task: "-",
              "Task Status": "-",
              Date: "-",
              "Start Time": "-",
              "End Time": "-",
              Duration: "0s",
              "Duration Seconds": 0,
              Reason: "-",
              "Session ID": "-",
            },
          ]
    );

    sessionsSheet["!cols"] = [
      { wch: 30 },
      { wch: 24 },
      { wch: 16 },
      { wch: 30 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 20 },
      { wch: 12 },
    ];

    if (sessionsSheet["!ref"]) {
      sessionsSheet["!autofilter"] = {
        ref: sessionsSheet["!ref"],
      };
    }

    XLSX.utils.book_append_sheet(
      workbook,
      summarySheet,
      "Project Summary"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      sessionsSheet,
      "Work Sessions"
    );

    const today = new Date().toISOString().slice(0, 10);

    XLSX.writeFile(
      workbook,
      `Valencia-Project-Time-Report-${today}.xlsx`
    );

    setSuccessMessage("Project time report exported successfully.");
  } catch (error) {
    console.error("Export project data error:", error);

    setError(
      error?.response?.data?.message ||
        error?.message ||
        "Failed to export project time report."
    );
  } finally {
    setActionLoading(false);
  }
};

  const kanbanColumns = [
    {
      key: "to_do",
      title: "To Do",
      subtitle: "Not started",
      icon: Clock3,
      projects: groupedProjects.to_do,
    },
    {
      key: "in_progress",
      title: "In Progress",
      subtitle: "Work started",
      icon: FolderKanban,
      projects: groupedProjects.in_progress,
    },
    {
      key: "under_review",
      title: "Under Review",
      subtitle: "Waiting review",
      icon: Eye,
      projects: groupedProjects.under_review,
    },
    {
      key: "done",
      title: "Done",
      subtitle: "Completed work",
      icon: CheckCircle2,
      projects: groupedProjects.done,
    },
    {
      key: "rejected",
      title: "Rejected",
      subtitle: "Rejected projects",
      icon: XCircle,
      projects: groupedProjects.rejected,
    },
    {
      key: "on_hold",
      title: "On Hold",
      subtitle: "Paused projects",
      icon: PauseCircle,
      projects: groupedProjects.on_hold,
    },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.topActions}>
        <button
          type="button"
          style={styles.refreshButton}
          onClick={fetchProjects}
          disabled={loading}
        >
          <RefreshCw size={18} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>

        <button
          type="button"
          style={styles.assignButton}
          onClick={() => setShowAssignModal(true)}
        >
          <Plus size={19} />
          Assign New Project
        </button>

        <button
          type="button"
          style={styles.exportButton}
          onClick={exportProjectData}
          disabled={actionLoading}
        >
          <Download size={19} />

          {actionLoading
            ? "Preparing..."
            : "Export Data"}
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}
      {successMessage && <div style={styles.successBox}>{successMessage}</div>}

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <strong style={styles.statNumber}>{projectStats.total}</strong>
          <span style={styles.statLabel}>Total</span>
        </div>

        <div style={styles.statCard}>
          <strong style={styles.statNumber}>{projectStats.toDo}</strong>
          <span style={styles.statLabel}>To Do</span>
        </div>

        <div style={styles.statCard}>
          <strong style={styles.statNumber}>{projectStats.inProgress}</strong>
          <span style={styles.statLabel}>In Progress</span>
        </div>

        <div style={styles.statCard}>
          <strong style={styles.statNumber}>{projectStats.underReview}</strong>
          <span style={styles.statLabel}>Under Review</span>
        </div>

        <div style={styles.statCard}>
          <strong style={styles.statNumber}>{projectStats.done}</strong>
          <span style={styles.statLabel}>Done</span>
        </div>

        <div style={styles.statCard}>
          <strong style={styles.statNumber}>{projectStats.rejected}</strong>
          <span style={styles.statLabel}>Rejected</span>
        </div>

        <div style={styles.statCard}>
          <strong style={styles.statNumber}>{projectStats.onHold}</strong>
          <span style={styles.statLabel}>On Hold</span>
        </div>
      </div>

      <section style={styles.kanbanCard}>
        <div style={styles.kanbanHeader}>
          <div>
            <h2 style={styles.sectionTitle}>
              <FolderKanban size={24} color="#ff5733" />
              Project Kanban
            </h2>
            <p style={styles.sectionSubtitle}>
              First three columns are visible. Scroll sideways for Done, Rejected
              and On Hold.
            </p>
          </div>

          <div className="admin-project-search-shell" style={styles.searchBox}>
            <Search size={18} color="#64748b" />
            <input
              className="admin-project-search-input"
              style={styles.searchInput}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search project, assignee, status..."
            />
          </div>
        </div>

        <div style={styles.kanbanScroll}>
          <div style={styles.kanbanBoard}>
            {kanbanColumns.map((column) => {
              const Icon = column.icon;

              return (
                <div style={styles.kanbanColumn} key={column.key}>
                  <div style={styles.columnHeader}>
                    <div>
                      <h3 style={styles.columnTitle}>
                        <Icon size={20} />
                        {column.title}
                      </h3>
                      <p style={styles.columnSubtitle}>{column.subtitle}</p>
                    </div>

                    <span style={styles.columnCount}>{column.projects.length}</span>
                  </div>

                  <div style={styles.columnBody}>
                    {column.projects.length === 0 ? (
                      <div style={styles.emptyColumn}>No projects here.</div>
                    ) : (
                      column.projects.map((project) => (
                        <button
                          type="button"
                          style={styles.projectTile}
                          key={project.project_id}
                          onClick={() => openProjectDetails(project)}
                        >
                          <span style={styles.projectTileTitle}>
                            {project.project_title}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {showAssignModal && (
  <div style={styles.modalOverlay}>
    <div style={styles.assignModal}>
            <button
              type="button"
              style={styles.closeButton}
              onClick={() => {
                setShowAssignModal(false);
                resetAssignForm();
              }}
            >
              <X size={20} />
            </button>

            <h2 style={styles.modalTitle}>Assign New Project</h2>
            <p style={styles.modalSubtitle}>
              Create project details and select project assignees. Main tasks can
              be added after opening the project tile.
            </p>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span>Project Title</span>
                <input
                  value={newProject.project_title}
                  onChange={(event) =>
                    setNewProject((previous) => ({
                      ...previous,
                      project_title: event.target.value,
                    }))
                  }
                  placeholder="Example: Website Optimization"
                />
              </label>
              
              <label style={styles.field}>
  <span>Project Division</span>

  <select
    value={newProject.division}
    onChange={(event) =>
      setNewProject((previous) => ({
        ...previous,
        division: event.target.value,
      }))
    }
  >
    <option value="">Select Division</option>

    {PROJECT_DIVISIONS.map((division) => (
      <option key={division} value={division}>
        {division}
      </option>
    ))}
  </select>
</label>

              <label style={styles.field}>
                <span>Project Start Date</span>
                <input
                  type="date"
                  value={newProject.start_date}
                  onChange={(event) =>
                    setNewProject((previous) => ({
                      ...previous,
                      start_date: event.target.value,
                    }))
                  }
                />
              </label>

              <label style={styles.field}>
                <span>Project Deadline</span>
                <input
                  type="date"
                  value={newProject.end_date}
                  onChange={(event) =>
                    setNewProject((previous) => ({
                      ...previous,
                      end_date: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label style={styles.field}>
              <span>Project Description</span>
              <textarea
                value={newProject.project_description}
                onChange={(event) =>
                  setNewProject((previous) => ({
                    ...previous,
                    project_description: event.target.value,
                  }))
                }
                placeholder="Write the project description..."
              />
            </label>

            <div style={styles.assigneePanel}>
              <div style={styles.panelHeader}>
                <div>
                  <h3 style={styles.panelTitle}>Project Assignees</h3>
                  <p style={styles.panelSubtitle}>
                    Employees from your department. Selected:{" "}
                    {newProject.assignee_ids.length}
                  </p>
                </div>

                <div style={styles.modalSearchBox}>
                  <Search size={18} color="#64748b" />
                  <input
                    style={styles.searchInput}
                    value={assignSearch}
                    onChange={(event) => setAssignSearch(event.target.value)}
                    placeholder="Search department employees..."
                  />
                </div>
              </div>

              <div style={styles.assigneeList}>
                {filteredAssignUsers.length === 0 ? (
                  <div style={styles.emptyColumn}>
                    No active employees were returned for your department.
                  </div>
                ) : (
                  filteredAssignUsers.map((user) => {
                    const userId = String(getUserId(user));
                    const checked = newProject.assignee_ids
                      .map(String)
                      .includes(userId);

                    return (
                      <label style={styles.assigneeRow} key={userId}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleNewProjectAssignee(userId)}
                        />

                        <div style={styles.assigneeAvatar}>
                          {getInitials(getUserName(user))}
                        </div>

                        <div style={styles.assigneeInfo}>
                          <strong>{getUserName(user)}</strong>
                          <span>{getUserEmail(user)}</span>
                        </div>

                        <b style={styles.assigneeDept}>
                          {user.department_name || "-"}
                        </b>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div style={styles.modalFooter}>

<button
  type="button"
  style={styles.fullPrimaryButton}
  onClick={createProject}
  disabled={actionLoading}
>
  <CalendarDays size={19} />
  {actionLoading ? "Assigning..." : "Assign Project"}
</button>


<button
  type="button"
  style={styles.cancelModalButton}
  onClick={()=>{
    setShowAssignModal(false);
    resetAssignForm();
  }}
>
  Cancel
</button>

</div>
          </div>
        </div>
      )}

      {selectedProject && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.floatingCloseLayer}>
              <button
                type="button"
                style={styles.projectModalCloseButton}
                onClick={closeProjectDetails}
              >
                <X size={22} />
              </button>
            </div>

            <div style={styles.projectModalNormalHeader}>
              <div style={styles.projectModalTitleBlock}>
                <h2 style={styles.modalTitle}>{selectedProject.project_title}</h2>
                <p style={styles.modalSubtitle}>
  View project details, manage tasks, and track project progress.
</p>
              </div>

              <button
                type="button"
                style={styles.projectModalEditButton}
                onClick={() => setShowEditProjectModal(true)}
              >
                <Edit size={18} />
                Edit Project
              </button>
            </div>

            <div style={styles.detailsGrid}>
              <div style={styles.detailBox}>
                <span style={styles.detailLabel}>Department</span>

                <strong style={styles.detailValue}>
                  {selectedProject.department_name || "-"}
                </strong>
              </div>
              <div style={styles.detailBox}>
  <span style={styles.detailLabel}>Division</span>

  <strong style={styles.detailValue}>
    {selectedProject.division || "-"}
  </strong>
</div>

              <div style={styles.detailBox}>
                <span style={styles.detailLabel}>Created By</span>
                <strong style={styles.detailValue}>
                  {selectedProject.created_by_name || "-"}
                </strong>
                <p style={styles.detailEmail}>
                  {selectedProject.created_by_email || ""}
                </p>
              </div>

              <div style={styles.detailBox}>
                <span style={styles.detailLabel}>Status</span>
                <strong style={styles.detailValue}>
                  {getStatusLabel(selectedProject.status)}
                </strong>
              </div>

              <div style={styles.detailBox}>
                <span style={styles.detailLabel}>Project Dates</span>
                <strong style={styles.detailDateValue}>
                  <span>{selectedProject.start_date || "-"}</span>
                  <span style={styles.detailDateSeparator}>to</span>
                  <span>{selectedProject.end_date || "-"}</span>
                </strong>
              </div>
            </div>

            <div style={styles.progressBox}>
              <div style={styles.progressTop}>
                <strong>Project Progress</strong>
                <b>{selectedProject.overall_progress || 0}%</b>
              </div>

              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${selectedProject.overall_progress || 0}%`,
                  }}
                />
              </div>
            </div>

            {["under_review", "on_hold"].includes(
  normalizeStatus(selectedProject.status)
) && (
              <section style={styles.reviewActionSection}>
                <div style={styles.reviewActionHeader}>
                  <div>
                    <h3 style={styles.reviewActionTitle}>Project Review</h3>
                    <p style={styles.reviewActionSubtitle}>
                      Approve this project, place it on hold, or reject it.
                    </p>
                  </div>
                </div>

                {reviewError && (
                  <div style={styles.reviewInlineError}>{reviewError}</div>
                )}

                {reviewSuccess && (
                  <div style={styles.reviewInlineSuccess}>{reviewSuccess}</div>
                )}

                <label style={styles.reviewRemarkField}>
                  <span>Remark</span>
                  <textarea
                    value={reviewRemark}
                    onChange={(event) => setReviewRemark(event.target.value)}
                    placeholder="Add your review remark..."
                    disabled={reviewActionLoading}
                  />
                </label>

                <div style={styles.reviewActionButtons}>
                  <button
                    type="button"
                    style={{
                      ...styles.approveButton,
                      ...(reviewActionLoading ? styles.disabledReviewButton : {}),
                    }}
                    disabled={reviewActionLoading}
                    onClick={() => handleProjectReviewAction("done")}
                  >
                    <CheckCircle2 size={18} />
                    {reviewActionLoading ? "Processing..." : "Approve"}
                  </button>

                  <button
                    type="button"
                    style={{
                      ...styles.holdButton,
                      ...(reviewActionLoading ? styles.disabledReviewButton : {}),
                    }}
                    disabled={reviewActionLoading}
                    onClick={() => handleProjectReviewAction("on_hold")}
                  >
                    <PauseCircle size={18} />
                    On Hold
                  </button>

                  <button
                    type="button"
                    style={{
                      ...styles.rejectButton,
                      ...(reviewActionLoading ? styles.disabledReviewButton : {}),
                    }}
                    disabled={reviewActionLoading}
                    onClick={() => handleProjectReviewAction("reject")}
                  >
                    <XCircle size={18} />
                    Reject
                  </button>
                  {normalizeStatus(selectedProject.status) === "on_hold" && (
  <button
    type="button"
    style={{
      ...styles.approveButton,
      ...(reviewActionLoading ? styles.disabledReviewButton : {}),
    }}
    disabled={reviewActionLoading}
    onClick={() => handleProjectReviewAction("on_hold")}
  >
    <RefreshCw size={18} />
    {reviewActionLoading ? "Processing..." : "Resume"}
  </button>
)}
                </div>
              </section>
            )}

            {canEditMainTasks(selectedProject.status) && (
  <section style={styles.editSection}>
    <h3 style={styles.modalSectionTitle}>
      <Plus size={21} color="#ff5733" />
      Add Main Task
    </h3>

    <p style={styles.panelSubtitle}>
      Select one or more assignees from this project's assignees only.
    </p>

    <label style={styles.field}>
      <span>Main Task Title</span>
      <input
        value={newMainTask.task_title}
        onChange={(event) =>
          setNewMainTask((previous) => ({
            ...previous,
            task_title: event.target.value,
          }))
        }
        placeholder="Example: Frontend dashboard"
      />
    </label>

    <label style={styles.field}>
      <span>Main Task Description</span>
      <textarea
        value={newMainTask.task_description}
        onChange={(event) =>
          setNewMainTask((previous) => ({
            ...previous,
            task_description: event.target.value,
          }))
        }
        placeholder="Write task details..."
      />
    </label>

    <div style={styles.formGrid}>
      <label style={styles.field}>
        <span>Main Task Start Date</span>
        <input
          type="date"
          value={newMainTask.start_date}
          min={selectedProject.start_date || undefined}
          max={selectedProject.end_date || undefined}
          onChange={(event) => {
            const value = event.target.value;

            setNewMainTask((previous) => ({
              ...previous,
              start_date: value,
              due_date:
                previous.due_date && previous.due_date < value
                  ? ""
                  : previous.due_date,
            }));
          }}
        />
      </label>

      <label style={styles.field}>
        <span>Main Task Deadline</span>
        <input
          type="date"
          value={newMainTask.due_date}
          min={newMainTask.start_date || selectedProject.start_date || undefined}
          max={selectedProject.end_date || undefined}
          onChange={(event) =>
            setNewMainTask((previous) => ({
              ...previous,
              due_date: event.target.value,
            }))
          }
        />
      </label>
    </div>

    <div style={styles.taskAssigneeList}>
      {currentProjectAssignees.length === 0 ? (
        <div style={styles.emptyColumn}>
          Select project assignees first.
        </div>
      ) : (
        currentProjectAssignees.map((user) => {
          const userId = String(getUserId(user));

          const checked = newMainTask.assignee_ids
            .map(String)
            .includes(userId);

          return (
            <label style={styles.taskAssigneeRow} key={userId}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleMainTaskAssignee(userId)}
              />

              <strong>{getUserName(user)}</strong>
              <span>{user.department_name || "-"}</span>
            </label>
          );
        })
      )}
    </div>

    <button
      type="button"
      style={styles.fullPrimaryButton}
      onClick={addMainTask}
      disabled={actionLoading}
    >
      <Plus size={19} />
      {actionLoading ? "Adding..." : "Add Main Task"}
    </button>

  </section>
)}
            <section>
              <h3 style={styles.modalSectionTitle}>Main Tasks</h3>

              {selectedProject.main_tasks.length === 0 ? (
                <div style={styles.emptyColumn}>No main tasks added yet.</div>
              ) : (
                <div style={styles.mainTaskList}>
                  {selectedProject.main_tasks.map((task) => {
                    const isEditing =
                      String(editingMainTaskId) === String(task.task_id);
                    const projectAllowsEditing = canEditMainTasks(
                      selectedProject.status
                    );

                    return (
                      <div style={styles.mainTaskCard} key={task.task_id}>
                        {!isEditing ? (
                          <>
                            <div style={styles.mainTaskTop}>
                              <div style={styles.mainTaskTextBlock}>
                                <h4>{task.task_title}</h4>
                                <p>{task.task_description}</p>

                                <div style={styles.mainTaskDateLine}>
                                  <span>
                                    Start: {task.start_date || "-"}
                                  </span>
                                  <span>
                                    Deadline: {task.due_date || task.end_date || "-"}
                                  </span>
                                </div>
                              </div>

                              <div style={styles.mainTaskActions}>
                                <span style={styles.taskStatusBadge}>
                                  {getStatusLabel(task.status)} ·{" "}
                                  {task.progress || 0}%
                                </span>

                                {projectAllowsEditing && (
                                  <button
                                    type="button"
                                    style={styles.smallEditButton}
                                    onClick={() => startEditMainTask(task)}
                                  >
                                    <Edit size={16} />
                                    Edit
                                  </button>
                                )}
                              </div>
                            </div>

                            <div style={styles.progressTrack}>
                              <div
                                style={{
                                  ...styles.progressFill,
                                  width: `${task.progress || 0}%`,
                                }}
                              />
                            </div>

                            <small>
                              {task.completed_subtasks || 0}/
                              {task.total_subtasks || 0} subtasks completed
                            </small>

                            <div style={styles.taskChips}>
                              {task.assignees.length === 0 ? (
                                <span style={styles.chip}>No assignee</span>
                              ) : (
                                task.assignees.map((user) => (
                                  <span
                                    style={styles.chip}
                                    key={getUserId(user) || getUserEmail(user)}
                                  >
                                    {getUserName(user)}
                                  </span>
                                ))
                              )}
                            </div>
                          </>
                        ) : (
                          <div style={styles.mainTaskEditBox}>
                            <label style={styles.field}>
                              <span>Main Task Title</span>
                              <input
                                value={editMainTask.task_title}
                                onChange={(event) =>
                                  setEditMainTask((previous) => ({
                                    ...previous,
                                    task_title: event.target.value,
                                  }))
                                }
                                placeholder="Enter main task title"
                              />
                            </label>

                            <label style={styles.field}>
                              <span>Main Task Description</span>
                              <textarea
                                value={editMainTask.task_description}
                                onChange={(event) =>
                                  setEditMainTask((previous) => ({
                                    ...previous,
                                    task_description: event.target.value,
                                  }))
                                }
                                placeholder="Write main task details"
                              />
                            </label>

                            <div style={styles.formGrid}>
                              <label style={styles.field}>
                                <span>Main Task Start Date</span>
                                <input
                                  type="date"
                                  value={editMainTask.start_date}
                                  min={selectedProject.start_date || undefined}
                                  max={selectedProject.end_date || undefined}
                                  onChange={(event) => {
                                    const value = event.target.value;

                                    setEditMainTask((previous) => ({
                                      ...previous,
                                      start_date: value,
                                      due_date:
                                        previous.due_date &&
                                        previous.due_date < value
                                          ? ""
                                          : previous.due_date,
                                    }));
                                  }}
                                />
                              </label>

                              <label style={styles.field}>
                                <span>Main Task Deadline</span>
                                <input
                                  type="date"
                                  value={editMainTask.due_date}
                                  min={
                                    editMainTask.start_date ||
                                    selectedProject.start_date ||
                                    undefined
                                  }
                                  max={selectedProject.end_date || undefined}
                                  onChange={(event) =>
                                    setEditMainTask((previous) => ({
                                      ...previous,
                                      due_date: event.target.value,
                                    }))
                                  }
                                />
                              </label>
                            </div>

                            <div style={styles.editTaskAssigneeBox}>
                              <strong style={styles.editTaskAssigneeTitle}>
                                Select Assignee(s)
                              </strong>

                              <div style={styles.taskAssigneeList}>
                                {currentProjectAssignees.length === 0 ? (
                                  <div style={styles.emptyColumn}>
                                    No project assignees available.
                                  </div>
                                ) : (
                                  currentProjectAssignees.map((user) => {
                                    const userId = String(getUserId(user));
                                    const checked = editMainTask.assignee_ids
                                      .map(String)
                                      .includes(userId);

                                    return (
                                      <label
                                        style={styles.taskAssigneeRow}
                                        key={userId}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() =>
                                            toggleEditMainTaskAssignee(userId)
                                          }
                                        />
                                        <strong>{getUserName(user)}</strong>
                                        <span>{user.department_name || "-"}</span>
                                      </label>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                            <div style={styles.editTaskButtonsRow}>
                              <button
                                type="button"
                                style={styles.cancelEditTaskButton}
                                onClick={cancelEditMainTask}
                                disabled={actionLoading}
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                style={styles.saveEditTaskButton}
                                onClick={() => updateMainTask(task)}
                                disabled={actionLoading}
                              >
                                {actionLoading ? "Saving..." : "Save Main Task"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            <div style={styles.modalFooter}>
  <button
    type="button"
    style={styles.cancelModalButton}
    onClick={closeProjectDetails}
  >
    Cancel
  </button>
</div>
          </div>
        </div>
      )}

      {selectedProject && showEditProjectModal && (
        <div style={styles.editProjectOverlay}>
          <div style={styles.editProjectModal}>
            <div style={styles.floatingCloseLayer}>
              <button
                type="button"
                style={styles.projectModalCloseButton}
                onClick={() => setShowEditProjectModal(false)}
              >
                <X size={22} />
              </button>
            </div>

            <div style={styles.editProjectNormalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Edit Project</h2>
                <p style={styles.modalSubtitle}>
                  Change project title, dates, description, assignees, or delete
                  this project.
                </p>
              </div>
            </div>

            <div style={styles.sectionRowHeader}>
              <h3 style={styles.modalSectionTitle}>
                <Edit size={21} color="#ff5733" />
                Project Details
              </h3>

              <button
                type="button"
                style={styles.dangerButton}
                onClick={deleteProject}
                disabled={actionLoading}
              >
                <Trash2 size={18} />
                Delete Project
              </button>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span>Project Title</span>
                <input
                  value={editProject.project_title}
                  onChange={(event) =>
                    setEditProject((previous) => ({
                      ...previous,
                      project_title: event.target.value,
                    }))
                  }
                />
              </label>

              <label style={styles.field}>
                <span>Project Start Date</span>
                <input
                  type="date"
                  value={editProject.start_date}
                  onChange={(event) =>
                    setEditProject((previous) => ({
                      ...previous,
                      start_date: event.target.value,
                    }))
                  }
                />
              </label>

              <label style={styles.field}>
                <span>Project Deadline</span>
                <input
                  type="date"
                  value={editProject.end_date}
                  onChange={(event) =>
                    setEditProject((previous) => ({
                      ...previous,
                      end_date: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label style={styles.field}>
              <span>Project Description</span>
              <textarea
                value={editProject.project_description}
                onChange={(event) =>
                  setEditProject((previous) => ({
                    ...previous,
                    project_description: event.target.value,
                  }))
                }
              />
            </label>

            <div style={styles.selectedAssigneePreview}>
              <div>
                <h3 style={styles.panelTitle}>Currently Assigned To</h3>
                <p style={styles.panelSubtitle}>
                  These users are assigned to this project right now.
                </p>
              </div>

              <div style={styles.selectedAssigneeChips}>
                {selectedEditProjectAssignees.length === 0 ? (
                  <span style={styles.noAssigneeText}>
                    No project assignees selected.
                  </span>
                ) : (
                  selectedEditProjectAssignees.map((user) => (
                    <span
                      style={styles.selectedAssigneeChip}
                      key={getUserId(user) || getUserEmail(user)}
                    >
                      {getUserName(user)}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div style={styles.assigneePanel}>
              <div style={styles.panelHeader}>
                <div>
                  <h3 style={styles.panelTitle}>Project Assignees</h3>
                  <p style={styles.panelSubtitle}>
                    Selected: {editProject.assignee_ids.length}
                  </p>
                </div>

                <div style={styles.modalSearchBox}>
                  <Search size={18} color="#64748b" />
                  <input
                    style={styles.searchInput}
                    value={editAssigneeSearch}
                    onChange={(event) =>
                      setEditAssigneeSearch(event.target.value)
                    }
                    placeholder="Search users..."
                  />
                </div>
              </div>

              <div style={styles.assigneeList}>
                {filteredEditAssignees.length === 0 ? (
                  <div style={styles.emptyColumn}>
                    No users found. The user must already exist in Users and must be returned by the admin users API.
                  </div>
                ) : (
                  filteredEditAssignees.map((user) => {
                    const userId = String(getUserId(user));
                    const checked = editProject.assignee_ids
                      .map(String)
                      .includes(userId);

                    return (
                      <label style={styles.assigneeRow} key={userId}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEditProjectAssignee(userId)}
                        />

                        <div style={styles.assigneeAvatar}>
                          {getInitials(getUserName(user))}
                        </div>

                        <div style={styles.assigneeInfo}>
                          <strong>{getUserName(user)}</strong>
                          <span>{getUserEmail(user)}</span>
                        </div>

                        <b style={styles.assigneeDept}>
                          {user.department_name || "-"}
                        </b>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <button
              type="button"
              style={styles.fullPrimaryButton}
              onClick={updateProject}
              disabled={actionLoading}
            >
              {actionLoading ? "Saving..." : "Save Project Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  page: {
    width: "100%",
    padding: 0,
    margin: 0,
  },

  topActions: {
    width: "100%",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "14px",
    marginBottom: "26px",
  },
refreshButton: {
  border: "none",
  background: "#ff5733",
  color: "#ffffff",
  borderRadius: "14px",
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(255, 87, 51, 0.22)",
},
  assignButton: {
  border: "none",
  background: "#ff5733",
  color: "#ffffff",
  borderRadius: "14px",
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(255, 87, 51, 0.22)",
},

  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#b91c1c",
    borderRadius: "18px",
    padding: "16px 20px",
    fontSize: "16px",
    fontWeight: 800,
    marginBottom: "22px",
  },

  successBox: {
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
    color: "#166534",
    borderRadius: "18px",
    padding: "16px 20px",
    fontSize: "16px",
    fontWeight: 800,
    marginBottom: "22px",
  },

  statsRow: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: "14px",
    marginBottom: "28px",
  },

  statCard: {
    minHeight: "94px",
    background: "#ffffff",
    border: "1px solid #eef2f7",
    borderRadius: "18px",
    padding: "18px 16px",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: "8px",
    overflow: "hidden",
  },

  statNumber: {
    color: "#111827",
    fontSize: "30px",
    fontWeight: 900,
    lineHeight: 1,
  },

  statLabel: {
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 900,
    lineHeight: 1.2,
    whiteSpace: "normal",
  },

  kanbanCard: {
    background: "#ffffff",
    borderRadius: "28px",
    padding: "20px",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
    overflow: "hidden",
  },

  kanbanHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 420px",
    gap: "20px",
    alignItems: "center",
    marginBottom: "24px",
  },

  sectionTitle: {
    margin: "0 0 8px",
    color: "#111827",
    fontSize: "30px",
    fontWeight: 900,
    lineHeight: 1.1,
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  sectionSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "16px",
    lineHeight: 1.45,
  },

  searchBox: {
    height: "50px",
    width: "420px",
    maxWidth: "420px",
    border: "1px solid #d6dde8",
    borderRadius: "16px",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "0 16px",
    overflow: "hidden",
    justifySelf: "end",
  },

  modalSearchBox: {
    height: "54px",
    minWidth: "360px",
    border: "1px solid #d6dde8",
    borderRadius: "16px",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "0 18px",
  },

  searchInput: {
    width: "100%",
    height: "100%",
    border: "none",
    outline: "none",
    boxShadow: "none",
    background: "transparent",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 800,
    padding: 0,
  },

  kanbanScroll: {
  width: "100%",
  overflowX: "auto",
  overflowY: "hidden",
  paddingBottom: "10px",
},

  kanbanBoard: {
  display: "grid",
  gridTemplateColumns: "repeat(6, calc((100vw - 470px) / 3))",
  gap: "20px",
  width: "max-content",
},

 kanbanColumn: {
  width: "calc((100vw - 470px) / 3)",
  height: "660px",
  minHeight: "660px",
  maxHeight: "660px",

  boxSizing: "border-box",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "22px",
  padding: "18px",

  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
},

  columnHeader: {
    minHeight: "96px",
    background: "#f8fafc",
    borderRadius: "20px",
    padding: "18px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "18px",
  },

  columnTitle: {
    margin: "0 0 10px",
    color: "#111827",
    fontSize: "23px",
    fontWeight: 900,
    lineHeight: 1.1,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  columnSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "15px",
    fontWeight: 600,
  },

  columnCount: {
    width: "48px",
    height: "48px",
    minWidth: "48px",
    borderRadius: "50%",
    background: "#e5e7eb",
    color: "#111827",
    display: "grid",
    placeItems: "center",
    fontSize: "16px",
    fontWeight: 900,
  },

  columnBody: {
  display: "flex",
  flexDirection: "column",
  gap: "12px",

  flex: 1,
  minHeight: 0,

  overflowY: "auto",
  overflowX: "hidden",

  paddingRight: "6px",
},

  emptyColumn: {
    border: "1px dashed #cbd5e1",
    borderRadius: "18px",
    padding: "28px 18px",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: "15px",
    fontWeight: 900,
    background: "#f8fafc",
  },

  projectTile: {
    width: "100%",
    minHeight: "84px",
    height: "84px",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: "18px",
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    cursor: "pointer",
    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.04)",
    textAlign: "left",
    overflow: "hidden",
  },

  projectTileTitle: {
    width: "100%",
    color: "#111827",
    fontSize: "18px",
    fontWeight: 900,
    lineHeight: 1.2,
    wordBreak: "break-word",
    textAlign: "left",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.68)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "36px",
  },

  modal: {
    position: "relative",
    width: "min(1250px, 96vw)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: "26px",
    padding: "34px",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)",
  },

  closeButton:{
 position:"absolute",
 top:"20px",
 right:"20px",
 width:"52px",
 height:"52px",
 borderRadius:"16px",
 border:"none",
 background:"#111827",
 color:"#ffffff",
 display:"grid",
 placeItems:"center",
 cursor:"pointer",
 zIndex:1000,
},

floatingCloseLayer: {
  position: "absolute",
  top: "20px",
  right: "20px",
  zIndex: 1000,
  height: "52px",
  width: "52px",
  pointerEvents: "none",
},
  modalTitle: {
    margin: "0 0 10px",
    color: "#111827",
    fontSize: "34px",
    fontWeight: 900,
    lineHeight: 1.1,
    paddingRight: "70px",
  },

  modalSubtitle: {
    margin: "0 0 26px",
    color: "#64748b",
    fontSize: "16px",
    lineHeight: 1.5,
  },

  projectModalNormalHeader: {
    background: "#ffffff",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "20px",
    padding: "0 88px 24px 0",
    marginBottom: "22px",
    borderBottom: "1px solid #eef2f7",
  },

  projectModalTitleBlock: {
    minWidth: 0,
    flex: 1,
  },

  projectModalEditButton: {
    height: "52px",
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#ff5733",
    borderRadius: "16px",
    padding: "0 20px",
    fontSize: "15px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "9px",
    cursor: "pointer",
    flexShrink: 0,
  },

projectModalCloseButton: {
  width: "52px",
  height: "52px",
  minWidth: "52px",
  borderRadius: "14px",
  border: "none",
  background: "#111827",
  color: "#ffffff",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(15,23,42,0.15)",
  pointerEvents: "auto",
},
  editProjectOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.76)",
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "36px",
  },

  editProjectModal: {
    position: "relative",
    width: "min(1180px, 94vw)",
    maxHeight: "88vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: "26px",
    padding: "34px",
    boxShadow: "0 26px 70px rgba(15, 23, 42, 0.34)",
  },

  editProjectNormalHeader: {
    background: "#ffffff",
    padding: "0 88px 22px 0",
    marginBottom: "20px",
    borderBottom: "1px solid #eef2f7",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "18px",
    marginBottom: "18px",
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "18px",
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "18px",
    marginBottom: "22px",
  },

  detailBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "20px 22px",
    minHeight: "112px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: "8px",
    minWidth: 0,
    overflow: "hidden",
  },

  detailLabel: {
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 900,
    lineHeight: 1.2,
    margin: 0,
    padding: 0,
    display: "block",
  },

  detailValue: {
    color: "#111827",
    fontSize: "17px",
    fontWeight: 900,
    lineHeight: 1.3,
    margin: 0,
    padding: 0,
    display: "block",
    maxWidth: "100%",
    overflowWrap: "break-word",
    wordBreak: "break-word",
  },

  detailEmail: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.35,
    margin: 0,
    padding: 0,
    maxWidth: "100%",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  detailDateValue: {
    color: "#111827",
    fontSize: "16px",
    fontWeight: 900,
    lineHeight: 1.35,
    margin: 0,
    padding: 0,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "7px",
    maxWidth: "100%",
    overflowWrap: "break-word",
    wordBreak: "break-word",
  },

  detailDateSeparator: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 900,
  },

  progressBox: {
    background: "#fff7f5",
    border: "1px solid #fecaca",
    borderRadius: "18px",
    padding: "18px",
    marginBottom: "22px",
  },

  progressTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "12px",
  },

  progressTrack: {
    height: "10px",
    background: "#ffd5cc",
    borderRadius: "999px",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    background: "#ff5733",
    borderRadius: "999px",
  },

  reviewActionSection: {
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: "20px",
  padding: "20px",
  marginBottom: "24px",
},

reviewActionHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "16px",
},

reviewActionTitle: {
  margin: "0 0 6px",
  color: "#111827",
  fontSize: "22px",
  fontWeight: 900,
},

reviewActionSubtitle: {
  margin: 0,
  color: "#64748b",
  fontSize: "14px",
  fontWeight: 700,
},

reviewInlineError: {
  background: "#fff1f2",
  border: "1px solid #fecdd3",
  color: "#b91c1c",
  borderRadius: "14px",
  padding: "12px 14px",
  marginBottom: "14px",
  fontSize: "14px",
  fontWeight: 800,
},

reviewInlineSuccess: {
  background: "#dcfce7",
  border: "1px solid #bbf7d0",
  color: "#166534",
  borderRadius: "14px",
  padding: "12px 14px",
  marginBottom: "14px",
  fontSize: "14px",
  fontWeight: 800,
},

reviewRemarkField: {
  display: "flex",
  flexDirection: "column",
  gap: "9px",
  marginBottom: "16px",
  color: "#111827",
  fontSize: "14px",
  fontWeight: 900,
},

reviewActionButtons: {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
},

approveButton: {
  border: "none",
  background: "#16a34a",
  color: "#ffffff",
  borderRadius: "14px",
  padding: "13px 20px",
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
},

holdButton: {
  border: "none",
  background: "#111827",
  color: "#ffffff",
  borderRadius: "14px",
  padding: "13px 20px",
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
},

rejectButton: {
  border: "none",
  background: "#dc2626",
  color: "#ffffff",
  borderRadius: "14px",
  padding: "13px 20px",
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
},

disabledReviewButton: {
  opacity: 0.65,
  cursor: "not-allowed",
},

  editSection: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "22px",
    padding: "22px",
    marginBottom: "24px",
  },

  sectionRowHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "18px",
    marginBottom: "18px",
  },

  modalSectionTitle: {
    margin: "0 0 18px",
    color: "#111827",
    fontSize: "26px",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  dangerButton: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    borderRadius: "14px",
    padding: "12px 18px",
    fontSize: "15px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },

  selectedAssigneePreview: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: "20px",
    padding: "20px",
    marginBottom: "18px",
  },

  selectedAssigneeChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "14px",
  },

  selectedAssigneeChip: {
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: 900,
  },

  noAssigneeText: {
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 800,
  },

  assigneePanel: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "22px",
    padding: "22px",
    marginBottom: "22px",
  },

  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "18px",
    marginBottom: "18px",
  },

  panelTitle: {
    margin: "0 0 8px",
    color: "#111827",
    fontSize: "24px",
    fontWeight: 900,
  },

  panelSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: 1.45,
  },

  assigneeList: {
    maxHeight: "360px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  assigneeRow: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "16px 18px",
    display: "grid",
    gridTemplateColumns: "24px 54px 1fr auto",
    alignItems: "center",
    gap: "14px",
    cursor: "pointer",
  },

  assigneeAvatar: {
    width: "54px",
    height: "54px",
    borderRadius: "16px",
    background: "#111827",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    fontSize: "17px",
    fontWeight: 900,
  },

  assigneeInfo: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },

  assigneeDept: {
    color: "#111827",
    fontSize: "14px",
    fontWeight: 900,
  },
  assignFooterButton:{
  flex:1,
},

  fullPrimaryButton: {
     width:"auto",
  minWidth:"220px",
    minHeight: "56px",
    border: "none",
    borderRadius: "16px",
    background: "#ff5733",
    color: "#ffffff",
    fontSize: "17px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    cursor: "pointer",
  },

  taskAssigneeList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "18px",
  },

  taskAssigneeRow: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "14px",
    display: "grid",
    gridTemplateColumns: "24px 1fr auto",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer",
  },

  mainTaskList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },

  mainTaskCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px",
    background: "#ffffff",
  },

  mainTaskTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "14px",
    marginBottom: "12px",
  },

  mainTaskTextBlock: {
    minWidth: 0,
    flex: 1,
  },

  mainTaskDateLine: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 16px",
    marginTop: "10px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 800,
  },

  mainTaskActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },

  taskStatusBadge: {
    height: "38px",
    borderRadius: "999px",
    padding: "0 14px",
    background: "#eef2ff",
    color: "#334155",
    display: "inline-flex",
    alignItems: "center",
    fontSize: "13px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  smallEditButton: {
    height: "38px",
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#ff5733",
    borderRadius: "999px",
    padding: "0 14px",
    fontSize: "13px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    cursor: "pointer",
  },

  mainTaskEditBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px",
  },

  editTaskAssigneeBox: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
    marginBottom: "16px",
  },

  editTaskAssigneeTitle: {
    display: "block",
    color: "#111827",
    fontSize: "15px",
    fontWeight: 900,
    marginBottom: "12px",
  },

  editTaskButtonsRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "12px",
  },

  cancelEditTaskButton: {
    height: "46px",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#111827",
    borderRadius: "14px",
    padding: "0 20px",
    fontSize: "15px",
    fontWeight: 900,
    cursor: "pointer",
  },

  saveEditTaskButton: {
    height: "46px",
    border: "none",
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "14px",
    padding: "0 22px",
    fontSize: "15px",
    fontWeight: 900,
    cursor: "pointer",
  },

  taskChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "12px",
  },

  chip: {
    background: "#eef2ff",
    color: "#334155",
    borderRadius: "999px",
    padding: "7px 11px",
    fontSize: "12px",
    fontWeight: 900,
  },
exportButton: {
  border: "1px solid #111827",
  background: "#111827",
  color: "#ffffff",
  borderRadius: "14px",
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  cursor: "pointer",
  boxShadow: "0 10px 22px rgba(15, 23, 42, 0.14)",
},
modalFooter:{
  display:"flex",
  justifyContent:"flex-end",
  alignItems:"center",
  gap:"14px",
  marginTop:"30px",
  paddingTop:"20px",
  borderTop:"1px solid #e5e7eb",
},

cancelModalButton: {
  height: "48px",
  padding: "0 28px",
  borderRadius: "14px",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: "15px",
  fontWeight: 900,
  cursor: "pointer",
},
assignModal:{
  position:"relative",
  width:"min(1250px, 96vw)",
  maxHeight:"90vh",
  background:"#ffffff",
  borderRadius:"26px",
  padding:"34px",
  boxShadow:"0 24px 60px rgba(15,23,42,0.28)",
  overflowY:"auto",
},
};

export default AdminProjects;