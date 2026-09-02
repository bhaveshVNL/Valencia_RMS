const db = require("../config/db");
const {
  sendMail,
} = require("../utils/emailservice");

const HR_FIELD_VISIT_EMAIL =
  "rathika.haleangadi@valencianutrition.com";
const OFFICE_START_MINUTES = 11 * 60; // 11:00 AM
const OFFICE_END_MINUTES = 19 * 60 + 30; // 7:30 PM

const formatDateOnly = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const parseDateOnly = (dateString) => {
  return new Date(`${dateString}T00:00:00`);
};

const addOneDay = (date) => {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
};

const buildWorkingDates = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return [];
  }

  const dates = [];

  let current = parseDateOnly(startDate);
  const last = parseDateOnly(endDate);

  while (current <= last) {
    const day = current.getDay();

    // Sunday = 0
    if (day !== 0) {
      const year = current.getFullYear();
      const month = String(
        current.getMonth() + 1
      ).padStart(2, "0");

      const date = String(
        current.getDate()
      ).padStart(2, "0");

      dates.push(
        `${year}-${month}-${date}`
      );
    }

    current = addOneDay(current);
  }

  return dates;
};

const normalizeStatus = (status) => {
  const value = String(status || "")
    .toLowerCase()
    .trim();

  if (value.includes("leave")) {
    return "leave";
  }

  if (value.includes("late")) {
    return "late";
  }

  if (value.includes("absent")) {
    return "absent";
  }

  if (value.includes("present")) {
    return "present";
  }

  return value || "present";
};

const getDisplayStatus = (status) => {
  const value = normalizeStatus(status);

  if (value === "leave") {
    return "Leave";
  }

  if (value === "late") {
    return "Late";
  }

  if (value === "absent") {
    return "Absent";
  }

  return "Present";
};

const timeToMinutes = (timeValue) => {
  if (!timeValue) {
    return null;
  }

  const parts = String(timeValue).split(":");

  if (parts.length < 2) {
    return null;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null;
  }

  return hours * 60 + minutes;
};

const formatMinutes = (minutes) => {
  const value = Number(minutes || 0);

  if (!value || value <= 0) {
    return "-";
  }

  const hours = Math.floor(
    value / 60
  );

  const mins = value % 60;

  if (hours && mins) {
    return `${hours}h ${mins}m`;
  }

  if (hours) {
    return `${hours}h`;
  }

  return `${mins}m`;
};

const calculateWorkingHours = (
  record
) => {
  if (
    record.total_minutes &&
    Number(record.total_minutes) > 0
  ) {
    return formatMinutes(
      Number(record.total_minutes)
    );
  }

  const checkIn = timeToMinutes(
    record.check_in_time
  );

  const checkOut = timeToMinutes(
    record.check_out_time
  );

  if (
    checkIn === null ||
    checkOut === null
  ) {
    return "-";
  }

  let diff = checkOut - checkIn;

  if (diff < 0) {
    diff += 24 * 60;
  }

  return formatMinutes(diff);
};

/*
  IMPORTANT ATTENDANCE RULE

  Office starts at 11:00 AM.

  Check in at 11:00:00 = Present
  Check in after 11:00:00 = Late

  Leave and Absent always take priority.
*/
const deriveAttendanceStatus = (
  record
) => {
  const storedStatus =
    normalizeStatus(record.status);

  // Never override leave.
  if (storedStatus === "leave") {
    return "leave";
  }

  // Never override explicitly absent.
  if (storedStatus === "absent") {
    return "absent";
  }

  const checkInMinutes =
    timeToMinutes(
      record.check_in_time
    );

  if (checkInMinutes !== null) {
    if (
      checkInMinutes >
      OFFICE_START_MINUTES
    ) {
      return "late";
    }

    return "present";
  }

  // No usable check-in time.
  // Fall back to DB status.
  return storedStatus || "present";
};

