import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Palette,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

import api from "../../api/axios";
import "../../layouts/employeeProfile.css";

const PROFILE_PREFS_KEY = "employee_profile_preferences";
const QUICK_NOTES_KEY = `employee_quick_notes_${
  JSON.parse(
    sessionStorage.getItem("user") ||
    localStorage.getItem("user") ||
    "{}"
  )?.user_id || "default"
}`;

const DEFAULT_PREFS = {
  accent: "orange",
  banner: "paper",
  avatar: "classic",
  quote: "Driven by curiosity, inspired by impact.",
};

const ACCENTS = {
  orange: {
    main: "#ff5733",
    soft: "#fff1ec",
    line: "#ffd7cc",
  },
  blue: {
    main: "#4169e1",
    soft: "#eef3ff",
    line: "#d6e1ff",
  },
  purple: {
    main: "#7656d8",
    soft: "#f2efff",
    line: "#ded7ff",
  },
  green: {
    main: "#159570",
    soft: "#eaf8f3",
    line: "#cceee2",
  },
  navy: {
    main: "#111827",
    soft: "#eef1f5",
    line: "#d8dee8",
  },
};

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

const getStoredPreferences = () => {
  try {
    return {
      ...DEFAULT_PREFS,
      ...JSON.parse(
        localStorage.getItem(PROFILE_PREFS_KEY) || "{}"
      ),
    };
  } catch {
    return DEFAULT_PREFS;
  }
};

