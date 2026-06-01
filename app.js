/**
 * Vial — Medicine Injection Tracker
 * Clinical Patient Database & Weekly Schedule Logic
 */

// 1. In-Memory Database & Seed Data
let patients = [];
let currentMonth = null; // Date object representing the currently viewed month

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_FULL = {
  "Mon": "Monday",
  "Tue": "Tuesday",
  "Wed": "Wednesday",
  "Thu": "Thursday",
  "Fri": "Friday",
  "Sat": "Saturday",
  "Sun": "Sunday"
};

// Seed patients data if LocalStorage is empty
function seedDatabase() {
  const localData = localStorage.getItem("vial_patients");
  if (localData) {
    patients = JSON.parse(localData);
  } else {
    // High-quality mock patients to give a fully functional clinical view immediately
    patients = [
      {
        id: "pat_1",
        name: "Johnathan Doe",
        dob: "1982-04-12",
        phone: "(555) 019-2834",
        medicine: "B12 Methylcobalamin",
        dose: "1000 mcg / 1 mL",
        site: "Left Deltoid",
        availableDays: ["Mon", "Wed", "Fri"],
        usualDay: "Mon",
        usualTime: "09:00",
        notes: "Patient prefers a slow injection. Monitor for mild site redness. Patient has a mild penicillin allergy.",
        injectionLogs: ["2026-05-25"] // Completed on Monday of the current week (May 25, 2026)
      },
      {
        id: "pat_2",
        name: "Eleanor Vance",
        dob: "1954-11-28",
        phone: "(555) 048-1192",
        medicine: "Ozempic (Semaglutide)",
        dose: "0.5 mg / 0.37 mL",
        site: "Right Abdomen",
        availableDays: ["Wed", "Fri"],
        usualDay: "Wed",
        usualTime: "10:30",
        notes: "Check blood glucose levels prior to administration. Remind patient about weekly dietary guidelines.",
        injectionLogs: [] // Pending for this week
      },
      {
        id: "pat_3",
        name: "Marcus Brody",
        dob: "1968-07-03",
        phone: "(555) 091-8837",
        medicine: "Methotrexate",
        dose: "15 mg / 0.6 mL",
        site: "Left Thigh",
        availableDays: ["Tue", "Thu", "Fri"],
        usualDay: "Fri",
        usualTime: "14:00",
        notes: "Administer with a high-gauge needle. Patient takes folic acid daily. Check blood count lab sheet monthly.",
        injectionLogs: [] // Pending for this week
      },
      {
        id: "pat_4",
        name: "Sarah Jenkins",
        dob: "1991-09-15",
        phone: "(555) 022-7711",
        medicine: "Humira (Adalimumab)",
        dose: "40 mg / 0.4 mL",
        site: "Right Thigh",
        availableDays: ["Sat", "Sun"],
        usualDay: "Sun",
        usualTime: "08:00",
        notes: "Keep medication refrigerated until 30 minutes before injection. Patient self-injects occasionally under supervision.",
        injectionLogs: ["2026-05-31"] // Completed today (Sunday May 31, 2026)
      }
    ];
    saveToLocalStorage();
  }
}

function saveToLocalStorage() {
  localStorage.setItem("vial_patients", JSON.stringify(patients));
  updateDashboardStats();
}

// 2. Helper Date & Calendar Utilities