const getLateRemark = (
  record,
  finalStatus
) => {
  const originalRemark =
    String(
      record.remarks || ""
    ).trim();

  if (finalStatus !== "late") {
    return originalRemark || "-";
  }

  const checkInMinutes =
    timeToMinutes(
      record.check_in_time
    );

  if (checkInMinutes === null) {
    return (
      originalRemark ||
      "Late"
    );
  }

  const minutesLate =
    checkInMinutes -
    OFFICE_START_MINUTES;

  const automaticRemark =
    minutesLate > 0
      ? `Late by ${minutesLate} minute${minutesLate === 1 ? "" : "s"
      }`
      : "Late";

  if (!originalRemark) {
    return automaticRemark;
  }

  // Avoid repeating a late remark if the CSV/DB already contains it.
  if (
    originalRemark
      .toLowerCase()
      .includes("late")
  ) {
    return originalRemark;
  }

  return `${originalRemark} · ${automaticRemark}`;
};

const getLoggedInAdmin = async (
  req
) => {
  const loggedInUserId =
    req.user?.user_id ||
    req.user?.id ||
    req.user?.userId ||
    req.user?.uid;

  if (!loggedInUserId) {
    return {
      error: {
        status: 401,
        message:
          "Unauthorized. User not found in token.",
      },
    };
  }

  const [rows] = await db.query(
    `
      SELECT
        u.user_id,
        u.employee_code,
        u.full_name,
        u.email,
        u.phone,
        u.designation,
        u.department_id,
        u.status,
        r.role_name,
        d.department_name

      FROM users u

      LEFT JOIN roles r
        ON r.role_id = u.role_id

      LEFT JOIN departments d
        ON d.department_id =
        u.department_id

      WHERE u.user_id = ?

      LIMIT 1
    `,
    [loggedInUserId]
  );

  if (!rows.length) {
    return {
      error: {
        status: 404,
        message:
          "Logged-in admin not found.",
      },
    };
  }

  const admin = rows[0];

  const roleName = String(
    admin.role_name || ""
  )
    .toLowerCase()
    .trim();

  if (roleName !== "admin") {
    return {
      error: {
        status: 403,
        message:
          "Only admin users can access this attendance page.",
      },
    };
  }

  if (!admin.department_id) {
    return {
      error: {
        status: 400,
        message:
          "Admin department is not assigned.",
      },
    };
  }

  return {
    admin,
  };
};

