import { useEffect, useState } from "react";
import { Save, User } from "lucide-react";
import api from "../../api/axios";
import "./administratorProfile.css";

const AdministratorProfile = () => {
  const [profile, setProfile] = useState(null);
  const [skills, setSkills] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await api.get("/administrator/profile");

      setProfile(response.data.profile);
      setSkills(response.data.profile?.skills || "");
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Failed to load profile."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const saveSkills = async () => {
    try {
      setSaving(true);
      setMessage("");

      const response = await api.put(
        "/administrator/profile/skills",
        {
          skills,
        }
      );

      setMessage(
        response.data.message || "Skills updated successfully."
      );

      fetchProfile();

    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Failed to update skills."
      );
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="page-loader">
        Loading profile...
      </div>
    );
  }


  return (
    <div className="profile-page">

      {/* PAGE TITLE */}
      <div className="profile-page-title-row">
        <h1>Profile</h1>
        <p>
          View profile details and update your skills.
        </p>
      </div>


      {message && (
        <div className="projects-message">
          {message}
        </div>
      )}


      {/* PROFILE CARD */}
      <div className="profile-card">

        <div className="profile-header">

          <div className="profile-avatar-large">
            <User size={34} />
          </div>


          <div>
            <h2>
              {profile?.full_name || "-"}
            </h2>

            <p>
              {profile?.role_name || "employee"}
            </p>
          </div>

        </div>



        <div className="profile-grid">


          <div className="profile-field">
            <label>
              Employee Code
            </label>

            <div>
              {profile?.employee_code || "-"}
            </div>
          </div>



          <div className="profile-field">
            <label>
              Email
            </label>

            <div>
              {profile?.email || "-"}
            </div>
          </div>



          <div className="profile-field">
            <label>
              Designation
            </label>

            <div>
              {profile?.designation || "-"}
            </div>
          </div>



          <div className="profile-field">
            <label>
              Department
            </label>

            <div>
              {profile?.department_name || "-"}
            </div>
          </div>



          <div className="profile-field">
            <label>
              Phone
            </label>

            <div>
              {profile?.phone || "-"}
            </div>
          </div>



          <div className="profile-field">
            <label>
              Status
            </label>

            <div>
              {profile?.status || "-"}
            </div>
          </div>


        </div>



        <div className="skills-section">

          <label>
            Skills
          </label>


          <textarea
            value={skills}
            onChange={(event) =>
              setSkills(event.target.value)
            }
            placeholder="Example: React, Node.js, MySQL, Project Management, Excel..."
          />


          <p>
            Only skills are editable from this page.
            Other profile details are fetched from backend.
          </p>



          <button
            className="save-skills-btn"
            onClick={saveSkills}
            disabled={saving}
          >

            <Save size={16} />

            {saving
              ? "Saving..."
              : "Save Skills"}

          </button>


        </div>


      </div>


    </div>
  );
};


export default AdministratorProfile;