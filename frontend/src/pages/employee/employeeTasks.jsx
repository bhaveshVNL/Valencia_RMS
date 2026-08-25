import { useEffect, useMemo, useState } from "react";
import EmployeeMiniTasks from "../../components/MiniTasks/EmployeeMiniTasks";
import {
  ArrowUpDown,
  CheckCircle2,
  Filter,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import api from "../../api/axios";

const DAY_MS = 24 * 60 * 60 * 1000;

const asArray = (value) => (Array.isArray(value) ? value : []);

const getResponseData = (response) => {
  return response?.data?.data || response?.data || {};
};

const normalizeStatus = (status, progress = 0) => {
  const value = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (["todo", "to_do", "pending", "not_started", ""].includes(value)) {
    return "not_started";
  }
  if (["ongoing", "in_progress", "progress"].includes(value)) return "ongoing";
  if (["under_review", "review"].includes(value)) return "under_review";
  if (["completed", "done", "complete"].includes(value)) return "completed";
  if (["rejected", "reject"].includes(value)) return "rejected";
  if (["on_hold", "hold"].includes(value)) return "on_hold";

  return value || "not_started";
};

const formatStatus = (status, progress = 0) => {
  const value = normalizeStatus(status, progress);

  if (value === "not_started") return "To Do";
  if (value === "ongoing") return "In Progress";
  if (value === "under_review") return "Under Review";
  if (value === "completed") return "Done";
  if (value === "rejected") return "Rejected";
  if (value === "on_hold") return "On Hold";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatDateForInput = (dateValue) => {
  if (!dateValue) return "";

  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, "0");
    const day = String(dateValue.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const value = String(dateValue).trim();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateValue) => {
  const normalized = formatDateForInput(dateValue);
  if (!normalized) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

const formatDisplayDate = (dateValue) => {
  const date = parseLocalDate(dateValue);
  if (!date) return "-";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const parseDateTime = (value) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getTaskId = (task) => {
  return task?.task_id || task?.main_task_id || task?.id;
};

const getSubtaskId = (subtask) => {
  return subtask?.task_id || subtask?.subtask_id || subtask?.id;
};

const getTaskTitle = (task) => {
  return task?.task_title || task?.main_task_title || task?.title || "Main Task";
};

const getTaskDescription = (task) => {
  return task?.task_description || task?.description || task?.main_task_description || "-";
};

const getProjectTitle = (task) => {
  return task?.project_title || task?.project_name || "-";
};

const getTaskStartDate = (task) => {
  return formatDateForInput(task?.start_date || task?.task_start_date);
};

const getTaskEndDate = (task) => {
  return formatDateForInput(task?.due_date || task?.end_date || task?.task_end_date);
};
const getSubtaskAssignedByName = (subtask) => {
  return (
    subtask?.assigned_by_name ||
    subtask?.created_by_name ||
    subtask?.assigned_by ||
    subtask?.created_by ||
    "-"
  );
};
const getAssignedByName = (task) => {
  return (
    task?.created_by_name ||
    task?.assigned_by_name ||
    task?.admin_name ||
    task?.created_by ||
    "-"
  );
};

const getAssignedByEmail = (task) => {
  return (
    task?.created_by_email ||
    task?.assigned_by_email ||
    task?.admin_email ||
    ""
  );
};

const getTaskProgress = (task) => {
  return Number(task?.progress ?? task?.task_progress ?? task?.overall_progress ?? 0);
};



const getTaskAssignedAt = (task) => {
  return (
    task?.assigned_at ||
    task?.assigned_date ||
    task?.created_at ||
    task?.task_created_at ||
    ""
  );
};

const getTaskUpdatedAt = (task) => {
  return (
    task?.updated_at ||
    task?.task_updated_at ||
    task?.modified_at ||
    task?.created_at ||
    ""
  );
};

const getDeadlineInfo = (task) => {
  const status = normalizeStatus(task?.status, task?.progress);

  if (status === "completed") {
    return { label: "Completed", tone: "done", days: null };
  }

  if (status === "rejected") {
    return { label: "Rejected", tone: "muted", days: null };
  }

  if (status === "on_hold") {
    return { label: "On Hold", tone: "muted", days: null };
  }

  const dueDate = parseLocalDate(task?.due_date);
  if (!dueDate) {
    return { label: "No Deadline", tone: "muted", days: null };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((dueDate.getTime() - today.getTime()) / DAY_MS);

  if (days < 0) {
    const overdueDays = Math.abs(days);
    return {
      label: `${overdueDays} ${overdueDays === 1 ? "Day" : "Days"} Overdue`,
      tone: "danger",
      days,
    };
  }

  if (days === 0) {
    return { label: "Due Today", tone: "danger", days };
  }

  if (days === 1) {
    return { label: "1 Day Left", tone: "urgent", days };
  }

  if (days === 2) {
    return { label: "2 Days Left", tone: "urgent", days };
  }

  return { label: `${days} Days Left`, tone: "normal", days };
};

const isUrgentTask = (task) => {
  const status = normalizeStatus(task?.status, task?.progress);
  if (["completed", "rejected", "on_hold"].includes(status)) return false;

  
  const deadline = getDeadlineInfo(task);
  return deadline.days !== null && deadline.days <= 2;
};


const normalizeSubtask = (subtask) => {
  const progress = Number(subtask?.progress || 0);
  const status = normalizeStatus(subtask?.status, progress);
  const checked =
    Number(subtask?.is_checked || 0) === 1 ||
    Boolean(subtask?.checked) ||
    status === "completed";

  return {
    ...subtask,
    task_id: getSubtaskId(subtask),
    task_title:
      subtask?.task_title || subtask?.subtask_title || subtask?.title || "Subtask",
    task_description:
      subtask?.task_description ||
      subtask?.subtask_description ||
      subtask?.description ||
      "",
    start_date: formatDateForInput(subtask?.start_date || subtask?.task_start_date),
    due_date: formatDateForInput(
      subtask?.due_date || subtask?.end_date || subtask?.task_end_date
    ),
    status: checked ? "completed" : status,
    is_checked: checked ? 1 : 0,
  };
};

const normalizeMainTask = (task) => {
  const subtasks = asArray(
    task?.subtasks ||
    task?.project_subtasks ||
    task?.children ||
    task?.sub_tasks ||
    task?.main_subtasks
  ).map(normalizeSubtask);

  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter(
    (subtask) => Number(subtask.is_checked) === 1
  ).length;

  const backendProgress = getTaskProgress(task);
  const calculatedProgress =
    totalSubtasks > 0
      ? Math.round((completedSubtasks / totalSubtasks) * 100)
      : backendProgress;

  const finalProgress = Number.isFinite(calculatedProgress) ? calculatedProgress : 0;
  const status = normalizeStatus(task?.status || task?.main_task_status, finalProgress);

  return {
    ...task,
    rejection_reason: task?.rejection_reason || task?.review_note || "",
    task_id: getTaskId(task),
    task_title: getTaskTitle(task),
    task_description: getTaskDescription(task),
    project_title: getProjectTitle(task),
    start_date: getTaskStartDate(task),
    due_date: getTaskEndDate(task),
    created_by_name: getAssignedByName(task),
    created_by_email: getAssignedByEmail(task),
    assigned_at: getTaskAssignedAt(task),
    updated_at: getTaskUpdatedAt(task),
    status,
    progress: finalProgress,
    subtasks,
    total_subtasks: totalSubtasks,
    completed_subtasks: completedSubtasks,
    work_state: task?.work_state || "stopped",
  };
};

const parseTasksFromResponse = (response) => {
  const data = getResponseData(response);

  const taskList =
    data.main_tasks ||
    data.mainTasks ||
    data.tasks ||
    data.my_tasks ||
    data.assigned_tasks ||
    data.assignedTasks ||
    data;

  return asArray(taskList).map(normalizeMainTask);
};

const BASE_COLUMNS = [
  {
    key: "not_started",
    title: "To Do",
    subtitle: "Main tasks that have not started",
  },
  {
    key: "ongoing",
    title: "In Progress",
    subtitle: "Main tasks currently being worked on",
  },
  {
    key: "under_review",
    title: "Under Review",
    subtitle: "Main tasks waiting for admin review",
  },
  {
    key: "completed",
    title: "Done",
    subtitle: "Completed main tasks",
  },
];

const SPECIAL_COLUMNS = {
  rejected: {
    key: "rejected",
    title: "Rejected",
    subtitle: "Tasks rejected during review",
  },
  on_hold: {
    key: "on_hold",
    title: "On Hold",
    subtitle: "Tasks temporarily paused",
  },
};

const STATUS_SORT_RANK = {
  not_started: 0,
  ongoing: 1,
  under_review: 2,
  completed: 3,
  rejected: 4,
  on_hold: 5,
};


const EmployeeTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [mainTasks, setMainTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [taskFilter, setTaskFilter] = useState("all");
  const [sortBy, setSortBy] = useState("deadline");
  const [loading, setLoading] = useState(false);
  const [savingSubtask, setSavingSubtask] = useState(false);
  const [taskActionId, setTaskActionId] = useState(null);
  const [confirmSubtask, setConfirmSubtask] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  const storedCurrentUser = (() => {
  try {
    return JSON.parse(
      sessionStorage.getItem("user") ||
        localStorage.getItem("user") ||
        "{}"
    );
  } catch {
    return {};
  }
})();

const currentUserId = Number(
  storedCurrentUser?.user_id ||
    storedCurrentUser?.id ||
    0
);

  const [subtaskForm, setSubtaskForm] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
  });

  const shouldTryNextEndpoint = (err) => {
    const status = err?.response?.status;
    return status === 404 || status === 405;
  };

  const callFirstWorkingGet = async (urls) => {
    let lastError;

    for (const url of urls) {
      try {
        return await api.get(url);
      } catch (err) {
        lastError = err;
        if (!shouldTryNextEndpoint(err)) throw err;
      }
    }

    throw lastError;
  };

  const callFirstWorkingPost = async (urls, payload) => {
    let lastError;

    for (const url of urls) {
      try {
        return await api.post(url, payload);
      } catch (err) {
        lastError = err;
        if (!shouldTryNextEndpoint(err)) throw err;
      }
    }

    throw lastError;
  };

  const callFirstWorkingPatch = async (urls, payload) => {
    let lastError;

    for (const item of urls) {
      try {
        if (item.method === "put") {
          return await api.put(item.url, payload);
        }

        if (item.method === "post") {
          return await api.post(item.url, payload);
        }

        return await api.patch(item.url, payload);
      } catch (err) {
        lastError = err;
        if (!shouldTryNextEndpoint(err)) throw err;
      }
    }

    throw lastError;
  };

  const fetchTasks = async () => {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await callFirstWorkingGet([
        "/employee-tasks",
        "/employee-tasks/my",
        "/employee/tasks",
        "/employee/tasks/my",
        "/employee/main-tasks",
      ]);

      setMainTasks(parseTasksFromResponse(response));
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to fetch assigned tasks."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskDetails = async (task) => {
    const taskId = getTaskId(task);
    setModalError("");
    setModalSuccess("");

    if (!taskId) {
      setSelectedTask(normalizeMainTask(task));
      return;
    }

    try {
      const response = await callFirstWorkingGet([
        `/employee-tasks/${taskId}`,
        `/employee-tasks/${taskId}/details`,
        `/employee/tasks/${taskId}`,
        `/employee/tasks/${taskId}/details`,
      ]);

      const data = getResponseData(response);
      const taskData =
        data.task ||
        data.main_task ||
        data.mainTask ||
        data.task_details ||
        data.details ||
        data;

      setSelectedTask(normalizeMainTask({ ...task, ...taskData }));
    } catch (err) {
      setSelectedTask(normalizeMainTask(task));
      setModalError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Could not refresh task details. Showing the last loaded data."
      );
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filterCounts = useMemo(() => {
    return mainTasks.reduce(
      (counts, task) => {
        const status = normalizeStatus(task.status, task.progress);

        if (isUrgentTask(task)) counts.urgent += 1;
        if (status === "rejected") counts.rejected += 1;
        if (status === "on_hold") counts.on_hold += 1;

        return counts;
      },
      {
        all: mainTasks.length,
        urgent: 0,
        rejected: 0,
        on_hold: 0,
      }
    );
  }, [mainTasks]);

  const filteredTasks = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return mainTasks.filter((task) => {
      const status = normalizeStatus(task.status, task.progress);

      const matchesFilter =
        taskFilter === "all" ||
        (taskFilter === "urgent" && isUrgentTask(task)) ||
        (taskFilter === "rejected" && status === "rejected") ||
        (taskFilter === "on_hold" && status === "on_hold");

      if (!matchesFilter) return false;

      const searchableText = [
        task.task_title,
        task.task_description,
        task.project_title,
        task.created_by_name,
        task.created_by_email,
        formatStatus(task.status, task.progress),
        getDeadlineInfo(task).label,
      ]
        .join(" ")
        .toLowerCase();

      return !query || searchableText.includes(query);
    });
  }, [mainTasks, searchText, taskFilter]);

  const sortedTasks = useMemo(() => {
    const tasks = [...filteredTasks];

    tasks.sort((a, b) => {
     

      if (sortBy === "status") {
        const statusDifference =
          (STATUS_SORT_RANK[normalizeStatus(a.status, a.progress)] ?? 99) -
          (STATUS_SORT_RANK[normalizeStatus(b.status, b.progress)] ?? 99);

        if (statusDifference !== 0) return statusDifference;
      }

      if (sortBy === "recent_assigned") {
        const assignedDifference =
          parseDateTime(getTaskAssignedAt(b)) - parseDateTime(getTaskAssignedAt(a));

        if (assignedDifference !== 0) return assignedDifference;
        return Number(getTaskId(b) || 0) - Number(getTaskId(a) || 0);
      }

      if (sortBy === "recent_updated") {
        const updatedDifference =
          parseDateTime(getTaskUpdatedAt(b)) - parseDateTime(getTaskUpdatedAt(a));

        if (updatedDifference !== 0) return updatedDifference;
        return Number(getTaskId(b) || 0) - Number(getTaskId(a) || 0);
      }

      const aDue = parseLocalDate(a.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDue = parseLocalDate(b.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const deadlineDifference = aDue - bDue;

      if (deadlineDifference !== 0) return deadlineDifference;
      return Number(getTaskId(b) || 0) - Number(getTaskId(a) || 0);
    });

    return tasks;
  }, [filteredTasks, sortBy]);

  const visibleColumns = useMemo(() => {
    if (taskFilter === "rejected") return [SPECIAL_COLUMNS.rejected];
    if (taskFilter === "on_hold") return [SPECIAL_COLUMNS.on_hold];
    if (taskFilter === "urgent") return BASE_COLUMNS.slice(0, 3);

    const columns = [...BASE_COLUMNS];

    if (filterCounts.rejected > 0) columns.push(SPECIAL_COLUMNS.rejected);
    if (filterCounts.on_hold > 0) columns.push(SPECIAL_COLUMNS.on_hold);

    return columns;
  }, [taskFilter, filterCounts.rejected, filterCounts.on_hold]);

  const groupedTasks = useMemo(() => {
    const grouped = {
      not_started: [],
      ongoing: [],
      under_review: [],
      completed: [],
      rejected: [],
      on_hold: [],
    };

    sortedTasks.forEach((task) => {
      const status = normalizeStatus(task.status, task.progress);
      if (grouped[status]) grouped[status].push(task);
    });

    return grouped;
  }, [sortedTasks]);

  const validateSubtaskForm = () => {
    const title = subtaskForm.title.trim();

    if (!title) return "Subtask title is required.";

    if (!subtaskForm.start_date || !subtaskForm.end_date) {
      return "Subtask start date and end date are required.";
    }

    if (subtaskForm.start_date > subtaskForm.end_date) {
      return "Subtask start date cannot be after the end date.";
    }

    const mainStartDate = selectedTask?.start_date;
    const mainEndDate = selectedTask?.due_date;

    if (mainStartDate && subtaskForm.start_date < mainStartDate) {
      return `Subtask start date cannot be before ${formatDisplayDate(mainStartDate)}.`;
    }

    if (mainEndDate && subtaskForm.end_date > mainEndDate) {
      return `Subtask deadline cannot exceed the parent task deadline (${formatDisplayDate(
        mainEndDate
      )}).`;
    }

    return "";
  };

  const addSubtask = async (event) => {
    event?.preventDefault?.();

    if (!selectedTask?.task_id || savingSubtask) return;

    setModalError("");
    setModalSuccess("");

    const validationError = validateSubtaskForm();
    if (validationError) {
      setModalError(validationError);
      return;
    }

    setSavingSubtask(true);

    try {
      const payload = {
        task_title: subtaskForm.title.trim(),
        title: subtaskForm.title.trim(),
        subtask_title: subtaskForm.title.trim(),
        task_description: subtaskForm.description.trim(),
        description: subtaskForm.description.trim(),
        subtask_description: subtaskForm.description.trim(),
        start_date: subtaskForm.start_date,
        due_date: subtaskForm.end_date,
        end_date: subtaskForm.end_date,
      };

      await callFirstWorkingPost(
        [
          `/employee-tasks/${selectedTask.task_id}/subtasks`,
          `/employee-tasks/tasks/${selectedTask.task_id}/subtasks`,
          `/employee/tasks/${selectedTask.task_id}/subtasks`,
          `/employee/tasks/${selectedTask.task_id}/subtasks/add`,
        ],
        payload
      );

      setSubtaskForm({
        title: "",
        description: "",
        start_date: "",
        end_date: "",
      });

      setModalSuccess("Subtask added successfully.");

    await fetchTasks();

if (selectedTask) {
  await fetchTaskDetails({
    ...selectedTask,
    task_id: selectedTask.task_id,
  });
}

setModalSuccess(
  "Subtask added successfully."
);

    } catch (err) {
      setModalError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to add subtask."
      );
    } finally {
      setSavingSubtask(false);
    }
  };

    const requestMarkSubtaskDone = (subtask) => {
  const subtaskId = getSubtaskId(subtask);

  if (!subtaskId || Number(subtask.is_checked) === 1) return;

  setModalError("");
  setModalSuccess("");
  setConfirmSubtask(subtask);
};


const confirmMarkSubtaskDone = async () => {
  if (!confirmSubtask) return;

  const subtaskId = getSubtaskId(confirmSubtask);

  try {
    await callFirstWorkingPatch(
      [
        { method: "patch", url: `/employee-tasks/subtasks/${subtaskId}/check` },
        { method: "put", url: `/employee-tasks/subtasks/${subtaskId}/check` },
        { method: "patch", url: `/employee/tasks/subtasks/${subtaskId}/check` },
        { method: "put", url: `/employee/tasks/subtasks/${subtaskId}/check` },
        { method: "put", url: `/employee/tasks/${subtaskId}/check` },
      ],
      {
        is_checked: true,
        checked: true,
        status: "completed",
      }
    );

    await fetchTasks();

if (selectedTask) {
  await fetchTaskDetails(
    selectedTask
  );

  setModalSuccess(
    "Subtask marked as done."
  );
} else {
  setSuccessMessage(
    "Subtask marked as done."
  );
}
  } catch (err) {
    setModalError(
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "Failed to update subtask."
    );
  } finally {
    // IMPORTANT RESET
    setConfirmSubtask(null);
  }
};
    const handleTaskAction = async (task, action) => {
    const taskId = getTaskId(task);
    if (!taskId || taskActionId) return;

    setError("");
    setSuccessMessage("");
    setTaskActionId(taskId);

    try {
      let endpoint = "";

      if (action === "start") endpoint = `/employee-tasks/${taskId}/start`;
      if (action === "pause") endpoint = `/employee-tasks/${taskId}/pause`;
      if (action === "resume") endpoint = `/employee-tasks/${taskId}/resume`;
      if (action === "submit-review") {
        endpoint = `/employee-tasks/${taskId}/submit-review`;
      }

      if (!endpoint) return;

      const response = await api.post(endpoint);

      setSuccessMessage(
        response.data?.message || "Task updated successfully."
      );

      await fetchTasks();

      if (
        selectedTask &&
        String(getTaskId(selectedTask)) === String(taskId)
      ) {
        await fetchTaskDetails({
          ...selectedTask,
          task_id: taskId,
        });
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to update task."
      );
    } finally {
      setTaskActionId(null);
    }
  };


  const closeModal = () => {
    setSelectedTask(null);
    setSubtaskForm({
      title: "",
      description: "",
      start_date: "",
      end_date: "",
    });
    setModalError("");
    setModalSuccess("");
  };

  const selectedTaskStatus = selectedTask
    ? normalizeStatus(selectedTask.status, selectedTask.progress)
    : "";

  const canAddSubtask =
    selectedTask &&
    !["under_review", "completed", "rejected", "on_hold"].includes(
      selectedTaskStatus
    );

  return (
    <div style={styles.page}>
      <div style={styles.taskToolbar}>
        <div style={styles.kanbanSearchBox}>
          <Search size={18} color="#64748b" />
          <input
            style={styles.searchInput}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search project, task, admin..." />
        </div>

        <div style={styles.controlGroup}>
          <div style={styles.selectWrap}>
            <Filter size={17} color="#64748b" />
            <select
              style={styles.selectControl}
              value={taskFilter}
              onChange={(event) => setTaskFilter(event.target.value)}
              aria-label="Filter tasks"
            >
              <option value="all">All ({filterCounts.all})</option>
              <option value="rejected">Rejected ({filterCounts.rejected})</option>
              <option value="on_hold">On Hold ({filterCounts.on_hold})</option>
            </select>
          </div>

          <div style={styles.selectWrap}>
            <ArrowUpDown size={17} color="#64748b" />
            <select
              style={styles.selectControl}
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              aria-label="Sort tasks"
            >
              <option value="deadline">Deadline</option>
              <option value="recent_assigned">Recently Assigned</option>
              <option value="recent_updated">Recently Updated</option>
            </select>
          </div>

          <button
            type="button"
            style={styles.refreshBtn}
            onClick={fetchTasks}
            disabled={loading}
          >
            <RefreshCw size={17} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}
      {successMessage && <div style={styles.successBox}>{successMessage}</div>}

      {loading && mainTasks.length === 0 && (
  <div style={styles.loadingNotice}>Loading tasks...</div>
)}

<section
  style={styles.kanbanRow}
  className="employee-kanban-scroll"
>
  {visibleColumns.map((column) => (
    <div style={styles.kanbanColumn} key={column.key}>
      <div style={styles.kanbanHeader}>
        <div style={{ minWidth: 0 }}>
          <h2 style={styles.kanbanTitle}>{column.title}</h2>
          <p style={styles.kanbanSubtitle}>{column.subtitle}</p>
        </div>

        <span style={styles.kanbanCount}>
          {groupedTasks[column.key]?.length || 0}
        </span>
      </div>

      <div style={styles.kanbanBody}>
        {groupedTasks[column.key]?.length === 0 ? (
          <div style={styles.emptyKanbanColumn}>
            No tasks here.
          </div>
        ) : (
          groupedTasks[column.key].map((task) => {
            const deadline = getDeadlineInfo(task);

            return (
  <div
    role="button"
    tabIndex={0}
    style={styles.kanbanTaskCard}
    key={task.task_id}
    onClick={() => fetchTaskDetails(task)}
    onKeyDown={(event) => {
      if (
        event.target !==
        event.currentTarget
      ) {
        return;
      }

      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();

        fetchTaskDetails(task);
      }
    }}
  >
                <div style={styles.kanbanTaskTop}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={styles.kanbanTaskTitle}>
                      {task.task_title}
                    </h3>
                  </div>

                  <span
                    style={{
                      ...styles.statusBadge,
                      ...getStatusBadgeStyle(
                        task.status,
                        task.progress
                      ),
                    }}
                  >
                    {formatStatus(task.status, task.progress)}
                  </span>
                </div>

                <p style={styles.kanbanTaskDescription}>
                  {task.task_description || "-"}
                </p>

                <div style={styles.cardBadgeRow}>
                  <span
                    style={{
                      ...styles.deadlineBadge,
                      ...getDeadlineBadgeStyle(deadline.tone),
                    }}
                  >
                    {deadline.label}
                  </span>
                </div>

                <div style={styles.kanbanMetaLine}>
                  <span>Assigned by</span>
                  <strong>{getAssignedByName(task)}</strong>
                </div>

                <div style={styles.kanbanDates}>
                  <span>
                    {formatDisplayDate(task.start_date)}
                  </span>

                  <span>→</span>

                  <span>
                    {formatDisplayDate(task.due_date)}
                  </span>
                </div>

                <div style={styles.progressMeta}>
                  <strong>
                    {task.total_subtasks > 0
                      ? `${task.completed_subtasks}/${task.total_subtasks} subtasks`
                      : "No subtasks"}
                  </strong>

                  <strong>{task.progress}%</strong>
                </div>

                <div style={styles.progressTrack}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${Math.min(
                        100,
                        Math.max(0, task.progress)
                      )}%`,
                    }}
                  />
                </div>

                {normalizeStatus(
  task.status,
  task.progress
) === "ongoing" &&
  Array.isArray(task.subtasks) &&
  task.subtasks.length > 0 && (
    <div
      style={styles.quickSubtasksBox}
      onClick={(event) =>
        event.stopPropagation()
      }
    >
      <div
        style={styles.quickSubtasksHeader}
      >
        <strong>Subtasks</strong>

        <span>
          {task.completed_subtasks}/
          {task.total_subtasks}
        </span>
      </div>

      <div
        style={styles.quickSubtasksList}
      >
        {task.subtasks.map(
          (subtask) => {
            const checked =
              Number(
                subtask.is_checked
              ) === 1;

            const canModify =
              Number(
                subtask.assigned_to_user_id
              ) === currentUserId;

            return (
              <label
                key={subtask.task_id}
                style={{
                  ...styles.quickSubtaskRow,

                  ...(checked
                    ? styles.quickSubtaskDone
                    : {}),
                }}
                onClick={(event) =>
                  event.stopPropagation()
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={
                    checked ||
                    !canModify
                  }
                  style={
                    styles.quickCheckbox
                  }
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                  onChange={(event) => {
                    event.stopPropagation();

                    if (
                      checked ||
                      !canModify
                    ) {
                      return;
                    }

                    requestMarkSubtaskDone(
                      subtask
                    );
                  }}
                />

                <span
                  style={{
                    ...styles.quickSubtaskTitle,

                    ...(checked
                      ? styles.quickSubtaskTitleDone
                      : {}),
                  }}
                >
                  {subtask.task_title}
                </span>

                {checked && (
                  <span
                    style={
                      styles.quickDoneText
                    }
                  >
                    Done
                  </span>
                )}
              </label>
            );
          }
        )}
      </div>
    </div>
  )}
               <div
  style={styles.taskActions}
  onClick={(event) => event.stopPropagation()}
>
  {normalizeStatus(task.status, task.progress) === "not_started" && (
    <button
      type="button"
      style={styles.primaryActionBtn}
      disabled={taskActionId === task.task_id}
      onClick={(event) => {
        event.stopPropagation();
        handleTaskAction(task, "start");
      }}
    >
      <Play size={14} />
      {taskActionId === task.task_id ? "Starting..." : "Start"}
    </button>
  )}

  {normalizeStatus(task.status, task.progress) === "ongoing" && (
    <div style={styles.compactActionRow}>
      {task.work_state === "running" ? (
        
        <button
          type="button"
          style={styles.iconActionBtn}
          disabled={taskActionId === task.task_id}
          onClick={(event) => {
            event.stopPropagation();
            handleTaskAction(task, "pause");
          }}
        >
          <Pause size={14} />
          Pause
        </button>
      ) : (
        <button
          type="button"
          style={styles.iconActionBtn}
          disabled={taskActionId === task.task_id}
          onClick={(event) => {
            event.stopPropagation();
            handleTaskAction(task, "resume");
          }}
        >
          <Play size={14} />
          Resume
        </button>
      )}
      

      <button
        type="button"
        style={{
          ...styles.reviewActionBtn,
          ...(task.total_subtasks > 0 &&
          task.completed_subtasks < task.total_subtasks
            ? styles.disabledActionBtn
            : {}),
        }}
        disabled={
  taskActionId === task.task_id ||
  Number(task.total_subtasks || 0) > 0 &&
  Number(task.completed_subtasks || 0) <
    Number(task.total_subtasks || 0)
}
        onClick={(event) => {
          event.stopPropagation();
          handleTaskAction(task, "submit-review");
        }}
      >
        <CheckCircle2 size={14} />
        Submit Review
      </button>
    </div>
  )}

  {normalizeStatus(task.status, task.progress) === "under_review" && (
    <div style={styles.awaitingReview}>
      <CheckCircle2 size={14} />
      Awaiting Review
    </div>
  )}
</div> 
              </div>
            );
          })
        )}
      </div>
    </div>
  ))}
</section>

      <div style={styles.miniTasksWrapper}>
  <EmployeeMiniTasks />
</div>

      {selectedTask && (
        <div style={styles.modalOverlay} onMouseDown={closeModal}>
          <div style={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" style={styles.closeBtn} onClick={closeModal}>
              <X size={21} />
            </button>

            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{selectedTask.task_title}</h2>
              <p style={styles.modalSubtitle}>
                Project: {selectedTask.project_title || "-"}
              </p>
            </div>

            {modalError && <div style={styles.modalError}>{modalError}</div>}
            {modalSuccess && <div style={styles.modalSuccess}>{modalSuccess}</div>}

            <div style={styles.detailsGrid}>
              <div style={styles.detailBox}>
                <span>Status</span>
                <strong>{formatStatus(selectedTask.status, selectedTask.progress)}</strong>
              </div>
              {normalizeStatus(
  selectedTask.status,
  selectedTask.progress
) === "rejected" && (
  <div style={styles.detailBox}>
    <span>Admin Remark</span>

    <strong>
  {selectedTask.review_note ||
    selectedTask.rejection_reason ||
    selectedTask.rejection_remark ||
    "-"}
</strong>
  </div>
)}

              <div style={styles.detailBox}>
                <span>Assigned By</span>
                <strong>{getAssignedByName(selectedTask)}</strong>
                {getAssignedByEmail(selectedTask) && (
                  <small style={styles.assignedByEmail}>
                    {getAssignedByEmail(selectedTask)}
                  </small>
                )}
              </div>

              <div style={styles.detailBox}>
                <span>Start Date</span>
                <strong>{formatDisplayDate(selectedTask.start_date)}</strong>
              </div>

              <div style={styles.detailBox}>
                <span>Deadline</span>
                <strong>{formatDisplayDate(selectedTask.due_date)}</strong>
                <small
                  style={{
                    ...styles.deadlineText,
                    ...getDeadlineTextStyle(getDeadlineInfo(selectedTask).tone),
                  }}
                >
                  {getDeadlineInfo(selectedTask).label}
                </small>
              </div>
            </div>

            <div style={styles.descriptionGrid}>
              <div style={styles.descriptionBox}>
                <span>Project Description</span>
                <p>{selectedTask.project_description || "-"}</p>
              </div>

              <div style={styles.descriptionBox}>
                <span>Main Task Description</span>
                <p>{selectedTask.task_description || "-"}</p>
              </div>
            </div>

            <div style={styles.modalProgressBox}>
              <div style={styles.progressMeta}>
                <strong>Task Progress</strong>
                <strong>{selectedTask.progress}%</strong>
              </div>

              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${Math.min(100, Math.max(0, selectedTask.progress))}%`,
                  }}
                />
              </div>

              <p style={styles.subtaskCountText}>
                {selectedTask.total_subtasks > 0
                  ? `${selectedTask.completed_subtasks}/${selectedTask.total_subtasks} subtasks completed`
                  : "No subtasks"}
              </p>
            </div>

            {canAddSubtask ? (
              <form style={styles.addSubtaskBox} onSubmit={addSubtask}>
                <h3 style={styles.addSubtaskTitle}>
                  <Plus size={19} />
                  Add Subtask
                </h3>

                <p style={styles.dateLimitHint}>
                  Subtask dates must stay within the parent task period: {" "}
                  <strong>{formatDisplayDate(selectedTask.start_date)}</strong> to {" "}
                  <strong>{formatDisplayDate(selectedTask.due_date)}</strong>.
                </p>

                <div style={styles.formGrid}>
                  <label style={styles.formGroup}>
                    <span>Subtask Title</span>
                    <input
                      style={styles.input}
                      value={subtaskForm.title}
                      onChange={(event) =>
                        setSubtaskForm((previous) => ({
                          ...previous,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Example: Backend API"
                    />
                  </label>

                  <label style={styles.formGroup}>
                    <span>Start Date</span>
                    <input
                      type="date"
                      style={styles.input}
                      value={subtaskForm.start_date}
                      min={selectedTask.start_date || undefined}
                      max={selectedTask.due_date || undefined}
                      onChange={(event) => {
                        const nextStartDate = event.target.value;

                        setSubtaskForm((previous) => ({
                          ...previous,
                          start_date: nextStartDate,
                          end_date:
                            previous.end_date && previous.end_date < nextStartDate
                              ? ""
                              : previous.end_date,
                        }));
                        setModalError("");
                      }}
                    />
                  </label>

                  <label style={styles.formGroup}>
                    <span>End Date / Deadline</span>
                    <input
                      type="date"
                      style={styles.input}
                      value={subtaskForm.end_date}
                      min={subtaskForm.start_date || selectedTask.start_date || undefined}
                      max={selectedTask.due_date || undefined}
                      onChange={(event) => {
                        setSubtaskForm((previous) => ({
                          ...previous,
                          end_date: event.target.value,
                        }));
                        setModalError("");
                      }}
                    />
                  </label>
                </div>

                <label style={styles.formGroup}>
                  <span>Subtask Description</span>
                  <textarea
                    style={styles.textarea}
                    value={subtaskForm.description}
                    onChange={(event) =>
                      setSubtaskForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Write what this subtask includes..."
                  />
                </label>

                <button
                  type="submit"
                  style={{
                    ...styles.addBtn,
                    ...(savingSubtask ? styles.disabledBtn : {}),
                  }}
                  disabled={savingSubtask}
                >
                  <Plus size={18} />
                  {savingSubtask ? "Adding..." : "Add Subtask"}
                </button>
              </form>
            ) : (
              <div style={styles.lockedBox}>
                Subtasks cannot be added while this task is {" "}
                <strong>{formatStatus(selectedTask.status, selectedTask.progress)}</strong>.
              </div>
            )}

            <div style={styles.subtasksSection}>
              <h3 style={styles.sectionTitle}>Subtasks</h3>

              {selectedTask.subtasks.length === 0 ? (
                <div style={styles.emptyBox}>No subtasks added yet.</div>
              ) : (
                <div style={styles.subtaskList}>
                  {selectedTask.subtasks.map((subtask) => {
                    const checked = Number(subtask.is_checked) === 1;
const subtaskDeadline = getDeadlineInfo(subtask);

const currentUser = JSON.parse(
  sessionStorage.getItem("user") ||
  localStorage.getItem("user") ||
  "{}"
);

const canModifySubtask =
  Number(subtask.assigned_to_user_id) === Number(currentUser?.user_id);

                    return (
                      <div style={styles.subtaskItem} key={subtask.task_id}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={
                            checked ||
                            !canModifySubtask ||
                            [
                              "under_review",
                              "completed",
                              "rejected",
                              "on_hold",
                            ].includes(selectedTaskStatus)
                          }
                          onChange={() => requestMarkSubtaskDone(subtask)}
                          style={styles.checkbox}
                        />

                        <div style={styles.subtaskContent}>
                          <h4 style={styles.subtaskTitle}>{subtask.task_title}</h4>
                          <p style={styles.subtaskAssigned}>
                            Assigned by: {getSubtaskAssignedByName(subtask)}
                          </p>

                          {subtask.task_description && (
                            <p style={styles.subtaskDescription}>
                              {subtask.task_description}
                            </p>
                          )}

                          <div style={styles.subtaskDateLine}>
                            <span>
                              {formatDisplayDate(subtask.start_date)} → {formatDisplayDate(subtask.due_date)}
                            </span>

                            {!checked && (
                              <span
                                style={{
                                  ...styles.smallDeadlineBadge,
                                  ...getDeadlineBadgeStyle(subtaskDeadline.tone),
                                }}
                              >
                                {subtaskDeadline.label}
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          style={{
                            ...styles.statusBadge,
                            ...(checked ? styles.doneBadge : {}),
                          }}
                        >
                          {checked ? "Done" : formatStatus(subtask.status, subtask.progress)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
                        <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.cancelModalButton}
                onClick={closeModal}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmSubtask && (
  <div
    style={styles.confirmOverlay}
    onMouseDown={() =>
      setConfirmSubtask(null)
    }
  >
    <div
      style={styles.confirmBox}
      onMouseDown={(event) =>
        event.stopPropagation()
      }
    >
      <div style={styles.confirmIcon}>
        <CheckCircle2 size={24} />
      </div>

      <h3 style={styles.confirmTitle}>
        Mark this Subtask as Done?
      </h3>

      <p style={styles.confirmText}>
        Completed subtasks cannot be unchecked.
      </p>

      <div style={styles.confirmActions}>
        <button
          type="button"
          style={styles.confirmCancelBtn}
          onClick={() =>
            setConfirmSubtask(null)
          }
        >
          Cancel
        </button>

        <button
          type="button"
          style={styles.confirmDoneBtn}
          onClick={
            confirmMarkSubtaskDone
          }
        >
          <CheckCircle2 size={16} />
          Yes, Done
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
};
  

const getStatusBadgeStyle = (status, progress = 0) => {
  const normalized = normalizeStatus(status, progress);

  if (normalized === "completed") {
    return { background: "#dcfce7", color: "#166534" };
  }

  if (normalized === "rejected") {
    return { background: "#fee2e2", color: "#b91c1c" };
  }

  if (normalized === "on_hold") {
    return { background: "#fef3c7", color: "#92400e" };
  }

  if (normalized === "under_review") {
    return { background: "#ede9fe", color: "#6d28d9" };
  }

  if (normalized === "ongoing") {
    return { background: "#dbeafe", color: "#1d4ed8" };
  }

  return { background: "#eef2ff", color: "#334155" };
};

const getDeadlineBadgeStyle = (tone) => {
  if (tone === "danger") return { background: "#fee2e2", color: "#b91c1c" };
  if (tone === "urgent") return { background: "#ffedd5", color: "#c2410c" };
  if (tone === "done") return { background: "#dcfce7", color: "#166534" };
  if (tone === "muted") return { background: "#f1f5f9", color: "#64748b" };

  return { background: "#e0f2fe", color: "#0369a1" };
};

const getDeadlineTextStyle = (tone) => {
  if (tone === "danger") return { color: "#b91c1c" };
  if (tone === "urgent") return { color: "#c2410c" };
  if (tone === "done") return { color: "#166534" };
  return { color: "#64748b" };
};

const styles = {
  page: {
    width: "100%",
    padding: 0,
  },
  loadingNotice: {
  marginBottom: "14px",
  padding: "12px 16px",
  borderRadius: "14px",
  background: "#ffffff",
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 800,
  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.05)",
},

  taskToolbar: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "18px",
  },

  kanbanSearchBox: {
    flex: "1 1 420px",
    minWidth: "280px",
    maxWidth: "720px",
    height: "54px",
    border: "1px solid #d1d5db",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "0 18px",
    background: "#ffffff",
  },

  searchInput: {
    width: "100%",
    border: "none",
    outline: "none",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 700,
    background: "transparent",
  },

  controlGroup: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
  },

  selectWrap: {
    height: "54px",
    border: "1px solid #d1d5db",
    borderRadius: "16px",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "0 12px 0 14px",
  },

  selectControl: {
    height: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#111827",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
  },

  refreshBtn: {
    height: "54px",
    border: "none",
    background: "#ff5733",
    color: "#ffffff",
    borderRadius: "16px",
    padding: "0 20px",
    fontSize: "14px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "9px",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(255, 87, 51, 0.18)",
  },

  errorBox: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#b91c1c",
    borderRadius: "14px",
    padding: "12px 15px",
    fontSize: "14px",
    fontWeight: 800,
    marginBottom: "16px",
  },

  successBox: {
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
    color: "#166534",
    borderRadius: "14px",
    padding: "12px 15px",
    fontSize: "14px",
    fontWeight: 800,
    marginBottom: "16px",
  },

  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: "16px",
    padding: "22px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 800,
    background: "#f8fafc",
  },

  kanbanRow: {
  width: "100%",
  display: "flex",
  flexWrap: "nowrap",
  alignItems: "stretch",
  gap: "20px",
  overflowX: "auto",
  overflowY: "hidden",
  paddingBottom: "16px",
  scrollBehavior: "smooth",
},

kanbanColumn: {
  flex: "0 0 calc((100% - 40px) / 3)",
  width: "calc((100% - 40px) / 3)",

  height: "620px",
  minHeight: "620px",
  maxHeight: "620px",

  boxSizing: "border-box",
  background: "#ffffff",
  border: "none",
  borderRadius: "20px",
  padding: "18px",

  boxShadow: "0 6px 20px rgba(15, 23, 42, 0.06)",

  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
},

kanbanHeader: {
  width: "100%",
  minHeight: "105px",
  boxSizing: "border-box",

  background: "#f7f9fc",
  borderRadius: "18px",
  padding: "17px",

  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",

  marginBottom: "16px",
  flexShrink: 0,
},

kanbanTitle: {
  margin: 0,
  color: "#111827",
  fontSize: "22px",
  fontWeight: 900,
},

kanbanSubtitle: {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: "13px",
  lineHeight: 1.35,
},

kanbanCount: {
  width: "40px",
  height: "40px",
  minWidth: "40px",
  padding: 0,

  borderRadius: "50%",
  background: "#e9edf3",

  display: "grid",
  placeItems: "center",

  fontSize: "13px",
  fontWeight: 900,
  color: "#111827",

  flexShrink: 0,
},

kanbanBody: {
  display: "flex",
  flexDirection: "column",
  gap: "12px",

  flex: 1,
  minHeight: 0,

  overflowY: "auto",
  overflowX: "hidden",

  paddingRight: "5px",
},

emptyKanbanColumn: {
  width: "100%",
  boxSizing: "border-box",

  border: "1px dashed #d5dbe5",
  borderRadius: "14px",

  padding: "16px 12px",

  textAlign: "center",
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: 800,

  background: "#ffffff",
},

kanbanTaskCard: {
  width: "100%",
  textAlign: "left",
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  borderRadius: "18px",
  padding: "18px",
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",

  flexShrink: 0,
},

  kanbanTaskTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
    marginBottom: "12px",
  },

  kanbanTaskTitle: {
    margin: "0 0 5px",
    color: "#111827",
    fontSize: "18px",
    fontWeight: 900,
    lineHeight: 1.25,
    overflowWrap: "anywhere",
  },

  kanbanProjectTitle: {
    margin: 0,
    color: "#475569",
    fontSize: "13px",
    fontWeight: 800,
    overflowWrap: "anywhere",
  },

  statusBadge: {
    padding: "7px 11px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  doneBadge: {
    background: "#dcfce7",
    color: "#166534",
  },

  kanbanTaskDescription: {
    margin: "0 0 14px",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.45,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  cardBadgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "7px",
    marginBottom: "13px",
  },

  deadlineBadge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "28px",
    padding: "5px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 900,
  },

  kanbanMetaLine: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    marginBottom: "11px",
    color: "#64748b",
    fontSize: "12px",
  },

  kanbanDates: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginBottom: "13px",
    color: "#475569",
    fontSize: "12px",
    fontWeight: 800,
  },

  progressMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    color: "#111827",
    fontSize: "12px",
    marginBottom: "8px",
  },

  progressTrack: {
    width: "100%",
    height: "8px",
    borderRadius: "999px",
    background: "#ffd6cc",
    overflow: "hidden",
  },

  quickSubtasksBox: {
  marginTop: "12px",
  paddingTop: "10px",
  paddingBottom: "10px",

  borderTop: "1px solid #e5e7eb",
  borderBottom: "1px solid #e5e7eb",

  cursor: "default",
},

quickSubtasksHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",

  marginBottom: "8px",

  fontSize: "12px",
  fontWeight: 900,
  color: "#334155",
},

quickSubtasksList: {
  display: "flex",
  flexDirection: "column",

  gap: "6px",

  maxHeight: "140px",
  overflowY: "auto",
},

quickSubtaskRow: {
  display: "grid",

  gridTemplateColumns:
    "18px minmax(0, 1fr) auto",

  alignItems: "center",

  gap: "8px",

  minHeight: "32px",

  padding: "6px 8px",

  border: "1px solid #e5e7eb",
  borderRadius: "9px",

  background: "#ffffff",

  cursor: "pointer",
},

quickSubtaskDone: {
  background: "#f8fafc",
},

quickCheckbox: {
  width: "16px",
  height: "16px",

  margin: 0,

  accentColor: "#ff5733",

  cursor: "pointer",
},

quickSubtaskTitle: {
  minWidth: 0,

  color: "#334155",

  fontSize: "11px",
  fontWeight: 800,

  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
},

quickSubtaskTitleDone: {
  color: "#94a3b8",
  textDecoration: "line-through",
},

quickDoneText: {
  color: "#16a34a",

  fontSize: "10px",
  fontWeight: 900,
},

  progressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "#ff5733",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.62)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "28px",
    zIndex: 9999,
  },

  modal: {
    width: "min(1040px, 96vw)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: "24px",
    padding: "28px",
    position: "relative",
    boxShadow: "0 30px 90px rgba(15, 23, 42, 0.28)",
  },
  miniTasksWrapper: {
  width: "1260px",
  maxWidth: "100%",
  boxSizing: "border-box",
  marginTop: "22px",
},

  closeBtn: {
    position: "absolute",
    top: "22px",
    right: "22px",
    width: "44px",
    height: "44px",
    borderRadius: "14px",
    border: "none",
    background: "#111827",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },

  modalHeader: {
    paddingRight: "62px",
    marginBottom: "18px",
  },

  modalTitle: {
    margin: "0 0 6px",
    color: "#111827",
    fontSize: "28px",
    fontWeight: 900,
  },

  modalSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "15px",
  },

  modalError: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#b91c1c",
    borderRadius: "13px",
    padding: "11px 13px",
    marginBottom: "16px",
    fontSize: "13px",
    fontWeight: 800,
  },

  modalSuccess: {
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
    color: "#166534",
    borderRadius: "13px",
    padding: "11px 13px",
    marginBottom: "16px",
    fontSize: "13px",
    fontWeight: 800,
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },

  detailBox: {
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    borderRadius: "14px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "13px",
  },

  assignedByEmail: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1.3,
    wordBreak: "break-word",
  },

  deadlineText: {
    fontSize: "11px",
    fontWeight: 900,
  },

  descriptionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },

  descriptionBox: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: "14px",
    padding: "15px",
  },

  modalProgressBox: {
    border: "1px solid #ffc6b8",
    background: "#fff7f4",
    borderRadius: "15px",
    padding: "16px",
    marginBottom: "18px",
  },

  subtaskCountText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 800,
  },

  addSubtaskBox: {
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    borderRadius: "17px",
    padding: "18px",
    marginBottom: "20px",
  },

  addSubtaskTitle: {
    margin: "0 0 8px",
    color: "#ff5733",
    fontSize: "20px",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  dateLimitHint: {
    margin: "0 0 14px",
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.45,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "12px",
    marginBottom: "13px",
  },

  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    color: "#111827",
    fontSize: "13px",
    fontWeight: 800,
  },

  input: {
    height: "46px",
    border: "1px solid #d6dde8",
    borderRadius: "12px",
    padding: "0 12px",
    fontSize: "13px",
    fontWeight: 700,
    outline: "none",
    background: "#ffffff",
  },

  textarea: {
    minHeight: "82px",
    border: "1px solid #d6dde8",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "13px",
    fontWeight: 700,
    outline: "none",
    resize: "vertical",
    background: "#ffffff",
  },

  addBtn: {
    width: "100%",
    height: "48px",
    border: "none",
    borderRadius: "13px",
    background: "#ff5733",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginTop: "14px",
    cursor: "pointer",
  },

  disabledBtn: {
    opacity: 0.65,
    cursor: "not-allowed",
  },

  lockedBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "14px",
    marginBottom: "20px",
    color: "#64748b",
    fontSize: "13px",
  },

  subtasksSection: {
    marginTop: "8px",
  },

  sectionTitle: {
    margin: "0 0 13px",
    color: "#111827",
    fontSize: "21px",
    fontWeight: 900,
  },

  subtaskList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  subtaskItem: {
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "13px",
    display: "grid",
    gridTemplateColumns: "22px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "12px",
  },

  checkbox: {
    width: "17px",
    height: "17px",
  },

  subtaskContent: {
    minWidth: 0,
  },

  subtaskTitle: {
    margin: "0 0 4px",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 900,
  },

  subtaskDescription: {
    margin: "0 0 6px",
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.4,
  },

  subtaskDateLine: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    color: "#64748b",
    fontSize: "11px",
    fontWeight: 700,
  },

  smallDeadlineBadge: {
    padding: "3px 7px",
    borderRadius: "999px",
    fontSize: "9px",
    fontWeight: 900,
  },
taskActions: {
  marginTop: "12px",
  paddingTop: "10px",
  borderTop: "1px solid #eef2f6",
},

compactActionRow: {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  width: "100%",
},

primaryActionBtn: {
  width: "100%",
  height: "34px",
  border: "none",
  borderRadius: "9px",
  background: "#ff5733",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  fontSize: "11px",
  fontWeight: 900,
  cursor: "pointer",
},

iconActionBtn: {
  height: "34px",
  border: "1px solid #dbe1e8",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#475569",
  padding: "0 11px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "5px",
  fontSize: "11px",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
},

reviewActionBtn: {
  flex: 1,
  height: "34px",
  border: "none",
  borderRadius: "9px",
  background: "#111827",
  color: "#ffffff",
  padding: "0 11px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "5px",
  fontSize: "11px",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
},

disabledActionBtn: {
  opacity: 0.4,
  cursor: "not-allowed",
},

awaitingReview: {
  width: "100%",
  boxSizing: "border-box",
  minHeight: "34px",
  borderRadius: "9px",
  background: "#f5f3ff",
  color: "#6d28d9",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  fontSize: "11px",
  fontWeight: 900,
},
subtaskAssigned: {
  margin: "0 0 6px",
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800,
},
confirmOverlay: {
  position: "fixed",
  inset: 0,

  background:
    "rgba(15, 23, 42, 0.52)",

  backdropFilter: "blur(3px)",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  padding: "20px",

  zIndex: 20000,
},

confirmBox: {
  width: "100%",
  maxWidth: "440px",

  boxSizing: "border-box",

  background: "#ffffff",

  border:
    "1px solid #e5e7eb",

  borderRadius: "18px",

  padding: "28px 30px 26px",

  textAlign: "center",

  boxShadow:
    "0 24px 60px rgba(15, 23, 42, 0.20)",
},

confirmIcon: {
  width: "52px",
  height: "52px",

  margin: "0 auto 16px",

  borderRadius: "50%",

  background: "#fff0eb",
  color: "#ff5733",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",
},

confirmTitle: {
  margin: "0",

  color: "#111827",

  fontSize: "20px",
  lineHeight: 1.3,
  fontWeight: 900,
},

confirmText: {
  margin: "9px 0 0",

  color: "#64748b",

  fontSize: "13px",
  lineHeight: 1.5,
  fontWeight: 600,
},

confirmActions: {
  display: "grid",

  gridTemplateColumns:
    "1fr 1fr",

  gap: "10px",

  marginTop: "24px",
},

confirmCancelBtn: {
  height: "44px",

  border:
    "1px solid #d1d5db",

  borderRadius: "10px",

  background: "#ffffff",

  color: "#344054",

  fontSize: "13px",
  fontWeight: 800,

  cursor: "pointer",
},

confirmDoneBtn: {
  height: "44px",

  border: "none",

  borderRadius: "10px",

  background: "#ff5733",

  color: "#ffffff",

  fontSize: "13px",
  fontWeight: 900,

  cursor: "pointer",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  gap: "7px",

  boxShadow:
    "0 8px 18px rgba(255, 87, 51, 0.22)",
},

modalFooter: {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: "30px",
  paddingTop: "20px",
  borderTop: "1px solid #e5e7eb",
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
};     

export default EmployeeTasks;