const buildUserAttendanceSummary = ({
  user,
  records,
  workingDates,
}) => {
  const recordMap = new Map();

  records.forEach((record) => {
    const date = formatDateOnly(
      record.attendance_date
    );

    if (!date) {
      return;
    }

    if (!recordMap.has(date)) {
      recordMap.set(
        date,
        record
      );
    }
  });

  let present = 0;
  let absent = 0;
  let late = 0;
  let leave = 0;

  const completedRecords =
    workingDates.map((date) => {
      const record =
        recordMap.get(date);

      if (!record) {
        absent += 1;

        return {
          attendance_id: null,
          employee_id: user.user_id,
          attendance_date: date,

          status: "Absent",

          check_in_time: "-",
          check_out_time: "-",

          total_minutes: 0,
          working_hours: "-",

          remarks:
            "No attendance record",

          is_missing_date: true,
        };
      }

      /*
        THIS IS THE IMPORTANT CHANGE.

        We calculate status based on
        check-in time instead of blindly
        trusting attendance.status.
      */
      const finalStatus =
        deriveAttendanceStatus(
          record
        );

      if (finalStatus === "leave") {
        leave += 1;
      } else if (
        finalStatus === "absent"
      ) {
        absent += 1;
      } else if (
        finalStatus === "late"
      ) {
        /*
          A late employee is still present,
          so both numbers increase.

          Example:
          Present = 37
          Late = 5

          The five late days are included
          within the 37 present days.
        */
        present += 1;
        late += 1;
      } else {
        present += 1;
      }

      return {
        attendance_id:
          record.attendance_id,

        employee_id:
          record.employee_id,

        attendance_date:
          date,

        status:
          getDisplayStatus(
            finalStatus
          ),

        check_in_time:
          record.check_in_time ||
          "-",

        check_out_time:
          record.check_out_time ||
          "-",

        total_minutes:
          Number(
            record.total_minutes ||
            0
          ),

        working_hours:
          calculateWorkingHours(
            record
          ),

        remarks:
          getLateRemark(
            record,
            finalStatus
          ),

        is_missing_date:
          false,

        /*
          Additional information.
          This will be useful later if
          you want early-leaving logic.
        */
        is_late:
          finalStatus === "late",

        office_start_time:
          "11:00:00",

        office_end_time:
          "19:30:00",
      };
    });

  const sortedActualRecords =
    records
      .map((record) => ({
        ...record,

        attendance_date:
          formatDateOnly(
            record.attendance_date
          ),
      }))
      .filter(
        (record) =>
          record.attendance_date
      )
      .sort((a, b) =>
        String(
          b.attendance_date
        ).localeCompare(
          String(
            a.attendance_date
          )
        )
      );

  const latestAttendance =
    sortedActualRecords[0]
      ?.attendance_date || "-";

  return {
    user_id:
      user.user_id,

    employee_code:
      user.employee_code,

    full_name:
      user.full_name,

    email:
      user.email,

    phone:
      user.phone,

    designation:
      user.designation,

    department_id:
      user.department_id,

    department_name:
      user.department_name,

    role_name:
      user.role_name,

    status:
      user.status,

    total:
      workingDates.length,

    present,
    absent,
    late,
    leave,

    latest_attendance_date:
      latestAttendance,

    records:
      completedRecords.sort(
        (a, b) =>
          String(
            b.attendance_date
          ).localeCompare(
            String(
              a.attendance_date
            )
          )
      ),
  };
};

