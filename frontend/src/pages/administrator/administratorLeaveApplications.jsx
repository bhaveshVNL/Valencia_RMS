import { useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCw, Send, X } from "lucide-react";

import LeaveInstructionsModal from "../../components/employee/LeaveInstructionsModal";
import api from "../../api/axios";


const EMPTY_FORM = {
  start_date: "",
  end_date: "",
  duration_type: "full_day",
  half_day_session: "first_half",
  reason: "",
};



const DEFAULT_BALANCES = {
  sick: {
    label: "Sick Leave",
    total: 2,
    earned: 2,
    used: 0,
    pending: 0,
    available: 2,
    remaining: 2,
  },

  casual: {
    label: "Casual Leave",
    total: 2,
    earned: 2,
    used: 0,
    pending: 0,
    available: 2,
    remaining: 2,
  },

  mandatory: {
    label: "Privileged Leave",
    monthly_credit: 1.5,
    carry_forward: true,
    earned: 0,
    used: 0,
    pending: 0,
    available: 0,
    remaining: 0,
  },

  festival: {
    label: "Holiday Leave",
    total: 4,
    earned: 4,
    used: 0,
    pending: 0,
    available: 4,
    remaining: 4,
  },
};



const LEAVE_CARDS = [
  {
    key: "sick",
    title: "Sick Leave",
    description: "Annual sick leave entitlement",
  },

  {
    key: "casual",
    title: "Casual Leave",
    description: "Annual casual leave entitlement",
  },

  {
    key: "mandatory",
    title: "Privileged Leave",
    description: "1.5 days credited monthly",
  },

  {
    key: "festival",
    title: "Holiday Leave",
    description: "1 Holiday Leave in 2026 - Christmas",
  },
];


const HISTORY_FILTERS = [
  "all",
  "pending",
  "approved",
  "rejected",
];



const getTomorrowDate = () => {

  const date = new Date();

  date.setDate(
    date.getDate() + 1
  );


  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");


  const day = String(
    date.getDate()
  ).padStart(2, "0");


  return `${year}-${month}-${day}`;
};



const formatDisplayDate = (value) => {

  if (!value) return "-";


  const cleanDate = String(value)
    .slice(0, 10);


  const parts = cleanDate.split("-");


  return parts.length === 3
    ? `${parts[2]}-${parts[1]}-${parts[0]}`
    : cleanDate;

};



const formatDays = (value) => {

  const number = Number(value || 0);

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(1);

};



const getLeaveLabel = (type) => {

  if (type === "sick")
    return "Sick Leave";


  if (type === "casual")
    return "Casual Leave";


  if (type === "mandatory")
    return "Privileged Leave";


  if (type === "festival")
    return "Holiday Leave";


  return type || "-";

};



const getDurationLabel = (application) => {

  if (
    application.leave_type === "festival"
  )
    return "Full Day";


  if (
    application.duration_type !== "half_day"
  )
    return "Full Day";


  if (
    application.half_day_session === "first_half"
  )
    return "Half Day · First Half";


  if (
    application.half_day_session === "second_half"
  )
    return "Half Day · Second Half";


  return "Half Day";

};
const BalanceCard = ({ leave, balance, onApply }) => {

  const isPrivileged = leave.key === "mandatory";
  const isFestival = leave.key === "festival";


  const available = Number(
    balance.available ??
      balance.remaining ??
      0
  );


  const used = Number(
    balance.used || 0
  );


  const pending = Number(
    balance.pending || 0
  );


  const total = isPrivileged
    ? Number(balance.earned || 0)
    : Number(
        balance.total ||
        balance.earned ||
        0
      );


  const progress =
    total > 0
      ? Math.min(
          100,
          (available / total) * 100
        )
      : 0;



  return (

    <div style={styles.leaveCard}>


      <div style={styles.cardIcon}>
        <CalendarDays size={24} />
      </div>



      <h2 style={styles.leaveTitle}>
        {leave.title}
      </h2>



      <p style={styles.leaveDescription}>
        {leave.description}
      </p>



      <div style={styles.balanceGrid}>

        <div style={styles.balanceStat}>
          <strong style={styles.totalNumber}>
            {formatDays(total)}
          </strong>
          <span>
            Total
          </span>
        </div>



        <div style={styles.balanceStat}>
          <strong style={styles.usedNumber}>
            {formatDays(used)}
          </strong>
          <span>
            Used
          </span>
        </div>



        <div style={styles.balanceStat}>
          <strong style={styles.pendingNumber}>
            {formatDays(pending)}
          </strong>
          <span>
            Pending
          </span>
        </div>



        <div style={styles.balanceStat}>
          <strong style={styles.availableNumber}>
            {formatDays(available)}
          </strong>
          <span>
            Available
          </span>
        </div>

      </div>



      <div style={styles.balanceProgressTrack}>

        <div
          style={{
            ...styles.balanceProgressFill,
            width: `${progress}%`,
          }}
        />

      </div>



      <p style={styles.availableText}>
        {formatDays(available)} of {formatDays(total)} days available
      </p>



      {isPrivileged && (

        <div style={styles.cardInfo}>

          <span>
            <strong>
              1.5 days credited every month
            </strong>
          </span>

          <span>
            Unused balance carries forward
          </span>

        </div>

      )}



      {isFestival && (

        <div style={styles.cardInfo}>

          <span>
            Fixed company holidays are separate
          </span>

        </div>

      )}



      <button
        type="button"
        disabled={available <= 0}
        style={{
          ...styles.applyBtn,
          ...(available <= 0
            ? styles.disabledApplyBtn
            : {}),
        }}
        onClick={() =>
          available > 0 &&
          onApply(leave.key)
        }
      >

        <Send size={18} />

        {available <= 0
          ? "No Leave Available"
          : isFestival
          ? "Apply Holiday Leave"
          : "Apply Leave"}

      </button>


    </div>

  );

};