// Returns the Monday date of the week containing the given date
function getStartOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  // Adjust so Sunday is day index 6, Monday is index 0
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Format Date object to YYYY-MM-DD
function formatDateString(date) {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

// Get the date of a specific weekday in the currently viewed week
function getDateOfWeekday(weekdayName, startOfWeekMonday) {
  const dayIndex = WEEKDAYS.indexOf(weekdayName);
  if (dayIndex === -1) return null;
  const result = new Date(startOfWeekMonday);
  result.setDate(startOfWeekMonday.getDate() + dayIndex);
  return result;
}

// Checks if a patient was injected during the currently viewed week (Monday to Sunday)
function isInjectedInWeek(patient, mondayDate) {
  const weekStartStr = formatDateString(mondayDate);
  const sundayDate = new Date(mondayDate);
  sundayDate.setDate(mondayDate.getDate() + 6);
  const weekEndStr = formatDateString(sundayDate);

  return patient.injectionLogs.some(logDate => {
    return logDate >= weekStartStr && logDate <= weekEndStr;
  });
}

// Checks if a patient was injected during the week containing the given date (Monday to Sunday)
function isInjectedInWeekOfDate(patient, cellDate) {
  const monday = getStartOfWeek(cellDate);
  return isInjectedInWeek(patient, monday);
}

// Format Date into user-friendly "date month year" e.g., "25 May 2026"
function formatPrettyDate(date) {
  const d = new Date(date);
  const day = d.getDate();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

// Calculate age from date of birth
function calculateAge(dobStr) {
  const dob = new Date(dobStr);
  const diff = Date.now() - dob.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

// 3. UI Core Renderers

// Initialize Dashboard Overview Metrics
function updateDashboardStats() {
  const todayDate = new Date();
  const todayDayName = WEEKDAYS[todayDate.getDay() === 0 ? 6 : todayDate.getDay() - 1]; // Mon=0, Sun=6
  const currentMon = getStartOfWeek(todayDate);

  // Due Today count: patients whose usual injection day is today
  const dueToday = patients.filter(p => p.usualDay === todayDayName).length;
  document.getElementById("metric-due-today").textContent = dueToday;

  // Total patients
  document.getElementById("metric-total").textContent = patients.length;

  // Week Completion percentage
  if (patients.length === 0) {
    document.getElementById("metric-completion").textContent = "0%";
    document.getElementById("sub-nav-stats").textContent = "0 of 0 Injected";
    return;
  }

  const injectedThisWeek = patients.filter(p => isInjectedInWeek(p, currentMon)).length;
  const completionPercent = Math.round((injectedThisWeek / patients.length) * 100);
  document.getElementById("metric-completion").textContent = `${completionPercent}%`;

  // Sub-nav text updater
  document.getElementById("sub-nav-stats").textContent = `${injectedThisWeek} of ${patients.length} Injected This Week`;
}

// Render the 35 or 42 cell monthly calendar view
function renderMonthlyCalendar() {
  const gridContainer = document.getElementById("monthly-calendar-grid");
  if (!gridContainer) return;
  gridContainer.innerHTML = "";

  const today = new Date();
  const todayStr = formatDateString(today);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Format Month & Year for Header (e.g. "June 2026")
  const monthNamesFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  document.getElementById("calendar-month-label").textContent = `${monthNamesFull[month]} ${year}`;

  // 1. Render Weekday Header Row inside the grid container first
  WEEKDAYS.forEach(dayName => {
    const headerCell = document.createElement("div");
    headerCell.className = "monthly-day-header-cell";
    headerCell.textContent = dayName;
    gridContainer.appendChild(headerCell);
  });

  // 2. Calculate dates for month sheet grid
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const numDaysInMonth = lastDayOfMonth.getDate();

  // Get Monday-based start offset of the 1st of the month (0=Mon, 6=Sun)
  let startOffset = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;

  const prevMonthLastDay = new Date(year, month, 0).getDate();

  // Total grid cells needed to complete full 7-cell rows (usually 35 or 42)
  const totalCells = Math.ceil((startOffset + numDaysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement("div");
    let cellDate = null;
    let isOtherMonth = false;

    if (i < startOffset) {
      // Previous Month cell padding
      const prevDayNum = prevMonthLastDay - startOffset + i + 1;
      cellDate = new Date(year, month - 1, prevDayNum);
      isOtherMonth = true;
    } else if (i >= startOffset + numDaysInMonth) {
      // Next Month cell padding
      const nextDayNum = i - startOffset - numDaysInMonth + 1;
      cellDate = new Date(year, month + 1, nextDayNum);
      isOtherMonth = true;
    } else {
      // Current Month day cell
      const dayNum = i - startOffset + 1;
      cellDate = new Date(year, month, dayNum);
    }

    const cellDateStr = formatDateString(cellDate);
    const isToday = cellDateStr === todayStr;

    cell.className = `monthly-day-cell ${isToday ? "today" : ""} ${isOtherMonth ? "other-month" : ""}`;

    // Number bubble
    const numBubble = document.createElement("div");
    numBubble.className = "monthly-day-cell-number-bubble";
    numBubble.textContent = cellDate.getDate();
    cell.appendChild(numBubble);

    // Events/Injections Container inside the day cell
    const cellEvents = document.createElement("div");
    cellEvents.className = "monthly-day-cell-events";

    // Filter patients whose usual injection scheduled day is this cell's weekday
    const cellDayIndex = cellDate.getDay() === 0 ? 6 : cellDate.getDay() - 1; // Mon=0, Sun=6
    const cellDayName = WEEKDAYS[cellDayIndex];
    
    const scheduledPatients = patients.filter(p => p.usualDay === cellDayName);

    if (scheduledPatients.length > 0) {
      scheduledPatients.forEach(patient => {
        // Check if injected in the week of this specific cell date
        const injectedThisWeek = isInjectedInWeekOfDate(patient, cellDate);

        const patientBubble = document.createElement("div");
        patientBubble.className = `calendar-patient-bubble ${injectedThisWeek ? "completed" : "pending"}`;
        patientBubble.dataset.patientId = patient.id;

        // Display name
        const title = document.createElement("span");
        title.className = "bubble-title";
        title.textContent = patient.name;
        if (!injectedThisWeek) {
          title.style.fontWeight = "600";
          title.style.color = "var(--color-primary)"; // Highlights patients NOT injected
        }

        const timeRow = document.createElement("div");
        timeRow.className = "bubble-time";
        timeRow.innerHTML = `
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          ${patient.usualTime}
        `;

        const checkBtn = document.createElement("button");
        checkBtn.className = "bubble-check-btn";
        checkBtn.innerHTML = `
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;

        // Toggle completion on this date
        checkBtn.onclick = (e) => {
          e.stopPropagation();
          toggleInjectionStatus(patient.id, cellDateStr);
        };

        patientBubble.onclick = (e) => {
          if (e.target.closest(".bubble-check-btn")) return;
          openPatientDetails(patient.id);
        };

        patientBubble.appendChild(title);
        patientBubble.appendChild(timeRow);
        patientBubble.appendChild(checkBtn);
        cellEvents.appendChild(patientBubble);
      });
    }

    cell.appendChild(cellEvents);
    gridContainer.appendChild(cell);
  }
}

// Toggle whether patient has completed the medicine injection on a specific date
function toggleInjectionStatus(patientId, dateStr) {
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;

  const logIdx = patient.injectionLogs.indexOf(dateStr);
  if (logIdx > -1) {
    // Remove if clicked again (undo action)
    patient.injectionLogs.splice(logIdx, 1);
  } else {
    // Add completion log timestamp
    patient.injectionLogs.push(dateStr);
  }

  saveToLocalStorage();
  renderMonthlyCalendar();
  renderPatientDirectory();
}

// Render the Patient Directory Search List
function renderPatientDirectory() {
  const gridContainer = document.getElementById("patient-cards-grid");
  const searchVal = document.getElementById("patient-search-input").value.toLowerCase();
  const activeFilter = document.querySelector(".filter-chip.active").dataset.filter;

  // Clear previous grid, keeping empty state helper
  const emptyState = document.getElementById("empty-state");
  gridContainer.innerHTML = "";
  gridContainer.appendChild(emptyState);

  const currentMon = getStartOfWeek(new Date());

  // Filter & Search calculation
  const filteredPatients = patients.filter(patient => {
    // Search match fields: Name, Medicine, notes
    const matchSearch = patient.name.toLowerCase().includes(searchVal) ||
                        patient.medicine.toLowerCase().includes(searchVal) ||
                        patient.site.toLowerCase().includes(searchVal) ||
                        patient.notes.toLowerCase().includes(searchVal);

    if (!matchSearch) return false;

    // Filter chip match
    const injectedThisWeek = isInjectedInWeek(patient, currentMon);
    if (activeFilter === "pending" && injectedThisWeek) return false;
    if (activeFilter === "completed" && !injectedThisWeek) return false;

    return true;
  });

  if (filteredPatients.length === 0) {
    emptyState.style.display = "flex";
  } else {
    emptyState.style.display = "none";
    
    filteredPatients.forEach(patient => {
      const injectedThisWeek = isInjectedInWeek(patient, currentMon);
      
      const card = document.createElement("div");
      card.className = "store-utility-card";

      // HTML template for patient card styled in Apple Store Grid Card chassis
      card.innerHTML = `
        <div class="card-status-pill ${injectedThisWeek ? "completed" : "pending"}">
          ${injectedThisWeek ? "Completed" : "Pending Injection"}
        </div>
        
        <div class="patient-card-body">
          <div class="card-ill-box">
            <!-- Medicine Vial minimal SVG icon -->
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 3h12M10 6v15M14 6v15M9 21h6" />
              <rect x="8" y="6" width="8" height="15" rx="1" />
            </svg>
          </div>
          
          <h3>${patient.name}</h3>
          <p class="patient-card-med">${patient.medicine} (${patient.dose})</p>
          
          <div class="patient-meta-list">
            <div class="meta-item">
              <span class="meta-label">Schedule:</span> ${WEEKDAYS_FULL[patient.usualDay]}s at ${patient.usualTime}
            </div>
            <div class="meta-item">
              <span class="meta-label">Clinic Days:</span> ${patient.availableDays.join(", ")}
            </div>
            <div class="meta-item">
              <span class="meta-label">Injection Site:</span> ${patient.site}
            </div>
          </div>
        </div>

        <div class="card-actions">
          <a class="text-link" onclick="openPatientDetails('${patient.id}')">View Profile</a>
          <button class="button-pearl-capsule" onclick="openEditPatientForm('${patient.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            Edit
          </button>
        </div>
      `;

      gridContainer.appendChild(card);
    });
  }
}

// 4. Patient Profile Details Modal
function openPatientDetails(patientId) {
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;

  const detailBody = document.getElementById("detail-modal-body");
  const age = calculateAge(patient.dob);

  // Generate logs history list
  let logsHtml = `<p style="font-size: 14px; color: var(--color-ink-muted-48); font-style: italic;">No past injections logged.</p>`;
  if (patient.injectionLogs.length > 0) {
    const sortedLogs = [...patient.injectionLogs].sort().reverse();
    logsHtml = `
      <div class="detail-history-list">
        ${sortedLogs.map(logDate => {
          const logDateObj = new Date(logDate);
          return `
            <div class="history-item">
              <span class="history-item-date">${formatPrettyDate(logDateObj)}</span>
              <span class="history-item-badge">Injected</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  detailBody.innerHTML = `
    <div class="detail-main-header">
      <div class="detail-patient-avatar">
        ${patient.name.charAt(0)}
      </div>
      <div class="detail-main-info">
        <h2>${patient.name}</h2>
        <p>DOB: ${patient.dob} (Age ${age}) · Phone: ${patient.phone}</p>
      </div>
    </div>

    <div class="detail-grid-section">
      <div class="detail-grid-item">
        <div class="detail-grid-item-label">Prescribed Medicine</div>
        <div class="detail-grid-item-value">${patient.medicine}</div>
      </div>
      <div class="detail-grid-item">
        <div class="detail-grid-item-label">Dosage Quantity</div>
        <div class="detail-grid-item-value">${patient.dose}</div>
      </div>
      <div class="detail-grid-item">
        <div class="detail-grid-item-label">Clinic Availability</div>
        <div class="detail-grid-item-value">${patient.availableDays.join(", ")}</div>
      </div>
      <div class="detail-grid-item">
        <div class="detail-grid-item-label">Preferred Time</div>
        <div class="detail-grid-item-value">${WEEKDAYS_FULL[patient.usualDay]} @ ${patient.usualTime}</div>
      </div>
      <div class="detail-grid-item" style="grid-column: span 2;">
        <div class="detail-grid-item-label">Preferred Injection Site</div>
        <div class="detail-grid-item-value">${patient.site}</div>
      </div>
    </div>

    <h3 style="font-size: 14px; text-transform: uppercase; color: var(--color-ink-muted-48); letter-spacing: 0.05em; margin-bottom: var(--spacing-xs);">Clinical Practice Notes</h3>
    <div class="detail-notes-box">
      <p style="font-size: 14px; line-height: 1.5; color: var(--color-ink); white-space: pre-wrap;">${patient.notes || "No practice notes entered."}</p>
    </div>

    <h3 style="font-size: 14px; text-transform: uppercase; color: var(--color-ink-muted-48); letter-spacing: 0.05em; margin-bottom: var(--spacing-xs); margin-top: var(--spacing-md);">Weekly Injection Log History</h3>
    ${logsHtml}
  `;

  // Bind edit action inside the detail card
  document.getElementById("edit-detail-btn").onclick = () => {
    closeModal("detail-modal-overlay");
    openEditPatientForm(patient.id);
  };

  openModal("detail-modal-overlay");
}

// 5. Patient Add/Edit Form Logic

function openAddPatientForm() {
  document.getElementById("patient-form").reset();
  document.getElementById("form-patient-id").value = "";
  document.getElementById("modal-title-label").textContent = "Add Patient Profile";
  document.getElementById("delete-patient-btn").style.display = "none";
  
  // Reset alarm multi-select chips styling
  document.querySelectorAll(".weekday-chip span").forEach(span => {
    span.style.backgroundColor = "";
    span.style.color = "";
  });

  openModal("patient-modal-overlay");
}

function openEditPatientForm(patientId) {
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;

  document.getElementById("form-patient-id").value = patient.id;
  document.getElementById("modal-title-label").textContent = "Edit Patient Profile";
  
  document.getElementById("p-name").value = patient.name;
  document.getElementById("p-dob").value = patient.dob;
  document.getElementById("p-phone").value = patient.phone;
  document.getElementById("p-medicine").value = patient.medicine;
  document.getElementById("p-dose").value = patient.dose;
  document.getElementById("p-site").value = patient.site;
  document.getElementById("p-usual-day").value = patient.usualDay;
  document.getElementById("p-usual-time").value = patient.usualTime;
  document.getElementById("p-notes").value = patient.notes || "";

  // Set multiselect weekday alarm chips
  const checkboxes = document.querySelectorAll('input[name="p-available-days"]');
  checkboxes.forEach(cb => {
    cb.checked = patient.availableDays.includes(cb.value);
  });

  document.getElementById("delete-patient-btn").style.display = "block";
  // Bind delete behavior
  document.getElementById("delete-patient-btn").onclick = () => {
    if (confirm(`Are you absolutely sure you want to delete ${patient.name}'s entire profile? This cannot be undone`)) {
      patients = patients.filter(p => p.id !== patientId);
      saveToLocalStorage();
      closeModal("patient-modal-overlay");
      renderMonthlyCalendar();
      renderPatientDirectory();
    }
  };

  openModal("patient-modal-overlay");
}

// Handle Form Submission (Add or Update)
function handleFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("form-patient-id").value;
  const name = document.getElementById("p-name").value;
  const dob = document.getElementById("p-dob").value;
  const phone = document.getElementById("p-phone").value;
  const medicine = document.getElementById("p-medicine").value;
  const dose = document.getElementById("p-dose").value;
  const site = document.getElementById("p-site").value;
  const usualDay = document.getElementById("p-usual-day").value;
  const usualTime = document.getElementById("p-usual-time").value;
  const notes = document.getElementById("p-notes").value;

  // Retrieve multiselect weekdays
  const availableDays = [];
  document.querySelectorAll('input[name="p-available-days"]:checked').forEach(cb => {
    availableDays.push(cb.value);
  });

  if (availableDays.length === 0) {
    alert("Please select at least one available clinic day for weekly scheduling");
    return;
  }

  if (id) {
    // Update existing profile
    const idx = patients.findIndex(p => p.id === id);
    if (idx > -1) {
      patients[idx] = {
        ...patients[idx],
        name, dob, phone, medicine, dose, site, availableDays, usualDay, usualTime, notes
      };
    }
  } else {
    // Create new profile
    const newPatient = {
      id: "pat_" + Date.now(),
      name, dob, phone, medicine, dose, site, availableDays, usualDay, usualTime, notes,
      injectionLogs: []
    };
    patients.push(newPatient);
  }

  saveToLocalStorage();
  closeModal("patient-modal-overlay");
  renderMonthlyCalendar();
  renderPatientDirectory();
}

// 6. Generic Modal Handlers
function openModal(modalId) {
  document.getElementById(modalId).classList.add("active");
  document.body.style.overflow = "hidden"; // Disable background scrolling
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("active");
  document.body.style.overflow = "";
}

// 7. Samsung Smart Watch Sync & Web Notification Engine

// Standard browser notifications permission flow
function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.log("This browser does not support local desktop notifications.");
    return;
  }

  if (Notification.permission === "granted") {
    updateNotificationStatus("success", "Notifications Enabled (Standard system prompt approved)");
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        updateNotificationStatus("success", "Notifications Enabled (Approved)");
      } else {
        updateNotificationStatus("warning", "Notifications Muted (Permission Denied)");
      }
    });
  } else {
    updateNotificationStatus("warning", "Notifications Blocked (Reset browser settings to enable)");
  }
}

function updateNotificationStatus(type, text) {
  const box = document.getElementById("notification-status");
  const textEl = document.getElementById("status-text");

  box.className = `notification-status-box ${type}`;
  textEl.textContent = text;
}

// Trigger an immediate custom notification listing today's schedules (perfect for testing phone/watch sync)
function triggerTestNotification() {
  if (Notification.permission !== "granted") {
    // Request permission if not yet approved
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        updateNotificationStatus("success", "Notifications Enabled (Approved)");
        fireScheduledNotification(true); // Forced test notification
      } else {
        alert("Please enable notification permissions in your browser to test watch sync");
      }
    });
  } else {
    fireScheduledNotification(true); // Forced test notification
  }
}