const getDepartmentAttendance = async (
  req,
  res
) => {
  try {
    const {
      admin,
      error,
    } =
      await getLoggedInAdmin(
        req
      );

    if (error) {
      return res
        .status(error.status)
        .json({
          success: false,
          message:
            error.message,
        });
    }

    const [users] =
      await db.query(
        `
          SELECT
            u.user_id,
            u.employee_code,
            u.full_name,
            u.email,
            u.phone,
            u.designation,
            u.department_id,
            u.status,
            r.role_name,
            d.department_name

          FROM users u

          LEFT JOIN roles r
            ON r.role_id =
            u.role_id

          LEFT JOIN departments d
            ON d.department_id =
            u.department_id

          WHERE
            u.department_id = ?

          AND LOWER(
            COALESCE(
              u.status,
              'active'
            )
          ) NOT IN (
            'deleted'
          )

          ORDER BY
            u.full_name ASC
        `,
        [
          admin.department_id,
        ]
      );

    const userIds =
      users.map(
        (user) =>
          user.user_id
      );

    if (!userIds.length) {
      return res
        .status(200)
        .json({
          success: true,

          admin,

          date_range: {
            start_date: null,
            end_date: null,
            working_days: 0,
          },

          my_attendance: null,

          employee_summary: [],

          department_totals: {
            people: 0,
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            leave: 0,
          },
        });
    }

    const [rangeRows] =
      await db.query(
        `
          SELECT
            MIN(a.attendance_date)
              AS start_date,

            MAX(a.attendance_date)
              AS end_date

          FROM attendance a

          WHERE a.employee_id IN (
            ${userIds
          .map(() => "?")
          .join(",")}
          )
        `,
        userIds
      );

    const startDate =
      formatDateOnly(
        rangeRows[0]?.start_date
      );

    const endDate =
      formatDateOnly(
        rangeRows[0]?.end_date
      );

    const workingDates =
      buildWorkingDates(
        startDate,
        endDate
      );

    let attendanceRows = [];

    if (
      startDate &&
      endDate
    ) {
      const [rows] =
        await db.query(
          `
            SELECT
              a.attendance_id,
              a.employee_id,
              a.attendance_date,
              a.check_in_time,
              a.check_out_time,
              a.total_minutes,
              a.status,
              a.remarks

            FROM attendance a

            WHERE
              a.employee_id IN (
                ${userIds
            .map(() => "?")
            .join(",")}
              )

            AND a.attendance_date
              BETWEEN ? AND ?

            ORDER BY
              a.attendance_date DESC
          `,
          [
            ...userIds,
            startDate,
            endDate,
          ]
        );

      attendanceRows =
        rows;
    }

    const summaries =
      users.map(
        (user) => {
          const records =
            attendanceRows.filter(
              (record) =>
                Number(
                  record.employee_id
                ) ===
                Number(
                  user.user_id
                )
            );

          return buildUserAttendanceSummary(
            {
              user,
              records,
              workingDates,
            }
          );
        }
      );

    const myAttendance =
      summaries.find(
        (item) =>
          Number(
            item.user_id
          ) ===
          Number(
            admin.user_id
          )
      ) ||
      buildUserAttendanceSummary(
        {
          user: admin,
          records: [],
          workingDates,
        }
      );

    const employeeSummary =
      summaries.filter(
        (item) =>
          Number(
            item.user_id
          ) !==
          Number(
            admin.user_id
          )
      );

    const departmentTotals =
      employeeSummary.reduce(
        (acc, item) => {
          acc.people += 1;

          acc.total += Number(
            item.total || 0
          );

          acc.present += Number(
            item.present || 0
          );

          acc.absent += Number(
            item.absent || 0
          );

          acc.late += Number(
            item.late || 0
          );

          acc.leave += Number(
            item.leave || 0
          );

          return acc;
        },
        {
          people: 0,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
        }
      );

    return res
      .status(200)
      .json({
        success: true,

        admin,

        office_hours: {
          start_time:
            "11:00:00",

          end_time:
            "19:30:00",

          late_after:
            "11:00:00",
        },

        date_range: {
          start_date:
            startDate,

          end_date:
            endDate,

          working_days:
            workingDates.length,

          note:
            "Absent count is calculated from missing attendance dates and excludes Sundays.",
        },

        my_attendance:
          myAttendance,

        employee_summary:
          employeeSummary,

        department_totals:
          departmentTotals,
      });
  } catch (error) {
    console.error(
      "Get admin department attendance error:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,

        message:
          "Failed to fetch admin attendance.",

        error:
          error.message,

        sqlMessage:
          error.sqlMessage ||
          null,
      });
  }
};

/* =========================================================
   ADMIN - GET DEPARTMENT FIELD VISITS
========================================================= */

const getDepartmentFieldVisits = async (req,res)=>{
  try {

    const { admin, error } =
      await getLoggedInAdmin(req);

    if(error){
      return res.status(error.status).json({
        success:false,
        message:error.message
      });
    }


    const [visits] = await db.query(`
   SELECT

fv.*,

creator.full_name AS full_name,

creator.employee_code,

GROUP_CONCAT(
 DISTINCT members.full_name
 SEPARATOR ', '
) AS team_members,

GROUP_CONCAT(
 DISTINCT members.user_id
 SEPARATOR ','
) AS team_member_ids

FROM employee_field_visits fv

      LEFT JOIN users creator
      ON creator.user_id = fv.employee_id


      LEFT JOIN field_visit_members fvm
      ON fvm.visit_id = fv.visit_id


      LEFT JOIN users members
      ON members.user_id = fvm.employee_id


      GROUP BY fv.visit_id


      ORDER BY fv.visit_date DESC

    `);


    const summary = {
      
      total: visits.length,

      approved:
      visits.filter(v =>
        v.status === "approved"
      ).length,

      pending:
      visits.filter(v =>
        v.status === "pending"
      ).length,

      rejected:
      visits.filter(v =>
        v.status === "rejected"
      ).length,
    };
visits.forEach((visit)=>{

  visit.all_people = [
    visit.full_name,
    ...(visit.team_members
      ? visit.team_members.split(", ")
      : [])
  ];

});

    return res.json({
      success:true,

      summary,

      visits
    });


  } catch(error){

    console.error(
      "Department field visits error",
      error
    );

    return res.status(500).json({
      success:false,
      message:"Failed to fetch field visits"
    });

  }
};