const HistoryTable = ({
  loading,
  applications,
}) => {


  if (loading) {

    return (
      <div style={styles.emptyState}>
        Loading leave applications...
      </div>
    );

  }



  if (applications.length === 0) {

    return (
      <div style={styles.emptyState}>
        No leave applications found.
      </div>
    );

  }



  return (

    <div style={styles.tableWrapper}>

      <table style={styles.table}>


        <thead>

          <tr>

            <th
              style={{
                ...styles.tableHeadCell,
                ...styles.firstHeadCell,
              }}
            >
              Leave Type
            </th>


            <th style={styles.tableHeadCell}>
              From
            </th>


            <th style={styles.tableHeadCell}>
              To
            </th>


            <th style={styles.tableHeadCell}>
              Duration
            </th>


            <th style={styles.tableHeadCell}>
              Days
            </th>


            <th style={styles.tableHeadCell}>
              Reason
            </th>


            <th style={styles.tableHeadCell}>
              Status
            </th>


            <th
              style={{
                ...styles.tableHeadCell,
                ...styles.lastHeadCell,
              }}
            >
              Applied On
            </th>


          </tr>

        </thead>



        <tbody>


          {applications.map((application) => {


            const status = String(
              application.status ||
              "pending"
            ).toLowerCase();



            return (

              <tr key={application.leave_id}>


                <td
                  style={{
                    ...styles.tableCell,
                    ...styles.firstTableCell,
                  }}
                >

                  <strong>
                    {getLeaveLabel(
                      application.leave_type
                    )}
                  </strong>

                </td>



                <td style={styles.tableCell}>
                  {formatDisplayDate(
                    application.start_date
                  )}
                </td>



                <td style={styles.tableCell}>
                  {formatDisplayDate(
                    application.end_date
                  )}
                </td>



                <td style={styles.tableCell}>

                  <span
                    style={
                      application.duration_type ===
                      "half_day"
                        ? styles.halfDayBadge
                        : styles.fullDayBadge
                    }
                  >
                    {getDurationLabel(
                      application
                    )}
                  </span>

                </td>



                <td style={styles.tableCell}>
                  {formatDays(
                    application.total_days
                  )}
                </td>



                <td style={styles.tableCell}>
                  {application.reason || "-"}
                </td>



                <td style={styles.tableCell}>

                  <span
                    style={{
                      ...styles.statusBadge,

                      ...(status === "approved"
                        ? styles.approvedBadge
                        : status === "rejected"
                        ? styles.rejectedBadge
                        : styles.pendingBadge),
                    }}
                  >

                    {status
                      .charAt(0)
                      .toUpperCase() +
                      status.slice(1)}

                  </span>

                </td>



                <td
                  style={{
                    ...styles.tableCell,
                    ...styles.lastTableCell,
                  }}
                >

                  {application.applied_at
                    ? formatDisplayDate(
                        String(
                          application.applied_at
                        ).slice(0, 10)
                      )
                    : "-"}

                </td>



              </tr>

            );

          })}


        </tbody>


      </table>


    </div>

  );


};





