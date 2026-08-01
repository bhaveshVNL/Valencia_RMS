const express = require("express");

const authMiddleware = require("../middleware/authmiddleware");
const { requireRole } = require("../middleware/rolemiddleware");

const adminProjectController = require("../controllers/adminprojectcontroller");

const router = express.Router();

const adminOnly = [authMiddleware, requireRole("admin")];

const pickController = (...names) => {
  return async (req, res, next) => {
    const controllerName = names.find(
      (name) => typeof adminProjectController[name] === "function"
    );

    if (!controllerName) {
      return res.status(500).json({
        success: false,
        message: `Controller function missing. Expected one of: ${names.join(", ")}`,
      });
    }

    return adminProjectController[controllerName](req, res, next);
  };
};

const getProjectsHandler = pickController(
  "getAdminProjects",
  "getDepartmentProjects",
  "getDepartmentProjectsForAdmin",
  "getProjects",
  "getAllProjects"
);

const createProjectHandler = pickController(
  "createAdminProject",
  "createProject",
  "assignProject",
  "addProject"
);

const updateProjectHandler = pickController(
  "updateAdminProject",
  "updateProject",
  "updateProjectDetails",
  "editProject"
);

const deleteProjectHandler = pickController(
  "deleteAdminProject",
  "deleteProject",
  "removeProject"
);

const getAssignableUsersHandler = pickController(
  "getAssignableUsersForAdminProjects",
  "getAssignableUsers",
  "getAdminProjectUsers",
  "getProjectUsers",
  "getUsersForProjects"
);

const createMainTaskHandler = pickController(
  "createMainTask",
  "addMainTask",
  "createProjectTask",
  "addProjectTask",
  "createAdminProjectTask"
);

const updateMainTaskHandler = pickController(
  "updateMainTask",
  "updateProjectTask",
  "updateAdminProjectTask",
  "editMainTask"
);

/*
  IMPORTANT:
  Static routes must stay above dynamic routes like /:projectId.
*/

// Fetch all active users from Users table for project assignment
router.get("/assignable-users", ...adminOnly, getAssignableUsersHandler);

// Existing user route aliases used by frontend
router.get("/users", ...adminOnly, getAssignableUsersHandler);
router.get("/all-users", ...adminOnly, getAssignableUsersHandler);
router.get("/project-users", ...adminOnly, getAssignableUsersHandler);

// Project listing route aliases
router.get("/", ...adminOnly, getProjectsHandler);
router.get("/projects", ...adminOnly, getProjectsHandler);
router.get("/department-projects", ...adminOnly, getProjectsHandler);
router.get("/all", ...adminOnly, getProjectsHandler);

// Create project route aliases
router.post("/", ...adminOnly, createProjectHandler);
router.post("/projects", ...adminOnly, createProjectHandler);
router.post("/create", ...adminOnly, createProjectHandler);

// Main task route aliases
router.post("/tasks", ...adminOnly, createMainTaskHandler);
router.post("/:projectId/tasks", ...adminOnly, createMainTaskHandler);
router.post("/projects/:projectId/tasks", ...adminOnly, createMainTaskHandler);
router.post("/:projectId/main-tasks", ...adminOnly, createMainTaskHandler);

router.put("/tasks/:taskId", ...adminOnly, updateMainTaskHandler);
router.put("/main-tasks/:taskId", ...adminOnly, updateMainTaskHandler);
router.put("/:projectId/tasks/:taskId", ...adminOnly, updateMainTaskHandler);
router.put("/projects/:projectId/tasks/:taskId", ...adminOnly, updateMainTaskHandler);

// Update project route aliases
router.put("/:projectId", ...adminOnly, updateProjectHandler);
router.put("/projects/:projectId", ...adminOnly, updateProjectHandler);
router.put("/:projectId/details", ...adminOnly, updateProjectHandler);
router.put("/update/:projectId", ...adminOnly, updateProjectHandler);

// Delete project route aliases
router.delete("/:projectId", ...adminOnly, deleteProjectHandler);
router.delete("/projects/:projectId", ...adminOnly, deleteProjectHandler);
router.delete("/delete/:projectId", ...adminOnly, deleteProjectHandler);

module.exports = router;