/* =========================================================
   ADMIN - REVIEW FIELD VISIT
========================================================= */

const reviewFieldVisit = async (req, res) => {
  try {
    const { admin, error } =
      await getLoggedInAdmin(req);

    if (error) {
      return res
        .status(error.status)
        .json({
          success: false,
          message: error.message,
        });
    }

    const visitId =
      Number(req.params.visitId);

    if (!visitId) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid field visit.",
      });
    }

    const status =
      String(
        req.body?.status || ""
      )
        .toLowerCase()
        .trim();

    const reviewRemark =
      String(
        req.body?.review_remark ||
        req.body?.remark ||
        ""
      ).trim();

    if (
      ![
        "approved",
        "rejected",
      ].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Status must be approved or rejected.",
      });
    }

    /*
    Verify that this visit belongs
    to an employee in THIS Admin's department.
    */

    const [visitRows] =
      await db.query(
        `
        SELECT
          fv.visit_id,
          fv.employee_id,
          fv.status,

          employee.full_name,
          employee.department_id

        FROM employee_field_visits fv

        INNER JOIN users employee
          ON employee.user_id =
             fv.employee_id

        WHERE
          fv.visit_id = ?

          AND employee.department_id = ?

        LIMIT 1
        `,
        [
          visitId,
          admin.department_id,
        ]
      );


    if (!visitRows.length) {
      return res.status(404).json({
        success: false,
        message:
          "Field visit not found for your department.",
      });
    }

    const currentVisit =
      visitRows[0];

    if (
      String(
        currentVisit.status || ""
      ).toLowerCase() !==
      "pending"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only pending field visits can be reviewed.",
      });
    }

    await db.query(
      `
      UPDATE employee_field_visits

      SET
        status = ?,
        reviewed_by = ?,
        reviewed_at = NOW(),
        review_remark = ?,
        updated_at = NOW()

      WHERE visit_id = ?
      `,
      [
        status,
        admin.user_id,
        reviewRemark || null,
        visitId,
      ]
    );

    const [updatedRows] =
      await db.query(
        `
        SELECT
          fv.visit_id,
          fv.employee_id,
          fv.visit_type,

          DATE_FORMAT(
            fv.visit_date,
            '%Y-%m-%d'
          ) AS visit_date,

          TIME_FORMAT(
            fv.start_time,
            '%H:%i'
          ) AS start_time,

          TIME_FORMAT(
            fv.end_time,
            '%H:%i'
          ) AS end_time,

          fv.location,
          fv.comment,
          fv.status,
          fv.review_remark,

          DATE_FORMAT(
            fv.reviewed_at,
            '%Y-%m-%d %H:%i:%s'
          ) AS reviewed_at,

          employee.full_name,
          employee.email,

          reviewer.full_name
            AS reviewed_by_name

        FROM employee_field_visits fv

        INNER JOIN users employee
          ON employee.user_id =
             fv.employee_id

        LEFT JOIN users reviewer
          ON reviewer.user_id =
             fv.reviewed_by

        WHERE fv.visit_id = ?

        LIMIT 1
        `,
        [visitId]
      );

    return res.json({
      success: true,

      message:
        status === "approved"
          ? "Field visit approved successfully."
          : "Field visit rejected successfully.",

      visit:
        updatedRows[0] || null,
    });
  } catch (error) {
    console.error(
      "Review field visit error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to review field visit.",

      error:
        error.message,

      sqlMessage:
        error.sqlMessage || null,
    });
  }
};
/* =========================================================
   ADMIN - ADD OWN FIELD VISIT
========================================================= */