const AdministratorLeaveApplications = () => {


  const [balances,setBalances] =
    useState(DEFAULT_BALANCES);


  const [applications,setApplications] =
    useState([]);


  const [departmentLeaves,setDepartmentLeaves] =
    useState([]);


  const [activeTab,setActiveTab] =
    useState("my");


  const [holidays,setHolidays] =
    useState([]);



  const [historyFilter,setHistoryFilter] =
    useState("all");



  const [selectedLeaveType,setSelectedLeaveType] =
    useState(null);



  const [form,setForm] =
    useState(EMPTY_FORM);



  const [loading,setLoading] =
    useState(true);



  const [holidayLoading,setHolidayLoading] =
    useState(false);



  const [submitting,setSubmitting] =
    useState(false);



  const [error,setError] =
    useState("");



  const [success,setSuccess] =
    useState("");



  const [showInstructions,setShowInstructions] =
    useState(false);



  const [showHolidayCalendar,setShowHolidayCalendar] =
    useState(false);



  const POLICY_START_DATE = "2026-09-01";



  const minimumLeaveDate =
    getTomorrowDate() > POLICY_START_DATE
      ? getTomorrowDate()
      : POLICY_START_DATE;
        const filteredApplications = useMemo(() => {

    if (historyFilter === "all") {
      return applications;
    }


    return applications.filter(
      (item) =>
        String(item.status || "")
          .toLowerCase() === historyFilter
    );

  }, [
    applications,
    historyFilter,
  ]);





  const fetchMyLeaveData = async () => {

    try {

      setLoading(true);
      setError("");


      const response =
        await api.get(
          "/administrator-leaves/summary"
        );


      setBalances(
        response.data.balances ||
        DEFAULT_BALANCES
      );


      setApplications(
        response.data.applications ||
        []
      );


    } catch (err) {


      console.error(
        "Leave fetch error:",
        err
      );


      setError(
        err?.response?.data?.message ||
        "Unable to load leave applications."
      );


    } finally {

      setLoading(false);

    }

  };





  const fetchDepartmentLeaves = async () => {

    try {

      const response =
        await api.get(
          "/administrator-leaves/department"
        );


      setDepartmentLeaves(
        response.data.leaves || []
      );


    } catch (err) {

      console.error(
        "Department leave error:",
        err
      );


      setDepartmentLeaves([]);

    }

  };





  const fetchHolidays = async () => {

    try {

      setHolidayLoading(true);


      const response =
        await api.get(
          "/administrator-leaves/holidays"
        );


      setHolidays(
        response.data.holidays || []
      );


    } catch (err) {

      console.error(
        "Holiday fetch error:",
        err
      );


      setHolidays([]);

    } finally {

      setHolidayLoading(false);

    }

  };





  useEffect(() => {

    fetchMyLeaveData();

    fetchDepartmentLeaves();

  }, []);





  const openApplyModal = (type) => {

    setSelectedLeaveType(type);

    setForm({
      ...EMPTY_FORM,
      start_date: "",
      end_date: "",
    });

    setError("");

    setSuccess("");

  };





  const closeApplyModal = () => {

    setSelectedLeaveType(null);

    setForm(EMPTY_FORM);

    setError("");

    setSuccess("");

  };





  const handleFormChange = (field,value) => {

    setForm((previous)=>({

      ...previous,

      [field]: value,

    }));

  };





  const calculateLeaveDays = () => {


    if (
      form.duration_type === "half_day"
    ) {

      return 0.5;

    }



    if (
      !form.start_date ||
      !form.end_date
    ) {

      return 0;

    }



    const start =
      new Date(form.start_date);


    const end =
      new Date(form.end_date);



    if (end < start) {

      return 0;

    }



    const diff =
      Math.ceil(
        (
          end - start
        ) /
        (1000 * 60 * 60 * 24)
      ) + 1;



    return diff;

  };





  const submitLeaveApplication = async () => {


    try {


      setSubmitting(true);

      setError("");

      setSuccess("");



      if (!selectedLeaveType) {

        return;

      }



      if (
        !form.start_date ||
        !form.end_date
      ) {

        setError(
          "Please select leave dates."
        );

        return;

      }



      if (
        form.start_date < minimumLeaveDate
      ) {

        setError(
          "Leave cannot be applied for past dates."
        );

        return;

      }



      const payload = {

        leave_type: selectedLeaveType,

        start_date: form.start_date,

        end_date: form.end_date,

        duration_type:
          form.duration_type,

        half_day_session:
          form.half_day_session,

        reason:
          form.reason,

      };



      await api.post(
        "/administrator-leaves/apply",
        payload
      );



      setSuccess(
        "Leave application submitted successfully."
      );


      await fetchMyLeaveData();


      setTimeout(()=>{

        closeApplyModal();

      },1000);



    } catch(err) {


      console.error(
        "Apply leave error:",
        err
      );


      setError(
        err?.response?.data?.message ||
        "Unable to submit leave application."
      );


    } finally {

      setSubmitting(false);

    }

  };





  const openHolidayCalendar = () => {

    setShowHolidayCalendar(true);

    fetchHolidays();

  };





  const refreshAll = async () => {

    await fetchMyLeaveData();

    await fetchDepartmentLeaves();

  };
    return (

    <div style={styles.page}>


      <div style={styles.header}>


        <div>

          <h1 style={styles.heading}>
            Leave Applications
          </h1>


          <p style={styles.subHeading}>
            Apply and manage your leave requests
          </p>

        </div>



        <div style={styles.headerActions}>


          <button
            style={styles.secondaryBtn}
            onClick={() =>
              setShowInstructions(true)
            }
          >
            Leave Instructions
          </button>



          <button
            style={styles.secondaryBtn}
            onClick={openHolidayCalendar}
          >

            <CalendarDays size={18}/>

            Holidays

          </button>



          <button
            style={styles.secondaryBtn}
            onClick={refreshAll}
          >

            <RefreshCw size={18}/>

            Refresh

          </button>


        </div>


      </div>





      {error && (

        <div style={styles.errorBox}>
          {error}
        </div>

      )}



      {success && (

        <div style={styles.successBox}>
          {success}
        </div>

      )}






      <div style={styles.tabs}>


        <button
          style={
            activeTab === "my"
              ? styles.activeTab
              : styles.tab
          }
          onClick={() =>
            setActiveTab("my")
          }
        >
          My Leave
        </button>



        <button
          style={
            activeTab === "department"
              ? styles.activeTab
              : styles.tab
          }
          onClick={() =>
            setActiveTab("department")
          }
        >
          Department Leaves
        </button>


      </div>






      {activeTab === "my" && (

        <>


          <div style={styles.cardsGrid}>

            {LEAVE_CARDS.map((leave)=>(

              <BalanceCard

                key={leave.key}

                leave={leave}

                balance={
                  balances[leave.key]
                }

                onApply={
                  openApplyModal
                }

              />

            ))}

          </div>





          <div style={styles.historySection}>


            <div style={styles.historyHeader}>


              <h2>
                Leave History
              </h2>



              <div style={styles.filterGroup}>


                {HISTORY_FILTERS.map((filter)=>(

                  <button

                    key={filter}

                    style={
                      historyFilter === filter
                        ? styles.activeFilter
                        : styles.filterBtn
                    }

                    onClick={() =>
                      setHistoryFilter(filter)
                    }

                  >

                    {
                      filter
                        .charAt(0)
                        .toUpperCase() +
                      filter.slice(1)
                    }

                  </button>

                ))}


              </div>


            </div>





            <HistoryTable

              loading={loading}

              applications={
                filteredApplications
              }

            />


          </div>


        </>

      )}








      {activeTab === "department" && (


        <div style={styles.historySection}>


          <div style={styles.historyHeader}>

            <h2>
              Department Leave Applications
            </h2>

          </div>




          <div style={styles.tableWrapper}>


            <table style={styles.table}>


              <thead>

                <tr>

                  <th style={styles.tableHeadCell}>
                    Employee
                  </th>

                  <th style={styles.tableHeadCell}>
                    Leave Type
                  </th>

                  <th style={styles.tableHeadCell}>
                    From
                  </th>

                  <th style={styles.tableHeadCell}>
                    To
                  </th>

                  <th style={styles.tableHeadCell}>
                    Days
                  </th>

                  <th style={styles.tableHeadCell}>
                    Reason
                  </th>

                  <th style={styles.tableHeadCell}>
                    Status
                  </th>

                </tr>

              </thead>




              <tbody>


              {departmentLeaves.length === 0 ? (

                <tr>

                  <td
                    colSpan="7"
                    style={styles.emptyState}
                  >
                    No department leave applications found.
                  </td>

                </tr>

              ) : (


                departmentLeaves.map((leave)=>(


                  <tr key={leave.leave_id}>


                    <td style={styles.tableCell}>
                      {leave.employee_name || "-"}
                    </td>



                    <td style={styles.tableCell}>
                      {getLeaveLabel(
                        leave.leave_type
                      )}
                    </td>



                    <td style={styles.tableCell}>
                      {formatDisplayDate(
                        leave.start_date
                      )}
                    </td>



                    <td style={styles.tableCell}>
                      {formatDisplayDate(
                        leave.end_date
                      )}
                    </td>



                    <td style={styles.tableCell}>
                      {formatDays(
                        leave.total_days
                      )}
                    </td>



                    <td style={styles.tableCell}>
                      {leave.reason || "-"}
                    </td>



                    <td style={styles.tableCell}>

                      <span style={styles.statusBadge}>
                        {leave.status}
                      </span>

                    </td>


                  </tr>


                ))

              )}



              </tbody>


            </table>


          </div>



        </div>


      )}






      {selectedLeaveType && (

        <div style={styles.overlay}>


          <div style={styles.modal}>


            <div style={styles.modalHeader}>

              <h2>
                Apply {
                  getLeaveLabel(
                    selectedLeaveType
                  )
                }
              </h2>


              <button
                style={styles.closeBtn}
                onClick={closeApplyModal}
              >

                <X size={20}/>

              </button>

            </div>





            <label>
              Start Date
            </label>

            <input

              type="date"

              min={minimumLeaveDate}

              value={form.start_date}

              onChange={(e)=>
                handleFormChange(
                  "start_date",
                  e.target.value
                )
              }

            />





            <label>
              End Date
            </label>


            <input

              type="date"

              min={form.start_date || minimumLeaveDate}

              value={form.end_date}

              onChange={(e)=>
                handleFormChange(
                  "end_date",
                  e.target.value
                )
              }

            />





            <label>
              Reason
            </label>


            <textarea

              value={form.reason}

              onChange={(e)=>
                handleFormChange(
                  "reason",
                  e.target.value
                )
              }

            />





            <button

              style={styles.submitBtn}

              disabled={submitting}

              onClick={submitLeaveApplication}

            >

              {submitting
                ? "Submitting..."
                : "Submit Leave"}

            </button>



          </div>


        </div>

      )}






      {showInstructions && (

        <LeaveInstructionsModal

          onClose={() =>
            setShowInstructions(false)
          }

        />

      )}






    </div>

  );

};

