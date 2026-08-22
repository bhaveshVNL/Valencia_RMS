import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  X,
} from "lucide-react";


const API = "http://localhost:5000/api";

const getAuthHeaders = () => ({
  Authorization:
    "Bearer " +
    (sessionStorage.getItem("token") ||
      localStorage.getItem("token") ||
      ""),
  "Content-Type": "application/json",
});


const AdminCalendar = () => {
  const today = new Date();

  const [currentDate, setCurrentDate] =
    useState(new Date());

  const [events, setEvents] = useState({
    projects: [],
    tasks: [],
    meetings: [],
    mini_tasks: [],
  });

  const [showMeeting, setShowMeeting] =
    useState(false);

  const [employees, setEmployees] =
    useState([]);

  const [selectedEmployees, setSelectedEmployees] =
    useState([]);

  const [selectedDate, setSelectedDate] =
    useState("");

  const [meetingForm, setMeetingForm] =
    useState({
      title: "",
      description: "",
      date: "",
      start_time: "",
      end_time: "",
    });


const loadCalendar = async () => {
  try {

    const res = await fetch(
      `${API}/calendar/admin`,
      {
        headers:getAuthHeaders(),
      }
    );

    const data =
      await res.json();


    if(data.success){

      setEvents({

        projects:
          data.projects || [],

        tasks:
          data.tasks || [],

        meetings:
          data.meetings || [],

        mini_tasks:
          data.mini_tasks || [],

      });

    }

  } catch(error){

    console.log(
      "Calendar loading error",
      error
    );

  }
};


  const loadEmployees = async () => {
    try {

      const res = await fetch(
        `${API}/calendar/employees`,
        {
          headers: getAuthHeaders(),
        }
      );

      const data = await res.json();

      if (data.success) {
        setEmployees(
          data.employees || []
        );
      }

    } catch(error){
      console.log(error);
    }
  };


  useEffect(() => {
    loadCalendar();
    loadEmployees();
  }, []);



  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();



  const daysInMonth =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();



  const calendarDays =
    useMemo(() => {

      const arr = [];

      for(
        let i = 0;
        i < firstDay;
        i++
      ){
        arr.push(null);
      }


      for(
        let i = 1;
        i <= daysInMonth;
        i++
      ){
        arr.push(i);
      }

      return arr;

    },[
      year,
      month
    ]);



  const formatDate = (day) => {

    return `${year}-${String(
      month + 1
    ).padStart(2,"0")}-${String(day)
      .padStart(2,"0")}`;

  };



  const eventsForDay = (day) => {

    if(!day)
      return [];


    const date =
      formatDate(day);


    const result = [];


    events.projects.forEach(
      (item)=>{

        if(
          date >= item.start_date &&
          date <= item.end_date
        ){
          result.push({
            type:"project",
            title:item.title
          });
        }

      }
    );


    events.tasks.forEach(
      (item)=>{

        if(
          date >= item.start_date &&
          date <= item.end_date
        ){

          result.push({
            type:"task",
            title:item.title
          });

        }

      }
    );



    events.meetings.forEach(
      (item)=>{

        if(
          item.meeting_date === date
        ){

          result.push({
            type:"meeting",
            title:item.title,
            time:
              `${item.start_time}`
          });

        }

      }
    );


    events.mini_tasks.forEach(
      (item)=>{

        if(
          item.task_date === date
        ){

          result.push({
            type:"mini",
            title:item.title
          });

        }

      }
    );


    return result;

  };



  const openMeeting = (day)=>{

    const date =
      formatDate(day);


    setSelectedDate(date);


    setMeetingForm({
      title:"",
      description:"",
      date,
      start_time:"",
      end_time:"",
    });


    setShowMeeting(true);

  };



  const createMeeting = async()=>{

    try{

      const res =
        await fetch(
          `${API}/calendar/meetings`,
          {
            method:"POST",
            headers:getAuthHeaders(),

            body:JSON.stringify({

              title:
                meetingForm.title,

              description:
                meetingForm.description,

              meeting_date:
                meetingForm.date,

              start_time:
                meetingForm.start_time,

              end_time:
                meetingForm.end_time,

              employee_ids:
                selectedEmployees,

            }),

          }
        );


      const data =
        await res.json();


      if(data.success){

        setShowMeeting(false);

        setSelectedEmployees([]);

        loadCalendar();

      }
      else{
        alert(data.message);
      }

    }
    catch(error){
      console.log(error);
    }

  };



  return (

<div className="calendar-page">


<div className="calendar-header">

<div>
<h2>
<CalendarDays size={26}/>
Calendar
</h2>

<p>
Projects, tasks and meetings
</p>
</div>


<button
className="calendar-add-btn"
onClick={()=>
setShowMeeting(true)
}
>

<Plus size={18}/>
Schedule Meeting

</button>

</div>



<div className="calendar-box">


<div className="calendar-top">

<button
onClick={()=>
setCurrentDate(
new Date(
year,
month-1,
1
)
)
}
>
<ChevronLeft/>
</button>


<h3>
{
currentDate.toLocaleString(
"default",
{
month:"long",
year:"numeric"
}
)
}
</h3>


<button
onClick={()=>
setCurrentDate(
new Date(
year,
month+1,
1
)
)
}
>
<ChevronRight/>
</button>

</div>




<div className="week-row">

{
[
"Sun",
"Mon",
"Tue",
"Wed",
"Thu",
"Fri",
"Sat"
]
.map(day=>
<div key={day}>
{day}
</div>
)
}

</div>



<div className="calendar-grid">


{
calendarDays.map(
(day,index)=>(

<div
key={index}
className={
day
?
"calendar-day"
:
"calendar-empty"
}
onClick={()=>
day &&
openMeeting(day)
}
>


{
day &&
<>

<div className="day-number">
{day}
</div>


<div className="event-list">

{
eventsForDay(day)
.slice(0,4)
.map(
(event,i)=>(

<div
key={i}
className={
`event-pill ${event.type}`
}
>

{event.time &&
<Clock size={12}/>
}

{event.title}

</div>

))
}

</div>

</>

}


</div>

))
}


</div>


</div>




{
showMeeting &&


<div className="meeting-overlay">


<div className="meeting-modal">


<div className="modal-header">

<h3>
Schedule Meeting
</h3>


<button
onClick={()=>
setShowMeeting(false)
}
>

<X/>

</button>


</div>



<input
placeholder="Meeting title"
value={
meetingForm.title
}
onChange={
e=>
setMeetingForm({
...meetingForm,
title:e.target.value
})
}
/>



<textarea
placeholder="Description"
value={
meetingForm.description
}
onChange={
e=>
setMeetingForm({
...meetingForm,
description:e.target.value
})
}
/>



<div className="time-row">

<input
type="date"
value={
meetingForm.date
}
onChange={
e=>
setMeetingForm({
...meetingForm,
date:e.target.value
})
}
/>


<input
type="time"
value={
meetingForm.start_time
}
onChange={
e=>
setMeetingForm({
...meetingForm,
start_time:e.target.value
})
}
/>


<input
type="time"
value={
meetingForm.end_time
}
onChange={
e=>
setMeetingForm({
...meetingForm,
end_time:e.target.value
})
}
/>

</div>



<h4>
Select Employees
</h4>


<div className="employee-select">

{
employees.map(
(emp)=>(

<label key={emp.user_id}>

<input
type="checkbox"
checked={
selectedEmployees.includes(
emp.user_id
)
}

onChange={()=>{

setSelectedEmployees(
prev=>
prev.includes(
emp.user_id
)

?
prev.filter(
id=>
id!==emp.user_id
)

:
[
...prev,
emp.user_id
]

)

}}
/>

{emp.full_name}

</label>

))
}

</div>



<div className="modal-actions">

<button
className="cancel-btn"
onClick={()=>
setShowMeeting(false)
}
>
Cancel
</button>


<button
className="save-btn"
onClick={createMeeting}
>
Schedule
</button>


</div>


</div>

</div>

}


</div>

  );
};


export default AdminCalendar;