// Fires the system alarm notification listing patients scheduled for today
function fireScheduledNotification(isForcedTest = false) {
  const todayDate = new Date();
  const dayIndex = todayDate.getDay() === 0 ? 6 : todayDate.getDay() - 1; // Mon=0, Sun=6
  const todayDayName = WEEKDAYS[dayIndex];

  // Find patients due for injection today
  const dueToday = patients.filter(p => p.usualDay === todayDayName);

  let title = "Vial Medicine Tracker";
  let body = "";

  if (isForcedTest) {
    title = "Vial — Watch Sync Success";
    if (dueToday.length === 0) {
      body = `Diagnostic complete! Note received on watch (No patients scheduled for today) Total active database: ${patients.length} patients`;
    } else {
      const namesList = dueToday.map(p => `${p.name} (${p.usualTime})`).join(", ");
      body = `Daily Check: ${dueToday.length} patients scheduled today: ${namesList}`;
    }
  } else {
    if (dueToday.length === 0) {
      body = "Good morning! No patient medicine injections are scheduled for today";
    } else {
      const namesList = dueToday.map(p => `${p.name} (${p.usualTime} - ${p.medicine})`).join(", ");
      body = `Morning Alert: ${dueToday.length} patients scheduled today: ${namesList}`;
    }
  }

  // Fire Web Notification
  if ("Notification" in window && Notification.permission === "granted") {
    const options = {
      body: body,
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: "vial-morning-alarm",
      requireInteraction: true // Keeps notification visible on OS/Watch until checked
    };

    // PWA Upgrade: Use service worker registration if active for highly stable mobile/watch notifications
    if ("serviceWorker" in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, options);
      });
    } else {
      new Notification(title, options);
    }
    console.log("System notification fired successfully");
  } else {
    // Fallback in-app alert
    alert(`${title}\n\n${body}`);
  }
}