const createAdminFieldVisit = async (
  req,
  res
) => {
  try {

    const {
      admin,
      error,
    } =
      await getLoggedInAdmin(req);

    if (error) {
      return res
        .status(error.status)
        .json({
          success:false,
          message:error.message,
        });
    }


    const visitType =
      String(
        req.body?.visit_type ||
        "Sales Visit"
      ).trim();


    const visitDate =
      String(
        req.body?.visit_date ||
        ""
      ).trim();


    const startTime =
      String(
        req.body?.start_time ||
        ""
      ).trim();


    const endTime =
      String(
        req.body?.end_time ||
        ""
      ).trim();


    const location =
      String(
        req.body?.location ||
        ""
      ).trim();


    const comment =
      String(
        req.body?.comment ||
        ""
      ).trim();


    const visitorIds =
      Array.isArray(
        req.body?.visitor_ids
      )
        ? req.body.visitor_ids
        : [];



    if(!visitDate){
      return res.status(400).json({
        success:false,
        message:"Visit date is required."
      });
    }


    if(!startTime || !endTime){
      return res.status(400).json({
        success:false,
        message:"Start time and end time are required."
      });
    }


    if(endTime <= startTime){
      return res.status(400).json({
        success:false,
        message:"End time must be later than start time."
      });
    }


    if(!location){
      return res.status(400).json({
        success:false,
        message:"Location is required."
      });
    }


    if(!comment){
      return res.status(400).json({
        success:false,
        message:"Comment / reason is required."
      });
    }



    /*
      CREATE MAIN VISIT
    */

    const [result] =
      await db.query(
        `
        INSERT INTO employee_field_visits
        (
          employee_id,
          visit_type,
          visit_date,
          start_time,
          end_time,
          location,
          comment,
          status
        )

        VALUES
        (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          'approved'
        )
        `,
        [
          admin.user_id,
          visitType,
          visitDate,
          startTime,
          endTime,
          location,
          comment
        ]
      );



    /*
      SAVE TEAM MEMBERS
    */

    if(visitorIds.length){

      const memberValues =
        visitorIds
        .filter(
          id =>
            Number(id) !== Number(admin.user_id)
        )
        .map(id=>[
          result.insertId,
          Number(id)
        ]);


      if(memberValues.length){

        await db.query(
          `
          INSERT INTO field_visit_members
          (
            visit_id,
            employee_id
          )

          VALUES ?
          `,
          [
            memberValues
          ]
        );

      }

    }



    const [visitRows] =
      await db.query(
        `
        SELECT

        fv.*,

        creator.full_name,

        GROUP_CONCAT(
          DISTINCT members.full_name
          SEPARATOR ', '
        ) AS team_members


        FROM employee_field_visits fv


        LEFT JOIN users creator
        ON creator.user_id =
        fv.employee_id


        LEFT JOIN field_visit_members fvm
        ON fvm.visit_id =
        fv.visit_id


        LEFT JOIN users members
        ON members.user_id =
        fvm.employee_id


        WHERE fv.visit_id = ?


        GROUP BY fv.visit_id

        LIMIT 1
        `,
        [
          result.insertId
        ]
      );

    
// ===============================
// SEND FIELD VISIT CONFIRMATION MAIL
// ADMIN + TEAM MEMBERS + HR
// ===============================

try {

  const teamIds = visitorIds.filter(
    id =>
      Number(id) !== Number(admin.user_id)
  );


 let recipientEmails = [];

if(admin.email){
  recipientEmails.push(admin.email);
}


  if(teamIds.length){

    const [memberEmails] =
      await db.query(
        `
        SELECT email
        FROM users
        WHERE user_id IN (?)
        AND email IS NOT NULL
        `,
        [
          teamIds
        ]
      );


    recipientEmails.push(
      ...memberEmails.map(
        user => user.email
      )
    );

  }


  // Add HR
  recipientEmails.push(
    HR_FIELD_VISIT_EMAIL
  );


  // Remove duplicates
  recipientEmails =
    [
      ...new Set(recipientEmails)
    ];



  await sendMail({

    to: recipientEmails.join(","),

    subject:
      "Field Visit Confirmation",


    html: `

    <h3>Field Visit Recorded</h3>

    <p>Hello,</p>

    <p>
      A field visit has been recorded successfully.
    </p>


    <p>
      <b>Created By:</b>
      ${admin.full_name}
      <br/>

      <b>Date:</b>
      ${visitDate}
      <br/>

      <b>Time:</b>
      ${startTime} - ${endTime}
      <br/>

      <b>Location:</b>
      ${location}
      <br/>

      <b>Visit Type:</b>
      ${visitType}
      <br/>

      <b>Purpose:</b>
      ${comment}
    </p>


    <p>
      This is a confirmation notification.
    </p>

    `

  });


} catch(mailError){

  console.error(
    "Field visit confirmation email failed:",
    mailError
  );

}

    return res.status(201).json({

      

      success:true,

      message:
      "Field visit added successfully.",

      visit:
      visitRows[0] || null

    });



  } catch(error){

    console.error(
      "Create Admin field visit error:",
      error
    );


    return res.status(500).json({

      success:false,

      message:
      "Failed to add field visit.",

      error:
      error.message

    });

  }
};
/* =========================================================
   ADMIN - GET OWN FIELD VISITS
========================================================= */

