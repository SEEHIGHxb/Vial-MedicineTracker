/**
 * Vial — Medicine Injection Tracker
 * Clinical Patient Database & Weekly Agenda Schedule Logic
 */

// 1. In-Memory Database & Core Constants
let patients = [];
let currentMonth = null; // Date object representing the currently viewed month
let selectedDate = null; // Date object representing the currently highlighted calendar day
let patientListLimit = 10; // Default limit for displaying patients in Full clinical records

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = {
  "Sun": "Sunday",
  "Mon": "Monday",
  "Tue": "Tuesday",
  "Wed": "Wednesday",
  "Thu": "Thursday",
  "Fri": "Friday",
  "Sat": "Saturday"
};

// Seed patients data if LocalStorage is empty, and dynamically migrate old schemas
function seedDatabase() {
  const localData = localStorage.getItem("vial_patients");
  if (localData) {
    patients = JSON.parse(localData);

    // Robust Safe Schema Migration for Pre-existing LocalStorage Databases
    let requiresMigration = false;
    patients.forEach(patient => {
      // 1. If schedules mapping is missing (old version patient), construct it safely
      if (!patient.schedules) {
        patient.schedules = {};
        patient.usualRound = patient.usualRound || 1; // Default to Round 1

        // Map old availableDays array into schedules with Round 1 as default
        if (patient.availableDays && Array.isArray(patient.availableDays)) {
          patient.availableDays.forEach(day => {
            patient.schedules[day] = 1;
          });
        }

        // Map old usualDay to the new schedules matrix
        if (patient.usualDay) {
          patient.schedules[patient.usualDay] = patient.usualRound;
        }

        requiresMigration = true;
      }

      // 2. Ensure usualRound exists
      if (patient.usualRound === undefined) {
        patient.usualRound = 1;
        requiresMigration = true;
      }

      // 3. Clean up obsolete fields to save LocalStorage footprint
      if (patient.medicine !== undefined) delete patient.medicine;
      if (patient.dose !== undefined) delete patient.dose;
      if (patient.site !== undefined) delete patient.site;
      if (patient.availableDays !== undefined) delete patient.availableDays;
      if (patient.usualTime !== undefined) delete patient.usualTime;

      // 4. Ensure startDate and endDate exist for treatment window tracking
      if (!patient.startDate) {
        patient.startDate = "2026-05-01";
        requiresMigration = true;
      }
      if (!patient.endDate) {
        patient.endDate = "2026-12-31";
        requiresMigration = true;
      }
    });

    if (requiresMigration) {
      console.log("Safe LocalStorage data migration completed successfully");
      saveToLocalStorage();
    }
  } else {
    // High-quality mock patients to give a fully functional clinical view immediately
    // Styled for the new streamlined schema (Rounds 1-3, custom schedules, no medicine specs)
    patients = [
      {
        id: "pat_1",
        name: "Johnathan Doe",
        usualDay: "Mon",
        usualRound: 2,
        schedules: {
          "Mon": 2,
          "Wed": 1,
          "Fri": 3
        },
        notes: "Patient prefers a slow injection. Monitor for mild site redness. Patient has a mild penicillin allergy",
        injectionLogs: ["2026-05-25"], // Completed on Monday of the current week (May 25, 2026)
        startDate: "2026-05-01",
        endDate: "2026-12-31"
      },
      {
        id: "pat_2",
        name: "Eleanor Vance",
        usualDay: "Wed",
        usualRound: 1,
        schedules: {
          "Wed": 1,
          "Fri": 2
        },
        notes: "Check blood glucose levels prior to administration. Remind patient about weekly dietary guidelines",
        injectionLogs: [], // Pending for this week
        startDate: "2026-05-01",
        endDate: "2026-12-31"
      },
      {
        id: "pat_3",
        name: "Marcus Brody",
        usualDay: "Fri",
        usualRound: 3,
        schedules: {
          "Tue": 2,
          "Thu": 2,
          "Fri": 3
        },
        notes: "Administer with a high-gauge needle. Patient takes folic acid daily. Check blood count lab sheet monthly",
        injectionLogs: [], // Pending for this week
        startDate: "2026-05-01",
        endDate: "2026-12-31"
      },
      {
        id: "pat_4",
        name: "Sarah Jenkins",
        usualDay: "Sun",
        usualRound: 1,
        schedules: {
          "Sat": 2,
          "Sun": 1
        },
        notes: "Keep medication refrigerated until 30 minutes before injection. Patient self-injects occasionally under supervision",
        injectionLogs: ["2026-05-31"], // Completed today (Sunday May 31, 2026)
        startDate: "2026-05-01",
        endDate: "2026-12-31"
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

// Returns the Sunday date of the week containing the given date
function getStartOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // Sunday=0, Monday=1, etc.
  const diff = date.getDate() - day; // Subtract day index to get Sunday
  const sunday = new Date(date.setDate(diff));
  sunday.setHours(0, 0, 0, 0);
  return sunday;
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

// Checks if a patient was injected during the currently viewed week (Sunday to Saturday)
function isInjectedInWeek(patient, sundayDate) {
  const weekStartStr = formatDateString(sundayDate);
  const saturdayDate = new Date(sundayDate);
  saturdayDate.setDate(sundayDate.getDate() + 6);
  const weekEndStr = formatDateString(saturdayDate);

  return patient.injectionLogs.some(logDate => {
    return logDate >= weekStartStr && logDate <= weekEndStr;
  });
}

// Checks if a patient was injected during the week containing the given date (Sunday to Saturday)
function isInjectedInWeekOfDate(patient, cellDate) {
  const sunday = getStartOfWeek(cellDate);
  return isInjectedInWeek(patient, sunday);
}

// Format Date into user-friendly "date month year" e.g., "31 May 2026"
function formatPrettyDate(date) {
  const d = new Date(date);
  const day = d.getDate();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

// 3. UI Core Renderers

// Initialize Dashboard Overview Metrics
function updateDashboardStats() {
  const todayDate = new Date();
  const todayDayName = WEEKDAYS[todayDate.getDay()];
  const currentSun = getStartOfWeek(todayDate);
  const todayStr = formatDateString(todayDate);

  // Due Today count: patients scheduled on today's weekday and within active treatment window
  const dueToday = patients.filter(p => {
    const isScheduled = p.schedules[todayDayName] !== undefined;
    if (!isScheduled) return false;
    const start = p.startDate || "2000-01-01";
    const end = p.endDate || "2099-12-31";
    return todayStr >= start && todayStr <= end;
  }).length;
  const dueTodayEl = document.getElementById("metric-due-today");
  if (dueTodayEl) dueTodayEl.textContent = dueToday;

  // Total patients
  const totalEl = document.getElementById("metric-total");
  if (totalEl) totalEl.textContent = patients.length;

  // Week Completion percentage
  if (patients.length === 0) {
    const completionEl = document.getElementById("metric-completion");
    if (completionEl) completionEl.textContent = "0%";
    document.getElementById("sub-nav-stats").textContent = "0 of 0 Injected";
    return;
  }

  const injectedThisWeek = patients.filter(p => isInjectedInWeek(p, currentSun)).length;
  const completionPercent = Math.round((injectedThisWeek / patients.length) * 100);
  const completionEl = document.getElementById("metric-completion");
  if (completionEl) completionEl.textContent = `${completionPercent}%`;

  // Sub-nav text updater
  document.getElementById("sub-nav-stats").textContent = `${injectedThisWeek} of ${patients.length} Injected This Week`;
}

// Render the selected day injections agenda list below the calendar grid
function renderDailyAgenda(date) {
  const agendaSection = document.getElementById("agenda-section");
  const subtitleEl = document.getElementById("agenda-date-subtitle");
  const titleEl = document.getElementById("agenda-date-title");
  const statsEl = document.getElementById("agenda-stats-pill");
  const listContainer = document.getElementById("agenda-patients-list");

  if (!agendaSection || !listContainer) return;

  const dateStr = formatDateString(date);
  const weekdayName = WEEKDAYS[date.getDay()];
  const prettyDate = formatPrettyDate(date);
  const weekdayFullName = WEEKDAYS_FULL[weekdayName];

  subtitleEl.textContent = `${weekdayFullName} Queue`;
  titleEl.textContent = prettyDate;
  agendaSection.style.display = "block";

  // Filter patients scheduled on this weekday and within active treatment window
  const scheduled = patients.filter(p => {
    const isScheduled = p.schedules[weekdayName] !== undefined;
    if (!isScheduled) return false;
    const start = p.startDate || "2000-01-01";
    const end = p.endDate || "2099-12-31";
    return dateStr >= start && dateStr <= end;
  });

  if (scheduled.length === 0) {
    statsEl.textContent = "0 scheduled";
    listContainer.innerHTML = `<div class="no-patients-day">No patient injections are scheduled for this day</div>`;
    return;
  }

  // Calculate complete count
  const completedCount = scheduled.filter(p => p.injectionLogs.includes(dateStr)).length;
  statsEl.textContent = `${completedCount} of ${scheduled.length} Completed`;

  listContainer.innerHTML = "";

  // Group scheduled patients by Rounds 1, 2, and 3
  for (let round = 1; round <= 3; round++) {
    const roundPatients = scheduled.filter(p => parseInt(p.schedules[weekdayName]) === round);
    if (roundPatients.length === 0) continue;

    const roundGroup = document.createElement("div");
    roundGroup.className = "agenda-round-group";

    const roundTitle = document.createElement("div");
    roundTitle.className = "agenda-round-title";
    roundTitle.textContent = `Round ${round}`;
    roundGroup.appendChild(roundTitle);

    roundPatients.forEach(patient => {
      const isCompleted = patient.injectionLogs.includes(dateStr);

      const item = document.createElement("div");
      item.className = `agenda-item ${isCompleted ? "completed" : ""}`;

      // Left Column: Checkbox + Name
      const leftCol = document.createElement("div");
      leftCol.className = "agenda-item-left";

      const checkContainer = document.createElement("div");
      checkContainer.className = "agenda-checkbox-container";

      const checkbox = document.createElement("button");
      checkbox.className = "agenda-checkbox";
      checkbox.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;

      // Toggle Injection Completion status specifically on this clicked date
      checkbox.onclick = (e) => {
        e.stopPropagation();
        toggleInjectionStatus(patient.id, dateStr);
      };

      checkContainer.appendChild(checkbox);
      leftCol.appendChild(checkContainer);

      const nameLink = document.createElement("a");
      nameLink.className = "agenda-patient-details-link";
      nameLink.textContent = patient.name;
      nameLink.onclick = () => openPatientDetails(patient.id);

      leftCol.appendChild(nameLink);
      item.appendChild(leftCol);

      // Right Column: Details trigger icon or round status badge
      const rightCol = document.createElement("div");
      rightCol.className = "agenda-item-right";

      const roundBadge = document.createElement("span");
      roundBadge.className = "agenda-round-badge";
      roundBadge.textContent = `Round ${round}`;
      rightCol.appendChild(roundBadge);

      const profileBtn = document.createElement("button");
      profileBtn.className = "button-icon-circular";
      profileBtn.style.width = "30px";
      profileBtn.style.height = "30px";
      profileBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      `;
      profileBtn.onclick = () => openPatientDetails(patient.id);

      rightCol.appendChild(profileBtn);
      item.appendChild(rightCol);

      roundGroup.appendChild(item);
    });

    listContainer.appendChild(roundGroup);
  }
}

// Toggle whether a patient has completed the medicine injection on a specific date
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
  if (selectedDate) renderDailyAgenda(selectedDate);
  renderPatientDirectory();
}

// Render the Patient Directory Grid (Search & Filter Chip logic)
function renderPatientDirectory() {
  const gridContainer = document.getElementById("patient-cards-grid");
  const searchInput = document.getElementById("patient-search-input");
  const emptyState = document.getElementById("empty-state");

  if (!gridContainer || !searchInput || !emptyState) return;

  const searchVal = searchInput.value.toLowerCase();
  const filterSelect = document.getElementById("patient-filter-select");
  const activeFilter = filterSelect ? filterSelect.value : "all";

  // Clear previous cards inside the container
  gridContainer.innerHTML = "";

  const currentSun = getStartOfWeek(new Date());

  // Filter & Search calculation
  const filteredPatients = patients.filter(patient => {
    // Search fields: Name, Notes, Schedules description
    const matchSearch = patient.name.toLowerCase().includes(searchVal) ||
                        (patient.notes && patient.notes.toLowerCase().includes(searchVal)) ||
                        Object.keys(patient.schedules).some(day => WEEKDAYS_FULL[day].toLowerCase().includes(searchVal));

    if (!matchSearch) return false;

    // Filter select match: check weekday availability
    if (activeFilter !== "all") {
      if (patient.schedules[activeFilter] === undefined) return false;
    }

    return true;
  });

  const totalFilteredCount = filteredPatients.length;
  const slicedPatients = filteredPatients.slice(0, patientListLimit);

  if (slicedPatients.length === 0) {
    emptyState.style.display = "flex";
    const paginationContainer = document.getElementById("patient-list-pagination");
    if (paginationContainer) paginationContainer.innerHTML = "";
  } else {
    emptyState.style.display = "none";
    
    slicedPatients.forEach(patient => {
      const injectedThisWeek = isInjectedInWeek(patient, currentSun);
      
      const card = document.createElement("div");
      card.className = "store-utility-card";

      // Format custom schedules list for card preview
      const schedulesSummary = Object.entries(patient.schedules)
        .map(([day, round]) => `${day} (R${round})`)
        .join(", ");

      // HTML template for patient card styled in Apple Store Grid Card chassis (removed icon)
      card.innerHTML = `
        <div class="card-status-pill ${injectedThisWeek ? "completed" : "pending"}">
          ${injectedThisWeek ? "Completed" : "Pending Injection"}
        </div>
        
        <div class="patient-card-body">
          <h3>${patient.name}</h3>
          <p class="patient-card-med">Primary schedule: ${WEEKDAYS_FULL[patient.usualDay]} · Round ${patient.usualRound}</p>
          
          <div class="patient-meta-list" style="margin-top: 12px;">
            <div class="meta-item">
              <span class="meta-label">Schedule Matrix:</span> ${schedulesSummary || "No schedules set"}
            </div>
            <div class="meta-item" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">
              <span class="meta-label">Notes:</span> ${patient.notes || "None"}
            </div>
          </div>
        </div>

        <div class="card-actions" style="margin-top: 16px;">
          <a class="text-link" onclick="openPatientDetails('${patient.id}')">View Profile</a>
          <button class="button-pearl-capsule" onclick="openEditPatientForm('${patient.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            Edit
          </button>
        </div>
      `;

      // Full card is clickable to open details, unless user clicks action buttons/links
      card.addEventListener("click", (e) => {
        if (e.target.closest("button") || e.target.closest(".text-link")) {
          return;
        }
        openPatientDetails(patient.id);
      });

      gridContainer.appendChild(card);
    });

    // Render pagination button if needed
    const paginationContainer = document.getElementById("patient-list-pagination");
    if (paginationContainer) {
      if (totalFilteredCount > patientListLimit) {
        paginationContainer.innerHTML = `
          <button class="button-secondary-pill" id="show-more-patients-btn" style="padding: 10px 24px; font-weight: 600;">
            Show More Patients (${totalFilteredCount - patientListLimit} remaining)
          </button>
        `;
        document.getElementById("show-more-patients-btn").addEventListener("click", () => {
          patientListLimit += 10;
          renderPatientDirectory();
        });
      } else {
        paginationContainer.innerHTML = "";
      }
    }
  }
}

// 4. Patient Profile Details Modal
function openPatientDetails(patientId) {
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;

  const detailBody = document.getElementById("detail-modal-body");

  // Generate logs history list
  let logsHtml = `<p style="font-size: 14px; color: var(--color-ink-muted-48); font-style: italic;">No past injections logged</p>`;
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

  // Format dynamic matrix details
  const matrixDetailsHtml = Object.entries(patient.schedules)
    .map(([day, round]) => `
      <div style="background-color: var(--color-surface-pearl); border: 1px solid var(--color-hairline); border-radius: var(--rounded-sm); padding: var(--spacing-xs) var(--spacing-sm); font-size: 13px; font-weight: 600;">
        ${WEEKDAYS_FULL[day]}: Round ${round}
      </div>
    `).join("") || `<p style="font-size: 14px; color: var(--color-ink-muted-48); font-style: italic;">No clinic availability configured</p>`;

  detailBody.innerHTML = `
    <div class="detail-main-header">
      <div class="detail-patient-avatar">
        ${patient.name.charAt(0)}
      </div>
      <div class="detail-main-info">
        <h2>${patient.name}</h2>
      </div>
    </div>

    <div class="detail-grid-section" style="margin-top: var(--spacing-lg);">
      <div class="detail-grid-item">
        <div class="detail-grid-item-label">Primary Schedule Day</div>
        <div class="detail-grid-item-value">${WEEKDAYS_FULL[patient.usualDay]}</div>
      </div>
      <div class="detail-grid-item">
        <div class="detail-grid-item-label">Primary Schedule Session</div>
        <div class="detail-grid-item-value">Round ${patient.usualRound}</div>
      </div>
      <div class="detail-grid-item">
        <div class="detail-grid-item-label">First Injection Date</div>
        <div class="detail-grid-item-value">${patient.startDate ? formatPrettyDate(patient.startDate) : "Not set"}</div>
      </div>
      <div class="detail-grid-item">
        <div class="detail-grid-item-label">Last Injection Date</div>
        <div class="detail-grid-item-value">${patient.endDate ? formatPrettyDate(patient.endDate) : "Not set"}</div>
      </div>
    </div>

    <h3 style="font-size: 14px; text-transform: uppercase; color: var(--color-ink-muted-48); letter-spacing: 0.05em; margin-bottom: var(--spacing-xs); margin-top: var(--spacing-md);">Clinic Availability Matrix</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--spacing-xs); margin-bottom: var(--spacing-md);">
      ${matrixDetailsHtml}
    </div>

    <h3 style="font-size: 14px; text-transform: uppercase; color: var(--color-ink-muted-48); letter-spacing: 0.05em; margin-bottom: var(--spacing-xs);">Notes</h3>
    <div class="detail-notes-box">
      <p style="font-size: 14px; line-height: 1.5; color: var(--color-ink); white-space: pre-wrap;">${patient.notes || "No practice notes entered"}</p>
    </div>

    <h3 style="font-size: 14px; text-transform: uppercase; color: var(--color-ink-muted-48); letter-spacing: 0.05em; margin-bottom: var(--spacing-xs); margin-top: var(--spacing-lg);">Weekly Injection Log History</h3>
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

// Bulletproof sync of custom availability round dropdowns (enabled/disabled states)
function syncRoundsDropdownsState() {
  WEEKDAYS.forEach(day => {
    const cb = document.querySelector(`.avail-day-checkbox[value="${day}"]`);
    const select = document.querySelector(`select[name="p-day-round-${day}"]`);
    if (cb && select) {
      select.disabled = !cb.checked;
      if (cb.checked) {
        select.style.backgroundColor = "var(--color-canvas)";
      } else {
        select.style.backgroundColor = "";
      }
    }
  });
}

// Intercept checkbox changes inside Patient modal availability table
function bindFormCheckboxesBehavior() {
  const table = document.getElementById("availability-rounds-table");
  if (!table) return;

  const checkboxes = table.querySelectorAll(".avail-day-checkbox");
  checkboxes.forEach(cb => {
    cb.addEventListener("change", () => {
      syncRoundsDropdownsState(); // Bulletproof sync on trigger
    });
  });
}

function openAddPatientForm() {
  document.getElementById("patient-form").reset();
  document.getElementById("form-patient-id").value = "";
  document.getElementById("modal-title-label").textContent = "Add Patient Profile";
  document.getElementById("delete-patient-btn").style.display = "none";
  
  // Set all checkboxes as unchecked and dropdowns disabled
  const checkboxes = document.querySelectorAll(".avail-day-checkbox");
  checkboxes.forEach(cb => cb.checked = false);

  syncRoundsDropdownsState();

  // Set default dates
  document.getElementById("p-start-date").value = formatDateString(new Date());
  const oneYearLater = new Date();
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  document.getElementById("p-end-date").value = formatDateString(oneYearLater);

  openModal("patient-modal-overlay");
}

function openEditPatientForm(patientId) {
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;

  document.getElementById("form-patient-id").value = patient.id;
  document.getElementById("modal-title-label").textContent = "Edit Patient Profile";
  
  document.getElementById("p-name").value = patient.name;
  document.getElementById("p-usual-day").value = patient.usualDay;
  document.getElementById("p-usual-round").value = patient.usualRound;
  document.getElementById("p-notes").value = patient.notes || "";
  document.getElementById("p-start-date").value = patient.startDate || "";
  document.getElementById("p-end-date").value = patient.endDate || "";

  // Set clinic availability checkboxes and round dropdown values
  WEEKDAYS.forEach(day => {
    const cb = document.querySelector(`.avail-day-checkbox[value="${day}"]`);
    const select = document.querySelector(`select[name="p-day-round-${day}"]`);
    
    if (cb && select) {
      const isDayActive = patient.schedules[day] !== undefined;
      cb.checked = isDayActive;
      if (isDayActive) {
        select.value = String(patient.schedules[day]);
      } else {
        select.value = "1";
      }
    }
  });

  // Bulletproof state synchronization
  syncRoundsDropdownsState();

  document.getElementById("delete-patient-btn").style.display = "block";
  
  // Bind delete behavior
  document.getElementById("delete-patient-btn").onclick = () => {
    if (confirm(`Are you absolutely sure you want to delete ${patient.name}'s entire profile? This cannot be undone`)) {
      patients = patients.filter(p => p.id !== patientId);
      saveToLocalStorage();
      closeModal("patient-modal-overlay");
      if (selectedDate) renderDailyAgenda(selectedDate);
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
  const usualDay = document.getElementById("p-usual-day").value;
  const usualRound = parseInt(document.getElementById("p-usual-round").value);
  const notes = document.getElementById("p-notes").value;
  const startDate = document.getElementById("p-start-date").value;
  const endDate = document.getElementById("p-end-date").value;

  // Retrieve availability weekdays and custom rounds
  const schedules = {};
  
  WEEKDAYS.forEach(day => {
    const cb = document.querySelector(`.avail-day-checkbox[value="${day}"]`);
    const select = document.querySelector(`select[name="p-day-round-${day}"]`);
    if (cb && cb.checked && select) {
      schedules[day] = parseInt(select.value);
    }
  });

  // Guarantee that the Preferred Usual day is also present in schedules
  if (schedules[usualDay] === undefined) {
    schedules[usualDay] = usualRound;
  }

  if (id) {
    // Update existing profile
    const idx = patients.findIndex(p => p.id === id);
    if (idx > -1) {
      patients[idx] = {
        ...patients[idx],
        name, usualDay, usualRound, schedules, notes, startDate, endDate
      };
    }
  } else {
    // Create new profile
    const newPatient = {
      id: "pat_" + Date.now(),
      name, usualDay, usualRound, schedules, notes, startDate, endDate,
      injectionLogs: []
    };
    patients.push(newPatient);
  }

  saveToLocalStorage();
  closeModal("patient-modal-overlay");
  if (selectedDate) renderDailyAgenda(selectedDate);
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

// Bind Collapsible Mobile Left Drawer Toggle controls
function initializeDrawerNavigation() {
  const toggleBtn = document.getElementById("drawer-toggle-btn");
  const closeBtn = document.getElementById("drawer-close-btn");
  const drawerOverlay = document.getElementById("nav-drawer-overlay");
  const drawer = document.getElementById("nav-drawer");
  const drawerItems = document.querySelectorAll(".drawer-item");

  if (!toggleBtn || !drawer || !closeBtn || !drawerOverlay) return;

  function openDrawer() {
    drawer.classList.add("active");
    drawerOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    drawer.classList.remove("active");
    drawerOverlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  toggleBtn.addEventListener("click", openDrawer);
  closeBtn.addEventListener("click", closeDrawer);
  drawerOverlay.addEventListener("click", closeDrawer);

  drawerItems.forEach(item => {
    item.addEventListener("click", (e) => {
      closeDrawer();
      
      // Update active highlight classes on links
      drawerItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      // Match the main header global nav items too
      const href = item.getAttribute("href");
      document.querySelectorAll(".nav-item").forEach(navLink => {
        navLink.classList.remove("active");
        if (navLink.getAttribute("href") === href) {
          navLink.classList.add("active");
        }
      });
    });
  });

  // Make logo brand button scroll home
  const logoBtn = document.getElementById("logo-brand-btn");
  if (logoBtn) {
    logoBtn.addEventListener("click", () => {
      window.scrollTo(0, 0);
    });
  }
}

// 7. Samsung Smart Watch Sync & Web Notification Engine

// Standard browser notifications permission flow
function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.log("This browser does not support local desktop notifications");
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
  if (!box || !textEl) return;

  box.className = `notification-status-box ${type}`;
  textEl.textContent = text;
}

// Trigger an immediate custom notification listing today's schedules (perfect for testing phone/watch sync)
function triggerTestNotification() {
  if (Notification.permission !== "granted") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        updateNotificationStatus("success", "Notifications Enabled (Approved)");
        fireRoundScheduledNotification(1, true); // Forced test notification
      } else {
        alert("Please enable notification permissions in your browser to test watch sync");
      }
    });
  } else {
    fireRoundScheduledNotification(1, true); // Forced test notification
  }
}

// Fires the system alarm notification listing patients scheduled for a specific round today
function fireRoundScheduledNotification(roundNum, isForcedTest = false) {
  const todayDate = new Date();
  const dayIndex = todayDate.getDay(); // Sun=0, Mon=1, etc.
  const todayDayName = WEEKDAYS[dayIndex];

  // Find patients due for injection today in this specific round
  const dueThisRound = patients.filter(p => {
    const mappedRound = p.schedules[todayDayName];
    return mappedRound !== undefined && parseInt(mappedRound) === roundNum;
  });

  let title = `Vial Round ${roundNum} Alarm`;
  let body = "";

  if (isForcedTest) {
    title = "Vial — Smart Watch Sync Verified";
    if (dueThisRound.length === 0) {
      body = `Diagnostic complete! Test note received on watch (No Round ${roundNum} patients scheduled today) Total patient database: ${patients.length} records`;
    } else {
      const namesList = dueThisRound.map(p => p.name).join(", ");
      body = `Round ${roundNum} diagnostic alert: ${dueThisRound.length} scheduled: ${namesList}`;
    }
  } else {
    if (dueThisRound.length === 0) {
      return; // Do not push alerts if nobody is scheduled
    } else {
      const namesList = dueThisRound.map(p => p.name).join(", ");
      body = `Round ${roundNum} starting: ${dueThisRound.length} patient injections due: ${namesList}`;
    }
  }

  // Fire Web Notification
  if ("Notification" in window && Notification.permission === "granted") {
    const options = {
      body: body,
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: `vial-round-alarm-${roundNum}-${formatDateString(todayDate)}`,
      requireInteraction: true // Keeps notification visible on OS/Watch until checked
    };

    // PWA: Use service worker registration if active for highly stable mobile/watch notifications
    if ("serviceWorker" in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, options);
      });
    } else {
      new Notification(title, options);
    }
    console.log(`System round ${roundNum} notification fired successfully`);
  } else {
    // Fallback in-app alert
    alert(`${title}\n\n${body}`);
  }
}

// Background scheduler time watcher: checks every 30 seconds
let lastAlarmFiredStr = ""; // Tracks "YYYY-MM-DD_Round#" to prevent double alerts inside the same active minute

function startAlarmTimeWatcher() {
  setInterval(() => {
    const alarmActive = document.getElementById("alarm-toggle").checked;
    if (!alarmActive) return;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const todayStr = formatDateString(now);
    
    // Construct time string "HH:MM"
    let hStr = String(hours);
    let mStr = String(minutes);
    if (hStr.length < 2) hStr = "0" + hStr;
    if (mStr.length < 2) mStr = "0" + mStr;
    const timeNow = `${hStr}:${mStr}`;

    // Read alert times configured in Settings page
    const r1Time = document.getElementById("alarm-time-r1").value;
    const r2Time = document.getElementById("alarm-time-r2").value;
    const r3Time = document.getElementById("alarm-time-r3").value;

    // Check Round 1
    if (timeNow === r1Time && lastAlarmFiredStr !== `${todayStr}_R1`) {
      lastAlarmFiredStr = `${todayStr}_R1`;
      fireRoundScheduledNotification(1, false);
    }
    // Check Round 2
    if (timeNow === r2Time && lastAlarmFiredStr !== `${todayStr}_R2`) {
      lastAlarmFiredStr = `${todayStr}_R2`;
      fireRoundScheduledNotification(2, false);
    }
    // Check Round 3
    if (timeNow === r3Time && lastAlarmFiredStr !== `${todayStr}_R3`) {
      lastAlarmFiredStr = `${todayStr}_R3`;
      fireRoundScheduledNotification(3, false);
    }

  }, 30000); // Poll clock check twice a minute
}

// Initialize Custom Round Times from Local Storage on load
function loadSettingsConfig() {
  const alarmState = localStorage.getItem("vial_alarm_enabled");
  if (alarmState !== null) {
    document.getElementById("alarm-toggle").checked = alarmState === "true";
  }

  const r1 = localStorage.getItem("vial_alarm_r1") || "06:50";
  const r2 = localStorage.getItem("vial_alarm_r2") || "10:50";
  const r3 = localStorage.getItem("vial_alarm_r3") || "12:50";

  document.getElementById("alarm-time-r1").value = r1;
  document.getElementById("alarm-time-r2").value = r2;
  document.getElementById("alarm-time-r3").value = r3;

  // Bind change events to persist configurations
  document.getElementById("alarm-toggle").addEventListener("change", (e) => {
    localStorage.setItem("vial_alarm_enabled", e.target.checked);
  });
  document.getElementById("alarm-time-r1").addEventListener("change", (e) => {
    localStorage.setItem("vial_alarm_r1", e.target.value);
  });
  document.getElementById("alarm-time-r2").addEventListener("change", (e) => {
    localStorage.setItem("vial_alarm_r2", e.target.value);
  });
  document.getElementById("alarm-time-r3").addEventListener("change", (e) => {
    localStorage.setItem("vial_alarm_r3", e.target.value);
    // Bind clear database operations button
  });
  const clearDbBtn = document.getElementById("clear-database-btn");
  if (clearDbBtn) {
    clearDbBtn.addEventListener("click", () => {
      const confirm1 = confirm("Are you sure you want to permanently clear all patient data? This will erase all logs and configurations");
      if (confirm1) {
        const confirm2 = confirm("This action cannot be undone. Are you absolutely certain you wish to wipe the entire clinical database?");
        if (confirm2) {
          patients = [];
          saveToLocalStorage();
          if (selectedDate) renderDailyAgenda(selectedDate);
          renderPatientDirectory();
          alert("Clinical database has been completely purged");
        }
      }
    });
  }
}

// 8. Application Initializer on DOM Load
document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  
  // Set currentMonth calendar header anchor, and default select selectedDate as today
  selectedDate = today;

  // Seed database and complete safe schema migrations for existing LocalStorage data
  seedDatabase();

  // Load alert timings
  loadSettingsConfig();

  // Core Renderers
  updateDashboardStats();
  renderDailyAgenda(selectedDate);
  renderPatientDirectory();

  // Bind interactive modal available days checkboxes dropdown behaviors
  bindFormCheckboxesBehavior();

  // Bind left collapsible drawer toggle navigation (Midori-style)
  initializeDrawerNavigation();

  // 9. Event Listeners binding

  // Add patient navigation action
  document.getElementById("add-patient-btn").addEventListener("click", openAddPatientForm);

  // Safely retrieve empty-add-btn to prevent click event binding failures if database is cleared/loaded
  const emptyAddBtn = document.getElementById("empty-add-btn");
  if (emptyAddBtn) {
    emptyAddBtn.addEventListener("click", openAddPatientForm);
  }

  // Form submission
  document.getElementById("patient-form").addEventListener("submit", handleFormSubmit);

  // Modal Cancel and Close button clicks
  document.getElementById("close-modal-btn").addEventListener("click", () => closeModal("patient-modal-overlay"));
  document.getElementById("cancel-form-btn").addEventListener("click", () => closeModal("patient-modal-overlay"));
  document.getElementById("close-detail-btn").addEventListener("click", () => closeModal("detail-modal-overlay"));
  document.getElementById("close-detail-bottom-btn").addEventListener("click", () => closeModal("detail-modal-overlay"));

  // Day Navigator button clicks
  const prevDayBtn = document.getElementById("prev-day-btn");
  if (prevDayBtn) {
    prevDayBtn.addEventListener("click", () => {
      selectedDate.setDate(selectedDate.getDate() - 1);
      renderDailyAgenda(selectedDate);
    });
  }
  const nextDayBtn = document.getElementById("next-day-btn");
  if (nextDayBtn) {
    nextDayBtn.addEventListener("click", () => {
      selectedDate.setDate(selectedDate.getDate() + 1);
      renderDailyAgenda(selectedDate);
    });
  }

  // Dashboard Add Patient button click
  const dashboardAddBtn = document.getElementById("dashboard-add-btn");
  if (dashboardAddBtn) {
    dashboardAddBtn.addEventListener("click", openAddPatientForm);
  }

  // Search input typing filter with limit reset
  const searchInputEl = document.getElementById("patient-search-input");
  if (searchInputEl) {
    searchInputEl.addEventListener("input", () => {
      patientListLimit = 10;
      renderPatientDirectory();
    });
  }

  // Filter select dropdown listener with limit reset
  const filterSelectEl = document.getElementById("patient-filter-select");
  if (filterSelectEl) {
    filterSelectEl.addEventListener("change", () => {
      patientListLimit = 10;
      renderPatientDirectory();
    });
  }

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

  // Start background alarms watcher
  startAlarmTimeWatcher();

  // Smooth local navigation links highlighting
  window.addEventListener("scroll", () => {
    const scrollPos = window.scrollY + 100;
    const sections = ["overview-section", "database-section", "settings-section"];
    
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