const styles = {

  page: {
    padding: "20px 30px",
    minHeight: "100vh",
    background: "#f6f7fb",
  },


  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "25px",
  },


  heading: {
    fontSize: "42px",
    fontWeight: "800",
    margin: 0,
    color: "#111827",
  },


  subHeading: {
    fontSize: "18px",
    color: "#667085",
    marginTop: "8px",
  },


  headerActions: {
    display: "flex",
    gap: "12px",
  },


  secondaryBtn: {
    height: "48px",
    padding: "0 22px",
    borderRadius: "14px",
    border: "1px solid #ff5733",
    background: "#ff5733",
    color: "#fff",
    fontWeight: "700",
    fontSize: "15px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },


  errorBox: {
    background: "#ffe5e5",
    color: "#c62828",
    padding: "14px",
    borderRadius: "12px",
    marginBottom: "15px",
  },


  successBox: {
    background: "#dcfce7",
    color: "#166534",
    padding: "14px",
    borderRadius: "12px",
    marginBottom: "15px",
  },


  tabs: {
    display: "flex",
    gap: "10px",
    marginBottom: "25px",
  },


  tab: {
    padding: "12px 25px",
    borderRadius: "12px",
    border: "none",
    background: "#fff",
    color: "#111827",
    fontWeight: "700",
    cursor: "pointer",
  },


  activeTab: {
    padding: "12px 25px",
    borderRadius: "12px",
    border: "none",
    background: "#ff5733",
    color: "#fff",
    fontWeight: "700",
    cursor: "pointer",
  },


  cardsGrid:{
  display:"grid",
  gridTemplateColumns:"repeat(4,minmax(250px,1fr))",
  gap:"22px",
  width:"100%",
  marginBottom:"10px",
},


  leaveCard: {
  background: "#fff",
  borderRadius: "22px",
  padding: "30px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
  minHeight: "470px",
  height: "auto",
  display: "flex",
  flexDirection: "column",
},


  cardIcon: {
    width: "55px",
    height: "55px",
    borderRadius: "16px",
    background: "#fff0eb",
    color: "#ff5733",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px",
  },


  leaveTitle: {
    fontSize: "26px",
    margin: "0 0 10px",
    fontWeight: "800",
    color: "#111827",
  },


  leaveDescription: {
    color: "#667085",
    fontSize: "15px",
  },


  balanceGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4,1fr)",
    marginTop: "25px",
    gap: "10px",
  },


  balanceStat: {
    textAlign: "center",
  },


  totalNumber:{
    fontSize:"25px",
    display:"block",
  },


  usedNumber:{
    fontSize:"25px",
    display:"block",
  },


  pendingNumber:{
    fontSize:"25px",
    display:"block",
    color:"#ff8a00",
  },


  availableNumber:{
    fontSize:"25px",
    display:"block",
    color:"#16a34a",
  },


  balanceProgressTrack:{
    height:"8px",
    background:"#e5e7eb",
    borderRadius:"20px",
    marginTop:"25px",
  },


  balanceProgressFill:{
    height:"100%",
    background:"#16c76f",
    borderRadius:"20px",
  },


  availableText:{
    textAlign:"right",
    color:"#667085",
  },


  cardInfo:{
    display:"flex",
    flexDirection:"column",
    gap:"8px",
    color:"#667085",
    marginTop:"20px",
  },


  applyBtn:{
    marginTop:"auto",
    height:"55px",
    borderRadius:"15px",
    border:"none",
    background:"#ff5733",
    color:"#fff",
    fontWeight:"700",
    fontSize:"16px",
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    gap:"10px",
    cursor:"pointer",
  },


  disabledApplyBtn:{
    opacity:.5,
  },


  historySection:{
  background:"#fff",
  borderRadius:"22px",
  padding:"22px 25px",
  marginTop:"0px",
},


  historyHeader:{
    display:"flex",
    justifyContent:"space-between",
    alignItems:"center",
    marginBottom:"20px",
  },


 filterGroup:{
    display:"flex",
    gap:"10px",
    alignItems:"center",
},

  filterBtn:{
    border:"1px solid #ddd",
    background:"#fff",
    color:"#111827",
    padding:"10px 20px",
    borderRadius:"10px",
    fontWeight:"700",
    cursor:"pointer",
},


  activeFilter:{
    background:"#ff5733",
    color:"#fff",
    padding:"8px 15px",
    borderRadius:"10px",
    border:"none",
  },


  tableWrapper:{
    overflowX:"auto",
  },


  table:{
    width:"100%",
    borderCollapse:"collapse",
  },


  tableHeadCell:{
    textAlign:"left",
    padding:"15px",
    color:"#667085",
    borderBottom:"1px solid #eee",
  },


  tableCell:{
    padding:"18px 15px",
    borderBottom:"1px solid #eee",
  },


  firstHeadCell:{},

  lastHeadCell:{},

  firstTableCell:{},

  lastTableCell:{},


  statusBadge:{
    padding:"6px 12px",
    borderRadius:"20px",
    background:"#fff0eb",
    color:"#ff5733",
    fontWeight:"700",
  },


  approvedBadge:{
    background:"#dcfce7",
    color:"#16a34a",
  },


  rejectedBadge:{
    background:"#fee2e2",
    color:"#dc2626",
  },


  pendingBadge:{
    background:"#fff7ed",
    color:"#ea580c",
  },


  emptyState:{
    padding:"30px",
    textAlign:"center",
    color:"#667085",
  },


  overlay:{
    position:"fixed",
    inset:0,
    background:"rgba(0,0,0,.45)",
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
  },


  modal:{
    width:"500px",
    background:"#fff",
    padding:"30px",
    borderRadius:"20px",
  },


  modalHeader:{
    display:"flex",
    justifyContent:"space-between",
  },


  closeBtn:{
    border:"none",
    background:"transparent",
    cursor:"pointer",
  },


  submitBtn:{
    marginTop:"20px",
    width:"100%",
    height:"50px",
    background:"#ff5733",
    color:"#fff",
    border:"none",
    borderRadius:"12px",
    fontWeight:"700",
  },


  fullDayBadge:{
    color:"#16a34a",
  },


  halfDayBadge:{
    color:"#ea580c",
  }

};

export default AdministratorLeaveApplications;