const getAdminFieldVisits = async (
  req,
  res
) => {

  try {

    const {
      admin,
      error
    } =
    await getLoggedInAdmin(req);


    if(error){

      return res
      .status(error.status)
      .json({
        success:false,
        message:error.message
      });

    }



    const [visits] =
    await db.query(
      `
      SELECT


      fv.visit_id,

      fv.employee_id,


      creator.full_name,


      fv.visit_type,


      DATE_FORMAT(
        fv.visit_date,
        '%Y-%m-%d'
      ) AS visit_date,


      TIME_FORMAT(
        fv.start_time,
        '%H:%i'
      ) AS start_time,


      TIME_FORMAT(
        fv.end_time,
        '%H:%i'
      ) AS end_time,


      fv.location,

      fv.comment,

      fv.status,


      GROUP_CONCAT(
        DISTINCT members.full_name
        SEPARATOR ', '
      ) AS team_members



      FROM employee_field_visits fv



      LEFT JOIN users creator

      ON creator.user_id =
      fv.employee_id



      LEFT JOIN field_visit_members fvm

      ON fvm.visit_id =
      fv.visit_id



      LEFT JOIN users members

      ON members.user_id =
      fvm.employee_id



      WHERE fv.employee_id = ?



      GROUP BY fv.visit_id



      ORDER BY fv.visit_date DESC

      `,
      [
        admin.user_id
      ]
    );




    visits.forEach((visit)=>{

      visit.all_people = [

        visit.full_name,

        ...(visit.team_members
        ? visit.team_members.split(", ")
        : [])

      ];

    });



    return res.json({

      success:true,

      visits

    });



  } catch(error){


    console.error(
      "Get Admin field visits error:",
      error
    );


    return res.status(500).json({

      success:false,

      message:
      "Failed to fetch Admin field visits.",

      error:
      error.message

    });

  }

};

const getEmployeesForFieldVisit = async (req,res)=>{
  try {

    const [employees] = await db.query(`
      SELECT
        u.user_id,
        u.full_name,
        u.employee_code
      FROM users u
      INNER JOIN roles r
        ON r.role_id = u.role_id
      WHERE LOWER(r.role_name) IN ('employee','admin','administrator')
      ORDER BY u.full_name ASC
    `);

    return res.json({
      success:true,
      employees
    });

  } catch(error){

    console.error(
      "Get employees field visit error:",
      error
    );

    return res.status(500).json({
      success:false,
      message:"Failed to fetch employees"
    });
  }
};
module.exports = {

  getDepartmentAttendance,

  getDepartmentFieldVisits,

  reviewFieldVisit,

  getAdminDepartmentAttendance:
    getDepartmentAttendance,

  getAdminAttendance:
    getDepartmentAttendance,

  createAdminFieldVisit,

  getAdminFieldVisits,

  getEmployeesForFieldVisit,

};