const getStoredQuickNotes = () => {
  try {
    const saved = localStorage.getItem(QUICK_NOTES_KEY);

    if (!saved) return [];

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getResponseData = (response) => {
  const data = response?.data || {};
  const profile = data.profile || data.data || data;

  const skills = Array.isArray(data.skills)
    ? data.skills
        .map((skill) =>
          typeof skill === "string"
            ? skill
            : skill.skill_name
        )
        .filter(Boolean)
        .join(", ")
    : profile.skills || "";

  return {
    ...profile,
    skills,
  };
};

const getInitials = (name = "") => {
  const cleanName = String(name || "").trim();

  if (!cleanName) return "E";

  return cleanName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const normalizeProfile = (rawProfile, fallbackUser) => {
  const profile = rawProfile || {};
  const user = fallbackUser || {};

  return {
    user_id: profile.user_id || user.user_id || "",

    full_name:
      profile.full_name ||
      profile.name ||
      user.full_name ||
      "Employee",

    email:
      profile.email ||
      user.email ||
      "-",

    phone:
      profile.phone ||
      user.phone ||
      "-",

    department_name:
      profile.department_name ||
      profile.department ||
      user.department_name ||
      user.department ||
      "-",

    designation:
      profile.designation ||
      profile.designation_name ||
      user.designation ||
      "-",

    employee_code:
      profile.employee_code ||
      profile.employeeCode ||
      user.employee_code ||
      "-",

    role_name:
      profile.role_name ||
      profile.role ||
      user.role_name ||
      "employee",

    skills:
      profile.skills ||
      user.skills ||
      "",
  };
};

const EmployeeProfile = () => {
  const storedUser = getStoredUser();

  const [profile, setProfile] = useState(() =>
    normalizeProfile(storedUser, storedUser)
  );

  const [preferences, setPreferences] = useState(
    getStoredPreferences
  );

  const [draftPreferences, setDraftPreferences] =
    useState(getStoredPreferences);

  const [skillsText, setSkillsText] = useState("");
  const [editingSkills, setEditingSkills] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [savingSkills, setSavingSkills] =
    useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const [showCustomize, setShowCustomize] =
    useState(false);

  const [oldPassword, setOldPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [changingPassword, setChangingPassword] =
    useState(false);

  const [showPasswordBox, setShowPasswordBox] =
    useState(false);

  const [showOldPassword, setShowOldPassword] =
    useState(false);

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  /* ======================================================
     QUICK NOTES
  ====================================================== */

  const [quickNotes, setQuickNotes] = useState(
    getStoredQuickNotes
  );

  const [addingNote, setAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");

  const initials = useMemo(
    () => getInitials(profile.full_name),
    [profile.full_name]
  );

  const skillsList = useMemo(() => {
    return String(profile.skills || "")
      .split(/,|\n/)
      .map((skill) => skill.trim())
      .filter(Boolean);
  }, [profile.skills]);

  const activeAccent =
    ACCENTS[preferences.accent] ||
    ACCENTS.orange;

  const saveQuickNotes = (notes) => {
    setQuickNotes(notes);

    localStorage.setItem(
      QUICK_NOTES_KEY,
      JSON.stringify(notes)
    );
  };

  const addQuickNote = () => {
  if (!newNoteText.trim()) return;

  const newNote = {
    id: Date.now(),
    text: newNoteText.trim(),
    completed: false,
  };

  saveQuickNotes([
    ...quickNotes,
    newNote,
  ]);

  setNewNoteText("");
  setAddingNote(false);
};

  const toggleQuickNote = (id) => {
    const updatedNotes = quickNotes.map(
      (note) =>
        note.id === id
          ? {
              ...note,
              completed: !note.completed,
            }
          : note
    );

    saveQuickNotes(updatedNotes);
  };

  const deleteQuickNote = (id) => {
    const updatedNotes = quickNotes.filter(
      (note) => note.id !== id
    );

    saveQuickNotes(updatedNotes);
  };

  const clearQuickNotes = () => {
    saveQuickNotes([]);
  };

  /* ======================================================
     PROFILE API
  ====================================================== */

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const response = await api.get(
        "/employee-profile/me"
      );

      const normalized = normalizeProfile(
        getResponseData(response),
        storedUser
      );

      setProfile(normalized);
      setSkillsText(normalized.skills || "");
    } catch (err) {
      console.error(
        "Fetch employee profile error:",
        err
      );

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to load profile."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ======================================================
     SKILLS
  ====================================================== */

  const saveSkills = async () => {
    try {
      setSavingSkills(true);
      setError("");
      setSuccessMessage("");

      const response = await api.put(
        "/employee-profile/skills",
        {
          skills: skillsText,
        }
      );

      const updatedSkills = Array.isArray(
        response.data?.skills
      )
        ? response.data.skills
            .map((skill) => skill.skill_name)
            .filter(Boolean)
            .join(", ")
        : skillsText;

      setProfile((previous) => ({
        ...previous,
        skills: updatedSkills,
      }));

      setSkillsText(updatedSkills);
      setEditingSkills(false);

      setSuccessMessage(
        response.data?.message ||
          "Skills updated successfully."
      );
    } catch (err) {
      console.error(
        "Save employee skills error:",
        err
      );

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to update skills."
      );
    } finally {
      setSavingSkills(false);
    }
  };

  /* ======================================================
     PASSWORD
  ====================================================== */

  const changePassword = async () => {
    try {
      setError("");
      setSuccessMessage("");

      if (!oldPassword || !newPassword) {
        setError(
          "Please enter all password fields."
        );
        return;
      }

      if (newPassword !== confirmPassword) {
        setError(
          "New password and confirm password do not match."
        );
        return;
      }

      setChangingPassword(true);

      await api.put(
        "/employee-profile/change-password",
        {
          oldPassword,
          newPassword,
        }
      );

      setSuccessMessage(
        "Password changed successfully."
      );

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordBox(false);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to change password."
      );
    } finally {
      setChangingPassword(false);
    }
  };

  /* ======================================================
     CUSTOMIZATION
  ====================================================== */

  const openCustomization = () => {
    setDraftPreferences(preferences);
    setShowCustomize(true);
  };

  const savePreferences = () => {
    setPreferences(draftPreferences);

    localStorage.setItem(
      PROFILE_PREFS_KEY,
      JSON.stringify(draftPreferences)
    );

    setShowCustomize(false);

    setSuccessMessage(
      "Profile appearance saved on this device."
    );
  };

  useEffect(() => {
    fetchProfile();
  }, []);


  return (
    <div
      className="vnl-profile-page"
      style={{
        "--profile-accent": activeAccent.main,
        "--profile-accent-soft":
          activeAccent.soft,
        "--profile-accent-line":
          activeAccent.line,
      }}
    >
      {/* ======================================================
          PROFILE HERO
      ====================================================== */}

      <section
        className={`vnl-profile-hero banner-${preferences.banner}`}
      >
        <div className="vnl-profile-hero-decoration">
          <span className="vnl-retro-grid" />
          <span className="vnl-retro-dots" />
          <span className="vnl-retro-shape shape-one" />
          <span className="vnl-retro-shape shape-two" />
        </div>

        <div className="vnl-profile-hero-content">
          <div
            className={`vnl-profile-avatar avatar-${preferences.avatar}`}
          >
            <div className="vnl-profile-avatar-inner">
              {initials}
            </div>

            <button
              type="button"
              className="vnl-avatar-edit"
              onClick={openCustomization}
              title="Customize profile"
            >
              <Pencil size={15} />
            </button>
          </div>

          <div className="vnl-profile-intro">
            <span className="vnl-profile-eyebrow">
              EMPLOYEE PROFILE
            </span>

            <h1>{profile.full_name}</h1>

            {/* ONLY DESIGNATION + ROLE */}
            <div className="vnl-profile-tags">
              <span>
                {profile.designation}
              </span>

              <span className="role">
                {profile.role_name}
              </span>
            </div>

            <p className="vnl-profile-quote">
              “{preferences.quote}”
            </p>
          </div>
        </div>

        <div className="vnl-profile-hero-actions">
          <button
            type="button"
            className="vnl-secondary-profile-btn"
            onClick={openCustomization}
          >
            <Palette size={18} />
            Customize
          </button>

          <button
            type="button"
            className="vnl-profile-refresh"
            onClick={fetchProfile}
            disabled={loading}
          >
            <RefreshCw
              size={18}
              className={
                loading
                  ? "profile-spin"
                  : ""
              }
            />

            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>
      </section>

      {error && (
        <div className="vnl-profile-message error">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="vnl-profile-message success">
          <Check size={18} />
          {successMessage}
        </div>
      )}

      {/* ======================================================
          MAIN CONTENT
      ====================================================== */}

      <div className="vnl-profile-main-grid">

        {/* ====================================================
            EMPLOYEE DETAILS
        ==================================================== */}

        <section className="vnl-profile-panel details-panel">
          <div className="vnl-profile-section-heading">
            <div className="vnl-section-icon">
              <UserRound size={21} />
            </div>

            <div>
              <h2>Employee Details</h2>
            </div>
          </div>

          <div className="vnl-profile-details-grid">

            <ProfileDetail
              label="Name"
              value={profile.full_name}
            />

            <ProfileDetail
              label="Email"
              value={profile.email}
            />

            <ProfileDetail
              label="Phone"
              value={profile.phone}
            />

            <ProfileDetail
              label="Designation"
              value={profile.designation}
            />

            <ProfileDetail
              label="Role"
              value={profile.role_name}
            />

          </div>
        </section>

        {/* ====================================================
            RIGHT SIDE
        ==================================================== */}

        <div className="vnl-profile-side-column">

          {/* ==================================================
              SKILLS
          ================================================== */}

          <section className="vnl-profile-panel">
            <div className="vnl-profile-panel-top">

              <div className="vnl-profile-section-heading compact">

                <div className="vnl-section-icon">
                  <Wrench size={20} />
                </div>

                <div>
                  <h2>Skills</h2>

                  <p>
                    Tools, strengths and expertise.
                  </p>
                </div>

              </div>

              {!editingSkills ? (
                <button
                  type="button"
                  className="vnl-text-action"
                  onClick={() => {
                    setSkillsText(
                      profile.skills || ""
                    );

                    setEditingSkills(true);
                  }}
                >
                  Edit Skills
                </button>
              ) : null}

            </div>

            {editingSkills ? (
              <div className="vnl-skills-editor">

                <textarea
                  value={skillsText}
                  onChange={(event) =>
                    setSkillsText(
                      event.target.value
                    )
                  }
                  placeholder="React, Node.js, MySQL, UI Design..."
                />

                <div className="vnl-editor-actions">

                  <button
                    type="button"
                    className="vnl-cancel-small"
                    onClick={() => {
                      setEditingSkills(false);

                      setSkillsText(
                        profile.skills || ""
                      );
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="vnl-save-small"
                    onClick={saveSkills}
                    disabled={savingSkills}
                  >
                    <Save size={16} />

                    {savingSkills
                      ? "Saving..."
                      : "Save Skills"}
                  </button>

                </div>
              </div>

            ) : skillsList.length ? (

              <div className="vnl-profile-skills">

                {skillsList.map(
                  (skill, index) => (
                    <span
                      key={`${skill}-${index}`}
                    >
                      {skill}
                    </span>
                  )
                )}

              </div>

            ) : (

              <div className="vnl-profile-empty">
                No skills added yet.
              </div>

            )}
          </section>

          {/* ==================================================
              QUICK NOTES
          ================================================== */}

          <section className="vnl-profile-panel vnl-quick-notes-panel">

  <div className="vnl-profile-panel-top">

    <div className="vnl-profile-section-heading compact">

      <div className="vnl-section-icon quick-notes-icon">
        <Sparkles size={20} />
      </div>

      <div>
        <h2>Quick Notes / To-Do</h2>

        <p>
          Personal reminders saved on this device.
        </p>
      </div>

    </div>

    <button
      type="button"
      className="vnl-text-action"
      onClick={() => {
        setAddingNote(true);

        setTimeout(() => {
          document
            .querySelector(".vnl-new-note-input")
            ?.focus();
        }, 50);
      }}
    >
      + Add
    </button>

  </div>

  {/* INLINE NOTE INPUT */}

 {addingNote && (
  <div className="vnl-quick-note-input-row">
    <input
      autoFocus
      type="text"
      value={newNoteText}
      placeholder="Write a note or reminder..."
      onChange={(e) => setNewNoteText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addQuickNote();
        }

        if (e.key === "Escape") {
          setNewNoteText("");
          setAddingNote(false);
        }
      }}
    />
  </div>
)}

  {/* SAVED NOTES */}

  <div className="vnl-quick-notes-list">
  {quickNotes.map((note) => (
    <div
      key={note.id}
      className={`vnl-quick-note-item ${
        note.completed ? "completed" : ""
      }`}
    >
      <label className="vnl-quick-note-check">
        <input
          type="checkbox"
          checked={note.completed}
          onChange={() => toggleQuickNote(note.id)}
        />

        <span>{note.text}</span>
      </label>

      <button
        type="button"
        className="vnl-quick-note-delete"
        onClick={() => deleteQuickNote(note.id)}
      >
        ×
      </button>
    </div>
  ))}
</div>

  {quickNotes.length > 0 && (

    <button
      type="button"
      className="vnl-clear-notes"
      onClick={clearQuickNotes}
    >
      Clear all
    </button>

  )}

</section>

        </div>
      </div>

      {/* ======================================================
          SECURITY
      ====================================================== */}

      <section className="vnl-profile-panel vnl-security-panel">

        <div className="vnl-profile-panel-top">

          <div className="vnl-profile-section-heading compact">

            <div className="vnl-section-icon">
              <LockKeyhole size={20} />
            </div>

            <div>
              <h2>Security</h2>

              <p>
                Manage your account password.
              </p>
            </div>

          </div>

          <button
            type="button"
            className="vnl-text-action"
            onClick={() =>
              setShowPasswordBox(
                (previous) => !previous
              )
            }
          >
            {showPasswordBox
              ? "Close"
              : "Change Password"}
          </button>

        </div>

        {showPasswordBox && (

          <div className="vnl-password-grid">

            <PasswordField
              label="Current Password"
              value={oldPassword}
              setValue={setOldPassword}
              visible={showOldPassword}
              setVisible={setShowOldPassword}
            />

            <PasswordField
              label="New Password"
              value={newPassword}
              setValue={setNewPassword}
              visible={showNewPassword}
              setVisible={setShowNewPassword}
            />

            <PasswordField
              label="Confirm New Password"
              value={confirmPassword}
              setValue={setConfirmPassword}
              visible={showConfirmPassword}
              setVisible={
                setShowConfirmPassword
              }
            />

            <div className="vnl-password-action">

              <button
                type="button"
                onClick={changePassword}
                disabled={changingPassword}
              >
                {changingPassword
                  ? "Saving..."
                  : "Save Password"}
              </button>

            </div>

          </div>

        )}

      </section>

      {/* ======================================================
          CUSTOMIZATION MODAL
      ====================================================== */}

      {showCustomize && (

        <div
          className="vnl-customize-backdrop"
          onClick={() =>
            setShowCustomize(false)
          }
        >

          <div
            className="vnl-customize-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="vnl-customize-modal-header">

              <div>

                <span className="vnl-profile-eyebrow">
                  PROFILE STUDIO
                </span>

                <h2>
                  Make your profile yours.
                </h2>

                <p>
                  A little personality, still completely professional.
                </p>

              </div>

              <button
                type="button"
                className="vnl-modal-close"
                onClick={() =>
                  setShowCustomize(false)
                }
              >
                <X size={19} />
              </button>

            </div>

            <div className="vnl-customize-preview">

              <div
                className={`vnl-preview-banner banner-${draftPreferences.banner}`}
              >

                <div
                  className={`vnl-preview-avatar avatar-${draftPreferences.avatar}`}
                >
                  {initials}
                </div>

                <div>

                  <strong>
                    {profile.full_name}
                  </strong>

                  <span>
                    {profile.role_name}
                  </span>

                  <p>
                    “{draftPreferences.quote}”
                  </p>

                </div>

              </div>

            </div>

            <div className="vnl-customize-section">

              <span className="vnl-customize-label">
                Accent Color
              </span>

              <div className="vnl-accent-picker">

                {Object.entries(
                  ACCENTS
                ).map(([key, value]) => (

                  <button
                    key={key}
                    type="button"
                    className={
                      draftPreferences.accent ===
                      key
                        ? "active"
                        : ""
                    }
                    style={{
                      "--picker-color":
                        value.main,
                    }}
                    onClick={() =>
                      setDraftPreferences(
                        (previous) => ({
                          ...previous,
                          accent: key,
                        })
                      )
                    }
                    aria-label={key}
                  >

                    {draftPreferences.accent ===
                      key && (
                      <Check size={16} />
                    )}

                  </button>

                ))}

              </div>

            </div>

            <div className="vnl-customize-section">

              <span className="vnl-customize-label">
                Banner Style
              </span>

              <div className="vnl-banner-picker">

                {[
                  ["paper", "Editorial"],
                  ["grid", "90s Grid"],
                  ["soft", "Soft Shapes"],
                ].map(([key, label]) => (

                  <button
                    key={key}
                    type="button"
                    className={`banner-choice banner-${key} ${
                      draftPreferences.banner ===
                      key
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setDraftPreferences(
                        (previous) => ({
                          ...previous,
                          banner: key,
                        })
                      )
                    }
                  >

                    <span />

                    <strong>
                      {label}
                    </strong>

                  </button>

                ))}

              </div>

            </div>

            <div className="vnl-customize-section">

              <span className="vnl-customize-label">
                Avatar Style
              </span>

              <div className="vnl-avatar-picker">

                {[
                  ["classic", "Classic"],
                  ["soft", "Soft"],
                  ["retro", "Retro"],
                ].map(([key, label]) => (

                  <button
                    key={key}
                    type="button"
                    className={
                      draftPreferences.avatar ===
                      key
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setDraftPreferences(
                        (previous) => ({
                          ...previous,
                          avatar: key,
                        })
                      )
                    }
                  >

                    <span
                      className={`picker-avatar avatar-${key}`}
                    >
                      {initials}
                    </span>

                    <strong>
                      {label}
                    </strong>

                  </button>

                ))}

              </div>

            </div>

            <div className="vnl-customize-section">

              <label className="vnl-quote-editor">

                <span className="vnl-customize-label">
                  Your Work Line
                </span>

                <input
                  type="text"
                  maxLength={90}
                  value={
                    draftPreferences.quote
                  }
                  onChange={(event) =>
                    setDraftPreferences(
                      (previous) => ({
                        ...previous,
                        quote:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Write a short work quote..."
                />

                <small>
                  {
                    draftPreferences.quote
                      .length
                  }
                  /90
                </small>

              </label>

            </div>

            <div className="vnl-customize-footer">

              <button
                type="button"
                className="vnl-customize-reset"
                onClick={() =>
                  setDraftPreferences(
                    DEFAULT_PREFS
                  )
                }
              >
                Reset
              </button>

              <button
                type="button"
                className="vnl-customize-save"
                onClick={savePreferences}
              >
                <Save size={17} />
                Save Profile Style
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
};

const ProfileDetail = ({
  label,
  value,
}) => (
  <div className="vnl-profile-detail">
    <span>{label}</span>
    <strong>
      {value || "-"}
    </strong>
  </div>
);

const PasswordField = ({
  label,
  value,
  setValue,
  visible,
  setVisible,
}) => (
  <label className="vnl-password-field">

    <span>{label}</span>

    <div>

      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) =>
          setValue(event.target.value)
        }
        placeholder={label}
      />

      <button
        type="button"
        onClick={() =>
          setVisible(
            (previous) => !previous
          )
        }
      >

        {visible ? (
          <EyeOff size={18} />
        ) : (
          <Eye size={18} />
        )}

      </button>

    </div>

  </label>
);

export default EmployeeProfile;