// Morning scheduler setup (checks if it's 7:00 AM every minute)
let lastNotificationDate = ""; // Prevents double-firing within the 7:00 AM minute

function startMorningScheduler() {
  setInterval(() => {
    const alarmActive = document.getElementById("alarm-toggle").checked;
    if (!alarmActive) return;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const todayStr = formatDateString(now);

    // Trigger at 7:00 AM exactly
    if (hours === 7 && minutes === 0 && lastNotificationDate !== todayStr) {
      lastNotificationDate = todayStr;
      fireScheduledNotification(false);
    }
  }, 30000); // Check every 30 seconds
}

// 8. Application Initializer on DOM Load
document.addEventListener("DOMContentLoaded", () => {
  // Initialize current viewed month to first of current month
  const today = new Date();
  currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Seed database
  seedDatabase();

  // Core Renderers
  updateDashboardStats();
  renderMonthlyCalendar();
  renderPatientDirectory();

  // 9. Event Listeners binding

  // Add patient navigation action
  document.getElementById("add-patient-btn").addEventListener("click", openAddPatientForm);
  document.getElementById("empty-add-btn").addEventListener("click", openAddPatientForm);

  // Form submission
  document.getElementById("patient-form").addEventListener("submit", handleFormSubmit);

  // Modal Cancel and Close button clicks
  document.getElementById("close-modal-btn").addEventListener("click", () => closeModal("patient-modal-overlay"));
  document.getElementById("cancel-form-btn").addEventListener("click", () => closeModal("patient-modal-overlay"));
  document.getElementById("close-detail-btn").addEventListener("click", () => closeModal("detail-modal-overlay"));
  document.getElementById("close-detail-bottom-btn").addEventListener("click", () => closeModal("detail-modal-overlay"));

  // Month Navigator button clicks
  document.getElementById("prev-month-btn").addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderMonthlyCalendar();
  });
  document.getElementById("next-month-btn").addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderMonthlyCalendar();
  });

  // Search input typing filter
  document.getElementById("patient-search-input").addEventListener("input", renderPatientDirectory);

  // Filter chips click handler
  document.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      e.target.classList.add("active");
      renderPatientDirectory();
    });
  });

  // Close modals when clicking on background overlay
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Notification Permissions & Test triggers
  document.getElementById("trigger-test-notif-btn").addEventListener("click", triggerTestNotification);
  
  // Prompt notification permission request slightly after load
  setTimeout(requestNotificationPermission, 2000);

  // Start morning clock trigger
  startMorningScheduler();

  // Smooth local navigation links highlighting
  window.addEventListener("scroll", () => {
    const scrollPos = window.scrollY + 100;
    const sections = ["overview-section", "calendar-section", "database-section", "settings-section"];
    
    sections.forEach(secId => {
      const el = document.getElementById(secId);
      if (el) {
        const top = el.offsetTop;
        const height = el.offsetHeight;
        if (scrollPos >= top && scrollPos < top + height) {
          document.querySelectorAll(".nav-item").forEach(item => {
            item.classList.remove("active");
            if (item.getAttribute("href") === `#${secId}`) {
              item.classList.add("active");
            }
          });
        }
      }
    });
  });

  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Vial Service Worker registered successfully:', reg.scope))
        .catch(err => console.error('Service Worker registration failed:', err));
    });
  }
});
