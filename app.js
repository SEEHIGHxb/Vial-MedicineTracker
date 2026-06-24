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

      // 4. Ensure startDate exists for treatment window tracking
      if (!patient.startDate) {
        patient.startDate = "2026-05-01";
        requiresMigration = true;
      }

      // 5. Ensure frequency exists for treatment tracking
      if (!patient.frequency) {
        patient.frequency = 1;
        requiresMigration = true;
      }

      // 6. Ensure doses exists (calculated from old endDate if present)
      if (patient.doses === undefined) {
        if (patient.startDate && patient.endDate) {
          const start = new Date(patient.startDate);
          const end = new Date(patient.endDate);
          const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
          const diffWeeks = Math.round(diffDays / 7);
          const freq = parseInt(patient.frequency) || 1;
          const calculatedDoses = Math.round(diffWeeks / freq) + 1;
          patient.doses = Math.max(1, Math.min(14, calculatedDoses || 10));
        } else {
          patient.doses = 10;
        }
        requiresMigration = true;
      }
      if (patient.endDate !== undefined) {
        delete patient.endDate;
        requiresMigration = true;
      }

      // 7. Ensure secondary treatment fields are initialized
      if (patient.hasSecondary === undefined) {
        patient.hasSecondary = false;
        patient.secondaryStartDate = "";
        patient.secondaryDoses = 10;
        patient.secondaryFrequency = 1;
        patient.secondaryInjectionLogs = [];
        patient.secondaryUsualDay = patient.usualDay || "Mon";
        patient.secondaryUsualRound = patient.usualRound || 1;
        requiresMigration = true;
      } else {
        if (patient.secondaryUsualDay === undefined) {
          patient.secondaryUsualDay = patient.usualDay || "Mon";
          requiresMigration = true;
        }
        if (patient.secondaryUsualRound === undefined) {
          patient.secondaryUsualRound = patient.usualRound || 1;
          requiresMigration = true;
        }
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
        doses: 10,
        frequency: 1
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
        doses: 8,
        frequency: 1
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
        doses: 12,
        frequency: 1
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
        doses: 6,
        frequency: 1
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
  let date;
  if (typeof d === "string") {
    const parts = d.split('-');
    if (parts.length === 3) {
      date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      date = new Date(d);
    }
  } else {
    date = new Date(d);
  }
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
  let d;
  if (typeof date === "string") {
    const parts = date.split('-');
    if (parts.length === 3) {
      d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      d = new Date(date);
    }
  } else {
    d = new Date(date);
  }
  const day = d.getDate();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

// Returns the Sunday date of the first week containing a scheduled clinic day on or after the first injection date
function getFirstActiveWeekSunday(patient) {
  const start = patient.startDate || formatDateString(new Date());
  const parts = start.split('-');
  const startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  
  const scheduledDays = Object.keys(patient.schedules || {});
  if (scheduledDays.length === 0) {
    return getStartOfWeek(start);
  }
  
  // Find the first day on or after startDate that is scheduled in the patient availability matrix
  let current = new Date(startDate);
  for (let i = 0; i < 7; i++) {
    const dayName = WEEKDAYS[current.getDay()];
    if (patient.schedules[dayName] !== undefined) {
      return getStartOfWeek(current);
    }
    current.setDate(current.getDate() + 1);
  }
  
  return getStartOfWeek(start);
}

// Calculate the exact date of the last injection based on startDate, doses, frequency, and usualDay
function calculateLastInjectionDate(patient) {
  const baseSun = getFirstActiveWeekSunday(patient);
  const freq = parseInt(patient.frequency) || 1;
  const doses = parseInt(patient.doses) || 1;
  const totalWeeks = (doses - 1) * freq;
  
  const lastSun = new Date(baseSun);
  lastSun.setDate(baseSun.getDate() + totalWeeks * 7);
  
  // Add weekday offset of preferred day (default Monday if usualDay not set/found)
  const dayIndex = WEEKDAYS.indexOf(patient.usualDay);
  const lastDate = new Date(lastSun);
  lastDate.setDate(lastSun.getDate() + (dayIndex >= 0 ? dayIndex : 1));
  return lastDate;
}

// Checks if a patient is scheduled and active on a specific date (within start/end window & matching frequency)
function isPatientScheduledAndActiveOnDate(patient, date) {
  const weekdayName = WEEKDAYS[date.getDay()];
  const isScheduled = patient.schedules[weekdayName] !== undefined;
  if (!isScheduled) return false;

  const dateStr = formatDateString(date);
  const start = patient.startDate || "2000-01-01";
  const doses = parseInt(patient.doses) || 10;
  const freq = parseInt(patient.frequency) || 1;

  // Calculate dynamic end date (Saturday of the last dose week)
  const baseSun = getFirstActiveWeekSunday(patient);
  const totalWeeks = (doses - 1) * freq;
  const endSun = new Date(baseSun);
  endSun.setDate(baseSun.getDate() + totalWeeks * 7);
  const endWeekSaturday = new Date(endSun);
  endWeekSaturday.setDate(endSun.getDate() + 6);
  const endDateStr = formatDateString(endWeekSaturday);

  const withinDates = dateStr >= start && dateStr <= endDateStr;
  if (!withinDates) return false;

  // Calculate frequency occurrence
  const cellSun = getStartOfWeek(date);
  const diffDays = Math.round((cellSun - baseSun) / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.round(diffDays / 7);
  return diffWeeks >= 0 && (diffWeeks % freq === 0);
}

// Finds the checklist date for the patient in the cycle containing referenceDate
function getPatientChecklistDate(patient, referenceDate) {
  const baseSun = getFirstActiveWeekSunday(patient);
  const refSun = getStartOfWeek(referenceDate);
  const diffDays = Math.round((refSun - baseSun) / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.round(diffDays / 7);

  if (diffWeeks < 0) return null;

  const freq = parseInt(patient.frequency) || 1;
  const cycleIndex = Math.floor(diffWeeks / freq);
  
  const cycleStartSun = new Date(baseSun);
  cycleStartSun.setDate(baseSun.getDate() + cycleIndex * freq * 7);
  cycleStartSun.setHours(0, 0, 0, 0);

  const cycleEndSat = new Date(cycleStartSun);
  cycleEndSat.setDate(cycleStartSun.getDate() + freq * 7 - 1);
  cycleEndSat.setHours(23, 59, 59, 999);
  const cycleEndSatStr = formatDateString(cycleEndSat);

  // Check if cycle is within patient active treatment window
  const start = patient.startDate || "2000-01-01";
  const doses = parseInt(patient.doses) || 10;
  const totalWeeks = (doses - 1) * freq;
  const endSun = new Date(baseSun);
  endSun.setDate(baseSun.getDate() + totalWeeks * 7);
  const endWeekSaturday = new Date(endSun);
  endWeekSaturday.setDate(endSun.getDate() + 6);
  const endDateStr = formatDateString(endWeekSaturday);

  const cycleStartStr = formatDateString(cycleStartSun);
  if (cycleStartStr > endDateStr || cycleEndSatStr < start) {
    return null;
  }

  // 1. Check if patient was injected in this cycle
  const actualInjectedDateStr = patient.injectionLogs.find(logDate => {
    return logDate >= cycleStartStr && logDate <= cycleEndSatStr;
  });

  if (actualInjectedDateStr !== undefined) {
    const parts = actualInjectedDateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(actualInjectedDateStr);
  }

  // 2. Find available clinic dates in this cycle
  const availableDates = [];
  for (let offset = 0; offset < freq * 7; offset++) {
    const candidateDate = new Date(cycleStartSun);
    candidateDate.setDate(cycleStartSun.getDate() + offset);
    const candidateDateStr = formatDateString(candidateDate);
    
    if (candidateDateStr >= start && candidateDateStr <= endDateStr) {
      const dayName = WEEKDAYS[candidateDate.getDay()];
      if (patient.schedules[dayName] !== undefined) {
        availableDates.push(candidateDate);
      }
    }
  }

  if (availableDates.length === 0) return null;

  // 3. Get the primary preferred date for this cycle (usualDay in week 0 of the cycle)
  const dayIndex = WEEKDAYS.indexOf(patient.usualDay);
  const primaryDate = new Date(cycleStartSun);
  primaryDate.setDate(cycleStartSun.getDate() + (dayIndex >= 0 ? dayIndex : 1));
  primaryDate.setHours(0, 0, 0, 0);

  // 4. Determine checklist date relative to today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today < primaryDate) {
    return primaryDate;
  } else {
    // Primary date has passed and they haven't been injected. Find first available date on or after today in this cycle
    const nextAvailable = availableDates.find(d => d >= today);
    if (nextAvailable) {
      return nextAvailable;
    }
    // If all available dates in this cycle have passed, default to the last available date in this cycle
    return availableDates[availableDates.length - 1];
  }
}

// Checks if a date matches the solved checklist date for a patient's cycle
function isPatientChecklistDate(patient, date) {
  const checklistDate = getPatientChecklistDate(patient, date);
  if (!checklistDate) return false;
  return formatDateString(checklistDate) === formatDateString(date);
}

// Calculates the active preferred date for a patient in the week of cellDate
function getPatientActivePreferredDate(patient, cellDate) {
  const checklistDate = getPatientChecklistDate(patient, cellDate);
  return checklistDate || getStartOfWeek(cellDate);
}

// Secondary Treatment Scheduling Helpers
function getFirstActiveWeekSundaySecondary(patient) {
  if (!patient.hasSecondary) return null;
  const start = patient.secondaryStartDate || formatDateString(new Date());
  const parts = start.split('-');
  const startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  
  const scheduledDays = Object.keys(patient.schedules || {});
  if (scheduledDays.length === 0) {
    return getStartOfWeek(start);
  }
  
  let current = new Date(startDate);
  for (let i = 0; i < 7; i++) {
    const dayName = WEEKDAYS[current.getDay()];
    if (patient.schedules[dayName] !== undefined) {
      return getStartOfWeek(current);
    }
    current.setDate(current.getDate() + 1);
  }
  
  return getStartOfWeek(start);
}

function calculateLastInjectionDateSecondary(patient) {
  if (!patient.hasSecondary) return null;
  const baseSun = getFirstActiveWeekSundaySecondary(patient);
  if (!baseSun) return null;
  const freq = parseInt(patient.secondaryFrequency) || 1;
  const doses = parseInt(patient.secondaryDoses) || 1;
  const totalWeeks = (doses - 1) * freq;
  
  const lastSun = new Date(baseSun);
  lastSun.setDate(baseSun.getDate() + totalWeeks * 7);
  
  const dayIndex = WEEKDAYS.indexOf(patient.secondaryUsualDay || patient.usualDay || "Mon");
  const lastDate = new Date(lastSun);
  lastDate.setDate(lastSun.getDate() + (dayIndex >= 0 ? dayIndex : 1));
  return lastDate;
}

function isPatientScheduledAndActiveOnDateSecondary(patient, date) {
  if (!patient.hasSecondary) return false;
  const weekdayName = WEEKDAYS[date.getDay()];
  const isScheduled = patient.schedules[weekdayName] !== undefined;
  if (!isScheduled) return false;

  const dateStr = formatDateString(date);
  const start = patient.secondaryStartDate || "2000-01-01";
  const doses = parseInt(patient.secondaryDoses) || 10;
  const freq = parseInt(patient.secondaryFrequency) || 1;

  const baseSun = getFirstActiveWeekSundaySecondary(patient);
  if (!baseSun) return false;
  const totalWeeks = (doses - 1) * freq;
  const endSun = new Date(baseSun);
  endSun.setDate(baseSun.getDate() + totalWeeks * 7);
  const endWeekSaturday = new Date(endSun);
  endWeekSaturday.setDate(endSun.getDate() + 6);
  const endDateStr = formatDateString(endWeekSaturday);

  const withinDates = dateStr >= start && dateStr <= endDateStr;
  if (!withinDates) return false;

  const cellSun = getStartOfWeek(date);
  const diffDays = Math.round((cellSun - baseSun) / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.round(diffDays / 7);
  return diffWeeks >= 0 && (diffWeeks % freq === 0);
}

function getPatientSecondaryChecklistDate(patient, referenceDate) {
  if (!patient.hasSecondary) return null;
  const baseSun = getFirstActiveWeekSundaySecondary(patient);
  if (!baseSun) return null;
  const refSun = getStartOfWeek(referenceDate);
  const diffDays = Math.round((refSun - baseSun) / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.round(diffDays / 7);

  if (diffWeeks < 0) return null;

  const freq = parseInt(patient.secondaryFrequency) || 1;
  const cycleIndex = Math.floor(diffWeeks / freq);
  
  const cycleStartSun = new Date(baseSun);
  cycleStartSun.setDate(baseSun.getDate() + cycleIndex * freq * 7);
  cycleStartSun.setHours(0, 0, 0, 0);

  const cycleEndSat = new Date(cycleStartSun);
  cycleEndSat.setDate(cycleStartSun.getDate() + freq * 7 - 1);
  cycleEndSat.setHours(23, 59, 59, 999);
  const cycleEndSatStr = formatDateString(cycleEndSat);

  const start = patient.secondaryStartDate || "2000-01-01";
  const doses = parseInt(patient.secondaryDoses) || 10;
  const totalWeeks = (doses - 1) * freq;
  const endSun = new Date(baseSun);
  endSun.setDate(baseSun.getDate() + totalWeeks * 7);
  const endWeekSaturday = new Date(endSun);
  endWeekSaturday.setDate(endSun.getDate() + 6);
  const endDateStr = formatDateString(endWeekSaturday);

  const cycleStartStr = formatDateString(cycleStartSun);
  if (cycleStartStr > endDateStr || cycleEndSatStr < start) {
    return null;
  }

  // Check if patient was injected in this cycle (secondary logs)
  const secondaryLogs = patient.secondaryInjectionLogs || [];
  const actualInjectedDateStr = secondaryLogs.find(logDate => {
    return logDate >= cycleStartStr && logDate <= cycleEndSatStr;
  });

  if (actualInjectedDateStr !== undefined) {
    const parts = actualInjectedDateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(actualInjectedDateStr);
  }

  const availableDates = [];
  for (let offset = 0; offset < freq * 7; offset++) {
    const candidateDate = new Date(cycleStartSun);
    candidateDate.setDate(cycleStartSun.getDate() + offset);
    const candidateDateStr = formatDateString(candidateDate);
    
    if (candidateDateStr >= start && candidateDateStr <= endDateStr) {
      const dayName = WEEKDAYS[candidateDate.getDay()];
      if (patient.schedules[dayName] !== undefined) {
        availableDates.push(candidateDate);
      }
    }
  }

  if (availableDates.length === 0) return null;

  const dayIndex = WEEKDAYS.indexOf(patient.secondaryUsualDay || patient.usualDay || "Mon");
  const primaryDate = new Date(cycleStartSun);
  primaryDate.setDate(cycleStartSun.getDate() + (dayIndex >= 0 ? dayIndex : 1));
  primaryDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today < primaryDate) {
    return primaryDate;
  } else {
    const nextAvailable = availableDates.find(d => d >= today);
    if (nextAvailable) {
      return nextAvailable;
    }
    return availableDates[availableDates.length - 1];
  }
}

function isPatientSecondaryChecklistDate(patient, date) {
  if (!patient.hasSecondary) return false;
  const checklistDate = getPatientSecondaryChecklistDate(patient, date);
  if (!checklistDate) return false;
  return formatDateString(checklistDate) === formatDateString(date);
}

function getPatientSecondaryActivePreferredDate(patient, cellDate) {
  if (!patient.hasSecondary) return null;
  const checklistDate = getPatientSecondaryChecklistDate(patient, cellDate);
  return checklistDate || getStartOfWeek(cellDate);
}

// Render the monthly calendar grid using compact indicator person SVG icons
function renderMonthlyCalendar() {
  const gridContainer = document.getElementById("monthly-calendar-grid");
  if (!gridContainer) return;
  gridContainer.innerHTML = "";

  const today = new Date();
  const todayStr = formatDateString(today);
  const selectedStr = selectedDate ? formatDateString(selectedDate) : null;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Format Month & Year for Header (e.g. "June 2026")
  const monthNamesFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const calendarMonthLabel = document.getElementById("calendar-month-label");
  if (calendarMonthLabel) {
    calendarMonthLabel.textContent = `${monthNamesFull[month]} ${year}`;
  }

  // 1. Render Weekday Header Row inside the grid container (Sunday-start: Sun to Sat)
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

  // Get Sunday-based start offset of the 1st of the month (0=Sun, 6=Sat)
  let startOffset = firstDayOfMonth.getDay();

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
    const isSelected = selectedStr && cellDateStr === selectedStr;

    cell.className = `monthly-day-cell ${isToday ? "today" : ""} ${isSelected ? "selected-day" : ""} ${isOtherMonth ? "other-month" : ""}`;

    // Day number bubble
    const numBubble = document.createElement("div");
    numBubble.className = "monthly-day-cell-number-bubble";
    numBubble.textContent = cellDate.getDate();
    cell.appendChild(numBubble);

    // Indicators Dots/Icons Container for Scheduled Sessions
    const dotsContainer = document.createElement("div");
    dotsContainer.className = "calendar-dots-container";

    const cellDayIndex = cellDate.getDay();
    const cellDayName = WEEKDAYS[cellDayIndex];

    // Find patients active and scheduled for this weekday (Main or Secondary)
    if (patients.length > 0) {
      patients.forEach(patient => {
        // 1. Check Main Treatment
        const isMainActive = isPatientScheduledAndActiveOnDate(patient, cellDate);
        if (isMainActive) {
          const sunday = getStartOfWeek(cellDate);
          const weekStartStr = formatDateString(sunday);
          const saturdayDate = new Date(sunday);
          saturdayDate.setDate(sunday.getDate() + 6);
          const weekEndStr = formatDateString(saturdayDate);
          
          const actualInjectedDateStr = patient.injectionLogs.find(logDate => {
            return logDate >= weekStartStr && logDate <= weekEndStr;
          });

          let iconColorClass = "";
          let statusText = "";

          if (actualInjectedDateStr !== undefined) {
            if (cellDateStr === actualInjectedDateStr) {
              iconColorClass = "green";
              statusText = "Main Injected (This Date)";
            } else {
              iconColorClass = "transparent-grey";
              statusText = "Main Clinic Available (Injected on " + formatPrettyDate(new Date(actualInjectedDateStr)) + ")";
            }
          } else {
            const activePreferredDate = getPatientActivePreferredDate(patient, cellDate);
            const activePreferredDateStr = formatDateString(activePreferredDate);

            if (cellDateStr === activePreferredDateStr) {
              if (cellDateStr === todayStr) {
                iconColorClass = "red";
                statusText = "Main Preferred Day (Today - Pending)";
              } else {
                iconColorClass = "yellow";
              }
            } else {
              iconColorClass = "transparent-grey";
              statusText = "Main Clinic Available (Pending)";
            }
          }

          const iconWrapper = document.createElement("span");
          iconWrapper.className = `calendar-patient-icon-wrapper ${iconColorClass}`;
          iconWrapper.title = `${patient.name} - Main (Session ${patient.schedules[cellDayName]}) — ${statusText}`;
          iconWrapper.innerHTML = `
            <svg class="calendar-patient-icon" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="7" r="4"></circle>
              <path d="M12 12c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path>
            </svg>
          `;
          dotsContainer.appendChild(iconWrapper);
        }

        // 2. Check Secondary Treatment
        const isSecActive = patient.hasSecondary && isPatientScheduledAndActiveOnDateSecondary(patient, cellDate);
        if (isSecActive) {
          const sunday = getStartOfWeek(cellDate);
          const weekStartStr = formatDateString(sunday);
          const saturdayDate = new Date(sunday);
          saturdayDate.setDate(sunday.getDate() + 6);
          const weekEndStr = formatDateString(saturdayDate);
          
          const secondaryLogs = patient.secondaryInjectionLogs || [];
          const actualInjectedDateStr = secondaryLogs.find(logDate => {
            return logDate >= weekStartStr && logDate <= weekEndStr;
          });

          let iconColorClass = "";
          let statusText = "";

          if (actualInjectedDateStr !== undefined) {
            if (cellDateStr === actualInjectedDateStr) {
              iconColorClass = "green";
              statusText = "Secondary Injected (This Date)";
            } else {
              iconColorClass = "transparent-grey";
              statusText = "Secondary Clinic Available (Injected on " + formatPrettyDate(new Date(actualInjectedDateStr)) + ")";
            }
          } else {
            const activePreferredDate = getPatientSecondaryActivePreferredDate(patient, cellDate);
            const activePreferredDateStr = formatDateString(activePreferredDate);

            if (cellDateStr === activePreferredDateStr) {
              if (cellDateStr === todayStr) {
                iconColorClass = "red";
                statusText = "Secondary Preferred Day (Today - Pending)";
              } else {
                iconColorClass = "yellow";
                statusText = "Secondary Preferred Day (Pending)";
              }
            } else {
              iconColorClass = "transparent-grey";
              statusText = "Secondary Clinic Available (Pending)";
            }
          }

          const iconWrapper = document.createElement("span");
          iconWrapper.className = `calendar-patient-icon-wrapper secondary-treatment-icon ${iconColorClass}`;
          iconWrapper.title = `${patient.name} - Secondary (Session ${patient.schedules[cellDayName]}) — ${statusText}`;
          iconWrapper.innerHTML = `
            <svg class="calendar-patient-icon" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="7" r="4"></circle>
              <path d="M12 12c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path>
            </svg>
          `;
          dotsContainer.appendChild(iconWrapper);
        }
      });
    }

    cell.appendChild(dotsContainer);

    // Click handler to select a day and render its Agenda list underneath
    const targetDate = new Date(cellDate);
    cell.addEventListener("click", () => {
      selectedDate = targetDate;
      renderMonthlyCalendar(); // Refresh highlight selector
      renderDailyAgenda(targetDate);
    });

    gridContainer.appendChild(cell);
  }
}

// 3. UI Core Renderers

// Initialize Dashboard Overview Metrics
function updateDashboardStats() {
  const todayDate = new Date();
  const currentSun = getStartOfWeek(todayDate);

  // Due Today count: patients due today based on checklist shifting logic
  const dueToday = patients.filter(p => isPatientChecklistDate(p, todayDate)).length;
  const dueTodayEl = document.getElementById("metric-due-today");
  if (dueTodayEl) dueTodayEl.textContent = dueToday;

  // Total patients
  const totalEl = document.getElementById("metric-total");
  if (totalEl) totalEl.textContent = patients.length;

  // Week Completion percentage
  if (patients.length === 0) {
    const completionEl = document.getElementById("metric-completion");
    if (completionEl) completionEl.textContent = "0%";
    const subNavStats = document.getElementById("sub-nav-stats");
    if (subNavStats) subNavStats.textContent = "0 of 0 Injected";
    return;
  }

  const injectedThisWeek = patients.filter(p => isInjectedInWeek(p, currentSun)).length;
  const completionPercent = Math.round((injectedThisWeek / patients.length) * 100);
  const completionEl = document.getElementById("metric-completion");
  if (completionEl) completionEl.textContent = `${completionPercent}%`;

  // Sub-nav text updater
  const subNavStats = document.getElementById("sub-nav-stats");
  if (subNavStats) subNavStats.textContent = `${injectedThisWeek} of ${patients.length} Injected This Week`;
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

  subtitleEl.textContent = `${weekdayFullName}`;
  titleEl.textContent = prettyDate;
  agendaSection.style.display = "block";

  // Build the list of active tasks scheduled for today
  // Each task has: { patient, type: 'main'|'secondary', isCompleted, round }
  const dailyTasks = [];

  patients.forEach(p => {
    // Check if Main is due today
    if (isPatientChecklistDate(p, date)) {
      const isCompleted = p.injectionLogs.includes(dateStr);
      const round = parseInt(p.schedules[weekdayName]) || 1;
      dailyTasks.push({
        patient: p,
        type: 'main',
        isCompleted,
        round
      });
    }

    // Check if Secondary is due today
    if (p.hasSecondary && isPatientSecondaryChecklistDate(p, date)) {
      const isCompleted = (p.secondaryInjectionLogs || []).includes(dateStr);
      const round = parseInt(p.schedules[weekdayName]) || 1;
      dailyTasks.push({
        patient: p,
        type: 'secondary',
        isCompleted,
        round
      });
    }
  });

  if (dailyTasks.length === 0) {
    statsEl.textContent = "0 scheduled";
    listContainer.innerHTML = `<div class="no-patients-day">No patient injections are scheduled for this day</div>`;
    return;
  }

  // Calculate complete count
  const completedCount = dailyTasks.filter(t => t.isCompleted).length;
  statsEl.textContent = `${completedCount} of ${dailyTasks.length} Completed`;

  listContainer.innerHTML = "";

  // Group dailyTasks by Session (Round) 1, 2, 3
  for (let round = 1; round <= 3; round++) {
    const roundTasks = dailyTasks.filter(t => t.round === round);
    if (roundTasks.length === 0) continue;

    const roundGroup = document.createElement("div");
    roundGroup.className = "agenda-round-group";

    const roundTitle = document.createElement("div");
    roundTitle.className = "agenda-round-title";
    roundTitle.textContent = `Session ${round}`;
    roundGroup.appendChild(roundTitle);

    roundTasks.forEach(task => {
      const patient = task.patient;
      const isSecondary = task.type === 'secondary';

      const item = document.createElement("div");
      item.className = `agenda-item ${task.isCompleted ? "completed" : ""} ${isSecondary ? "secondary-treatment" : ""}`;

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
        toggleInjectionStatus(patient.id, dateStr, isSecondary);
      };

      checkContainer.appendChild(checkbox);
      leftCol.appendChild(checkContainer);

      const nameLink = document.createElement("a");
      nameLink.className = "agenda-patient-details-link";
      nameLink.textContent = isSecondary ? `${patient.name} (Secondary)` : `${patient.name} (Main)`;
      nameLink.onclick = () => openPatientDetails(patient.id);

      leftCol.appendChild(nameLink);
      item.appendChild(leftCol);

      // Right Column: Details trigger icon or Session status badge
      const rightCol = document.createElement("div");
      rightCol.className = "agenda-item-right";

      const roundBadge = document.createElement("span");
      roundBadge.className = "agenda-round-badge";
      roundBadge.textContent = `Session ${round}`;
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

function toggleInjectionStatus(patientId, dateStr, isSecondary = false) {
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;

  if (isSecondary) {
    if (!patient.secondaryInjectionLogs) {
      patient.secondaryInjectionLogs = [];
    }
    const logIdx = patient.secondaryInjectionLogs.indexOf(dateStr);
    if (logIdx > -1) {
      // Remove if clicked again (undo action)
      patient.secondaryInjectionLogs.splice(logIdx, 1);
    } else {
      // Add completion log timestamp
      patient.secondaryInjectionLogs.push(dateStr);
    }
  } else {
    const logIdx = patient.injectionLogs.indexOf(dateStr);
    if (logIdx > -1) {
      // Remove if clicked again (undo action)
      patient.injectionLogs.splice(logIdx, 1);
    } else {
      // Add completion log timestamp
      patient.injectionLogs.push(dateStr);
    }
  }

  saveToLocalStorage();
  renderMonthlyCalendar();
  if (selectedDate) renderDailyAgenda(selectedDate);
  renderPatientDirectory();
};

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
        .map(([day, round]) => `${day} (S${round})`)
        .join(", ");

      // HTML template for patient card styled in Apple Store Grid Card chassis (removed icon)
      card.innerHTML = `
        <div class="card-status-pill ${injectedThisWeek ? "completed" : "pending"}">
          ${injectedThisWeek ? "Completed" : "Pending Injection"}
        </div>
        
        <div class="patient-card-body">
          <h3>${patient.name}</h3>
          <p class="patient-card-med">Primary schedule: ${WEEKDAYS_FULL[patient.usualDay]} · Session ${patient.usualRound}</p>
          
          <div class="patient-meta-list" style="margin-top: 12px;">
            <div class="meta-item">
              <span class="meta-label">Schedule Matrix:</span> ${schedulesSummary || "No schedules set"}
            </div>
            <div class="meta-item" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">
              <span class="meta-label">Notes:</span> ${patient.notes ? patient.notes : `<span style="color: var(--color-ink-muted-48); font-style: italic;">No Note</span>`}
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

// Resolves the next injection date timezone-safely
function getNextInjectionDate(patient) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const freq = parseInt(patient.frequency) || 1;
  const baseSun = getFirstActiveWeekSunday(patient);
  const todaySun = getStartOfWeek(today);
  const diffDays = Math.round((todaySun - baseSun) / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.round(diffDays / 7);

  if (diffWeeks < 0) {
    // Today is before first week starts. Next injection is the first checklist date.
    return getPatientChecklistDate(patient, baseSun);
  }

  // Check if they have already been injected in the current cycle
  const cycleIndex = Math.floor(diffWeeks / freq);
  const cycleStartSun = new Date(baseSun);
  cycleStartSun.setDate(baseSun.getDate() + cycleIndex * freq * 7);
  const cycleEndSat = new Date(cycleStartSun);
  cycleEndSat.setDate(cycleStartSun.getDate() + freq * 7 - 1);
  const cycleStartStr = formatDateString(cycleStartSun);
  const cycleEndSatStr = formatDateString(cycleEndSat);

  const hasInjectedThisCycle = patient.injectionLogs.some(logDate => {
    return logDate >= cycleStartStr && logDate <= cycleEndSatStr;
  });

  if (hasInjectedThisCycle) {
    // Already injected in this cycle, look at next cycle
    const nextCycleRef = new Date(today);
    nextCycleRef.setDate(today.getDate() + freq * 7);
    return getPatientChecklistDate(patient, nextCycleRef);
  } else {
    // Pending in current cycle
    const currentChecklistDate = getPatientChecklistDate(patient, today);
    if (currentChecklistDate) {
      return currentChecklistDate;
    }
    // Fallback if current cycle check returns null, check next cycle
    const nextCycleRef = new Date(today);
    nextCycleRef.setDate(today.getDate() + freq * 7);
    return getPatientChecklistDate(patient, nextCycleRef);
  }
}

function getNextSecondaryInjectionDate(patient) {
  if (!patient.hasSecondary) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const freq = parseInt(patient.secondaryFrequency) || 1;
  const baseSun = getFirstActiveWeekSundaySecondary(patient);
  if (!baseSun) return null;
  const todaySun = getStartOfWeek(today);
  const diffDays = Math.round((todaySun - baseSun) / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.round(diffDays / 7);

  if (diffWeeks < 0) {
    return getPatientSecondaryChecklistDate(patient, baseSun);
  }

  const cycleIndex = Math.floor(diffWeeks / freq);
  const cycleStartSun = new Date(baseSun);
  cycleStartSun.setDate(baseSun.getDate() + cycleIndex * freq * 7);
  const cycleEndSat = new Date(cycleStartSun);
  cycleEndSat.setDate(cycleStartSun.getDate() + freq * 7 - 1);
  const cycleStartStr = formatDateString(cycleStartSun);
  const cycleEndSatStr = formatDateString(cycleEndSat);

  const secondaryLogs = patient.secondaryInjectionLogs || [];
  const hasInjectedThisCycle = secondaryLogs.some(logDate => {
    return logDate >= cycleStartStr && logDate <= cycleEndSatStr;
  });

  if (hasInjectedThisCycle) {
    const nextCycleRef = new Date(today);
    nextCycleRef.setDate(today.getDate() + freq * 7);
    return getPatientSecondaryChecklistDate(patient, nextCycleRef);
  } else {
    const currentChecklistDate = getPatientSecondaryChecklistDate(patient, today);
    if (currentChecklistDate) {
      return currentChecklistDate;
    }
    const nextCycleRef = new Date(today);
    nextCycleRef.setDate(today.getDate() + freq * 7);
    return getPatientSecondaryChecklistDate(patient, nextCycleRef);
  }
}

// 4. Patient Profile Details Modal
function openPatientDetails(patientId) {
  const patient = patients.find(p => p.id === patientId);
  if (!patient) return;

  const detailBody = document.getElementById("detail-modal-body");

  // Calculate and format next injection row
  const nextInjectionDate = getNextInjectionDate(patient);
  let nextInjectionHtml = "";
  if (nextInjectionDate) {
    nextInjectionHtml = `
      <div class="history-item next-injection" style="margin-bottom: var(--spacing-xs);">
        <span class="history-item-date">${formatPrettyDate(nextInjectionDate)}</span>
        <span class="history-item-badge">Next Injection</span>
      </div>
    `;
  }

  // Generate logs history list
  let logsHtml = `<p style="font-size: 14px; color: var(--color-ink-muted-48); font-style: italic;">No past injections logged</p>`;
  if (patient.injectionLogs.length > 0) {
    const sortedLogs = [...patient.injectionLogs].sort().reverse();
    logsHtml = `
      <div class="detail-history-list">
        ${nextInjectionHtml}
        ${sortedLogs.map(logDate => {
          return `
            <div class="history-item">
              <span class="history-item-date">${formatPrettyDate(logDate)}</span>
              <span class="history-item-badge">Injected</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } else if (nextInjectionHtml) {
    logsHtml = `
      <div class="detail-history-list">
        ${nextInjectionHtml}
      </div>
    `;
  }

  // Format dynamic matrix details
  const matrixDetailsHtml = Object.entries(patient.schedules)
    .map(([day, round]) => `
      <div style="background-color: var(--color-surface-pearl); border: 1px solid var(--color-hairline); border-radius: var(--rounded-sm); padding: var(--spacing-xs) var(--spacing-sm); font-size: 13px; font-weight: 600;">
        ${WEEKDAYS_FULL[day]}: Session ${round}
      </div>
    `).join("") || `<p style="font-size: 14px; color: var(--color-ink-muted-48); font-style: italic;">No clinic availability configured</p>`;

  let frequencyLabel = "Once per week";
  if (patient.frequency == 2) frequencyLabel = "Once per 2 weeks";
  if (patient.frequency == 4) frequencyLabel = "Once per 4 weeks";

  // Calculate and format secondary treatment details if active
  let secondaryDetailsHtml = "";
  if (patient.hasSecondary) {
    const nextSecDate = getNextSecondaryInjectionDate(patient);
    let nextSecHtml = "";
    if (nextSecDate) {
      nextSecHtml = `
        <div class="history-item next-injection" style="margin-bottom: var(--spacing-xs); background-color: var(--color-surface-pearl); border-color: var(--color-hairline); color: var(--color-ink-muted-48);">
          <span class="history-item-date" style="color: var(--color-ink-muted-48);">${formatPrettyDate(nextSecDate)}</span>
          <span class="history-item-badge" style="color: var(--color-ink-muted-48);">Next Injection</span>
        </div>
      `;
    }

    const secLogs = patient.secondaryInjectionLogs || [];
    let secLogsListHtml = `<p style="font-size: 14px; color: var(--color-ink-muted-48); font-style: italic;">No secondary course injections logged</p>`;
    if (secLogs.length > 0) {
      const sortedSecLogs = [...secLogs].sort().reverse();
      secLogsListHtml = `
        <div class="detail-history-list">
          ${nextSecHtml}
          ${sortedSecLogs.map(logDate => {
            return `
              <div class="history-item" style="background-color: var(--color-surface-pearl); border-color: var(--color-hairline); color: var(--color-ink-muted-48);">
                <span class="history-item-date" style="color: var(--color-ink-muted-48);">${formatPrettyDate(logDate)}</span>
                <span class="history-item-badge" style="color: var(--color-ink-muted-48);">Injected</span>
              </div>
            `;
          }).join("")}
        </div>
      `;
    } else if (nextSecHtml) {
      secLogsListHtml = `
        <div class="detail-history-list">
          ${nextSecHtml}
        </div>
      `;
    }

    let secFreqLabel = "Once per week";
    if (patient.secondaryFrequency == 2) secFreqLabel = "Once per 2 weeks";
    if (patient.secondaryFrequency == 4) secFreqLabel = "Once per 4 weeks";

    secondaryDetailsHtml = `
      <!-- Grey dashed line separator -->
      <div class="form-box-divider" style="border-top: 1.5px dashed rgba(0, 0, 0, 0.12); margin: var(--spacing-lg) 0;"></div>

      <h3 style="font-size: 14px; font-weight: 600; color: #b8860b; margin-top: 0; margin-bottom: var(--spacing-xs);">Secondary Treatment Details</h3>
      <div class="detail-grid-section" style="margin-top: var(--spacing-xs); margin-bottom: var(--spacing-sm);">
        <div class="detail-grid-item" style="grid-column: span 2;">
          <div class="detail-grid-item-label" style="color: var(--color-ink-muted-48);">Schedule Day</div>
          <div class="detail-grid-item-value" style="color: var(--color-ink-muted-48);">${WEEKDAYS_FULL[patient.secondaryUsualDay || patient.usualDay || "Mon"]} : Session ${patient.secondaryUsualRound || 1}</div>
        </div>
        <div class="detail-grid-item" style="grid-column: span 2;">
          <div class="detail-grid-item-label" style="color: var(--color-ink-muted-48);">First Injection Date</div>
          <div class="detail-grid-item-value" style="color: var(--color-ink-muted-48);">${patient.secondaryStartDate ? formatPrettyDate(patient.secondaryStartDate) : "Not set"}</div>
        </div>
        <div class="detail-grid-item" style="grid-column: span 2;">
          <div class="detail-grid-item-label" style="color: var(--color-ink-muted-48);">Last Injection Date (Estimated)</div>
          <div class="detail-grid-item-value" style="color: var(--color-ink-muted-48);">${formatPrettyDate(calculateLastInjectionDateSecondary(patient))}</div>
        </div>
        <div class="detail-grid-item">
          <div class="detail-grid-item-label" style="color: var(--color-ink-muted-48);">Dose Course</div>
          <div class="detail-grid-item-value" style="color: var(--color-ink-muted-48);">${patient.secondaryDoses || 10} Doses</div>
        </div>
        <div class="detail-grid-item">
          <div class="detail-grid-item-label" style="color: var(--color-ink-muted-48);">Frequency</div>
          <div class="detail-grid-item-value" style="color: var(--color-ink-muted-48);">${secFreqLabel}</div>
        </div>
      </div>

      <h3 style="font-size: 14px; font-weight: 600; color: var(--color-ink-muted-48); margin-bottom: var(--spacing-xs); margin-top: var(--spacing-lg);">Secondary Injection Log</h3>
      ${secLogsListHtml}
    `;
  }

  detailBody.innerHTML = `
    <div class="detail-main-header">
      <div class="detail-patient-avatar">
        ${patient.name.charAt(0)}
      </div>
      <div class="detail-main-info">
        <h2>${patient.name}</h2>
        ${patient.notes ? `<p style="font-size: 13px; line-height: 1.4; color: var(--color-ink-muted-48); margin-top: 4px; white-space: pre-wrap;"><strong>Note:</strong> ${patient.notes}</p>` : ""}
      </div>
    </div>

    <!-- Main Treatment Details Heading in Blue -->
    <h3 style="font-size: 14px; font-weight: 600; color: #0066cc; margin-top: var(--spacing-lg); margin-bottom: var(--spacing-xs);">Main Treatment Details</h3>
    <div class="detail-grid-section" style="margin-top: var(--spacing-xs);">
      <div class="detail-grid-item" style="grid-column: span 2;">
        <div class="detail-grid-item-label">Schedule Day</div>
        <div class="detail-grid-item-value">${WEEKDAYS_FULL[patient.usualDay]} : Session ${patient.usualRound}</div>
      </div>
      <div class="detail-grid-item" style="grid-column: span 2;">
        <div class="detail-grid-item-label">First Injection Date</div>
        <div class="detail-grid-item-value">${patient.startDate ? formatPrettyDate(patient.startDate) : "Not set"}</div>
      </div>
      <div class="detail-grid-item" style="grid-column: span 2;">
        <div class="detail-grid-item-label">Last Injection Date (Estimated)</div>
        <div class="detail-grid-item-value">${formatPrettyDate(calculateLastInjectionDate(patient))}</div>
      </div>
      <div class="detail-grid-item">
        <div class="detail-grid-item-label">Dose Course</div>
        <div class="detail-grid-item-value">${patient.doses || 10} Doses</div>
      </div>
      <div class="detail-grid-item">
        <div class="detail-grid-item-label">Frequency</div>
        <div class="detail-grid-item-value">${frequencyLabel}</div>
      </div>
    </div>

    <h3 style="font-size: 14px; font-weight: 600; color: var(--color-ink-muted-48); margin-bottom: var(--spacing-xs); margin-top: var(--spacing-lg);">Main Injection Log</h3>
    ${logsHtml}

    ${secondaryDetailsHtml}

    <h3 style="font-size: 14px; font-weight: 600; color: var(--color-ink-muted-48); margin-bottom: var(--spacing-xs); margin-top: var(--spacing-md);">Clinic Availability</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--spacing-xs); margin-bottom: var(--spacing-md);">
      ${matrixDetailsHtml}
    </div>
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

function initializeFormSecondaryToggle() {
  const toggleBtn = document.getElementById("toggle-secondary-btn");
  const secondarySection = document.getElementById("secondary-treatment-section");
  if (!toggleBtn || !secondarySection) return;
  toggleBtn.addEventListener("click", () => {
    const isVisible = secondarySection.style.display === "block";
    if (isVisible) {
      secondarySection.style.display = "none";
      toggleBtn.textContent = "Create Secondary Treatment";
      document.getElementById("p-sec-start-date").value = "";
      document.getElementById("p-sec-doses").value = "10";
      document.getElementById("p-sec-frequency").value = "1";
      document.getElementById("p-sec-usual-day").value = "Mon";
      document.getElementById("p-sec-usual-round").value = "1";
    } else {
      secondarySection.style.display = "block";
      toggleBtn.textContent = "Remove Secondary Treatment";
      const secDateInput = document.getElementById("p-sec-start-date");
      if (!secDateInput.value) secDateInput.value = formatDateString(new Date());
    }
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

  // Set default dates and doses
  document.getElementById("p-start-date").value = formatDateString(new Date());
  document.getElementById("p-doses").value = "10";
  document.getElementById("p-frequency").value = "1";

  // Hide secondary treatment and reset toggle button
  const secondarySection = document.getElementById("secondary-treatment-section");
  if (secondarySection) secondarySection.style.display = "none";
  const toggleBtn = document.getElementById("toggle-secondary-btn");
  if (toggleBtn) toggleBtn.textContent = "Create Secondary Treatment";
  
  // Reset secondary fields
  const secStartDate = document.getElementById("p-sec-start-date");
  if (secStartDate) secStartDate.value = "";
  const secDoses = document.getElementById("p-sec-doses");
  if (secDoses) secDoses.value = "10";
  const secFreq = document.getElementById("p-sec-frequency");
  if (secFreq) secFreq.value = "1";
  const secUsualDay = document.getElementById("p-sec-usual-day");
  if (secUsualDay) secUsualDay.value = "Mon";
  const secUsualRound = document.getElementById("p-sec-usual-round");
  if (secUsualRound) secUsualRound.value = "1";

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
  document.getElementById("p-doses").value = String(patient.doses || 10);
  document.getElementById("p-frequency").value = String(patient.frequency || "1");

  // Populate secondary treatment fields if active
  const secondarySection = document.getElementById("secondary-treatment-section");
  const toggleBtn = document.getElementById("toggle-secondary-btn");
  if (patient.hasSecondary) {
    if (secondarySection) secondarySection.style.display = "block";
    if (toggleBtn) toggleBtn.textContent = "Remove Secondary Treatment";
    
    const secStartDate = document.getElementById("p-sec-start-date");
    if (secStartDate) secStartDate.value = patient.secondaryStartDate || "";
    const secDoses = document.getElementById("p-sec-doses");
    if (secDoses) secDoses.value = String(patient.secondaryDoses || 10);
    const secFreq = document.getElementById("p-sec-frequency");
    if (secFreq) secFreq.value = String(patient.secondaryFrequency || "1");
    const secUsualDay = document.getElementById("p-sec-usual-day");
    if (secUsualDay) secUsualDay.value = patient.secondaryUsualDay || patient.usualDay || "Mon";
    const secUsualRound = document.getElementById("p-sec-usual-round");
    if (secUsualRound) secUsualRound.value = String(patient.secondaryUsualRound || 1);
  } else {
    if (secondarySection) secondarySection.style.display = "none";
    if (toggleBtn) toggleBtn.textContent = "Create Secondary Treatment";
    
    const secStartDate = document.getElementById("p-sec-start-date");
    if (secStartDate) secStartDate.value = "";
    const secDoses = document.getElementById("p-sec-doses");
    if (secDoses) secDoses.value = "10";
    const secFreq = document.getElementById("p-sec-frequency");
    if (secFreq) secFreq.value = "1";
    const secUsualDay = document.getElementById("p-sec-usual-day");
    if (secUsualDay) secUsualDay.value = "Mon";
    const secUsualRound = document.getElementById("p-sec-usual-round");
    if (secUsualRound) secUsualRound.value = "1";
  }

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
      renderMonthlyCalendar();
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
  const doses = parseInt(document.getElementById("p-doses").value) || 10;
  const frequency = parseInt(document.getElementById("p-frequency").value) || 1;

  // Secondary Treatment Form parameters
  const hasSecondary = document.getElementById("secondary-treatment-section").style.display === "block";
  const secondaryStartDate = document.getElementById("p-sec-start-date").value;
  const secondaryDoses = parseInt(document.getElementById("p-sec-doses").value) || 10;
  const secondaryFrequency = parseInt(document.getElementById("p-sec-frequency").value) || 1;
  const secondaryUsualDay = document.getElementById("p-sec-usual-day").value;
  const secondaryUsualRound = parseInt(document.getElementById("p-sec-usual-round").value);

  // Retrieve availability weekdays and custom sessions
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

  // Guarantee that the Preferred Secondary Usual day is also present in schedules
  if (hasSecondary && schedules[secondaryUsualDay] === undefined) {
    schedules[secondaryUsualDay] = secondaryUsualRound;
  }

  if (id) {
    // Update existing profile
    const idx = patients.findIndex(p => p.id === id);
    if (idx > -1) {
      patients[idx] = {
        ...patients[idx],
        name, usualDay, usualRound, schedules, notes, startDate, doses, frequency,
        hasSecondary, secondaryStartDate, secondaryDoses, secondaryFrequency,
        secondaryUsualDay, secondaryUsualRound,
        secondaryInjectionLogs: patients[idx].secondaryInjectionLogs || []
      };
    }
  } else {
    // Create new profile
    const newPatient = {
      id: "pat_" + Date.now(),
      name, usualDay, usualRound, schedules, notes, startDate, doses, frequency,
      injectionLogs: [],
      hasSecondary, secondaryStartDate, secondaryDoses, secondaryFrequency,
      secondaryUsualDay, secondaryUsualRound,
      secondaryInjectionLogs: []
    };
    patients.push(newPatient);
  }

  saveToLocalStorage();
  closeModal("patient-modal-overlay");
  renderMonthlyCalendar();
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

// Fires the system alarm notification listing patients scheduled for a specific session today
function fireRoundScheduledNotification(roundNum, isForcedTest = false) {
  const todayDate = new Date();
  const dayIndex = todayDate.getDay(); // Sun=0, Mon=1, etc.
  const todayDayName = WEEKDAYS[dayIndex];

  // Find patients due for injection today in this specific session
  const dueThisRound = patients.filter(p => {
    const mappedRound = p.schedules[todayDayName];
    return mappedRound !== undefined && parseInt(mappedRound) === roundNum;
  });

  let title = `Vial Session ${roundNum} Alarm`;
  let body = "";

  if (isForcedTest) {
    title = "Vial — Smart Watch Sync Verified";
    if (dueThisRound.length === 0) {
      body = `Diagnostic complete! Test note received on watch (No Session ${roundNum} patients scheduled today) Total patient database: ${patients.length} records`;
    } else {
      const namesList = dueThisRound.map(p => p.name).join(", ");
      body = `Session ${roundNum} diagnostic alert: ${dueThisRound.length} scheduled: ${namesList}`;
    }
  } else {
    if (dueThisRound.length === 0) {
      return; // Do not push alerts if nobody is scheduled
    } else {
      const namesList = dueThisRound.map(p => p.name).join(", ");
      body = `Session ${roundNum} starting: ${dueThisRound.length} patient injections due: ${namesList}`;
    }
  }

  // Fire Web Notification
  if ("Notification" in window && Notification.permission === "granted") {
    const options = {
      body: body,
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: `vial-session-alarm-${roundNum}-${formatDateString(todayDate)}`,
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
    console.log(`System session ${roundNum} notification fired successfully`);
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

// Initialize Custom Session Times from Local Storage on load
function loadSettingsConfig() {
  const alarmToggle = document.getElementById("alarm-toggle");
  if (alarmToggle) {
    const alarmState = localStorage.getItem("vial_alarm_enabled");
    if (alarmState !== null) {
      alarmToggle.checked = alarmState === "true";
    }
    alarmToggle.addEventListener("change", (e) => {
      localStorage.setItem("vial_alarm_enabled", e.target.checked);
    });
  }

  const r1 = localStorage.getItem("vial_alarm_r1") || "06:50";
  const r2 = localStorage.getItem("vial_alarm_r2") || "10:50";
  const r3 = localStorage.getItem("vial_alarm_r3") || "12:50";

  const r1Input = document.getElementById("alarm-time-r1");
  if (r1Input) {
    r1Input.value = r1;
    r1Input.addEventListener("change", (e) => {
      localStorage.setItem("vial_alarm_r1", e.target.value);
    });
  }

  const r2Input = document.getElementById("alarm-time-r2");
  if (r2Input) {
    r2Input.value = r2;
    r2Input.addEventListener("change", (e) => {
      localStorage.setItem("vial_alarm_r2", e.target.value);
    });
  }

  const r3Input = document.getElementById("alarm-time-r3");
  if (r3Input) {
    r3Input.value = r3;
    r3Input.addEventListener("change", (e) => {
      localStorage.setItem("vial_alarm_r3", e.target.value);
    });
  }

  const clearDbBtn = document.getElementById("clear-database-btn");
  if (clearDbBtn) {
    clearDbBtn.addEventListener("click", () => {
      const confirm1 = confirm("Are you sure you want to permanently clear all patient data? This will erase all logs and configurations");
      if (confirm1) {
        const confirm2 = confirm("This action cannot be undone. Are you absolutely certain you wish to wipe the entire clinical database?");
        if (confirm2) {
          patients = [];
          saveToLocalStorage();
          renderMonthlyCalendar();
          if (selectedDate) renderDailyAgenda(selectedDate);
          renderPatientDirectory();
          alert("Clinical database has been completely purged");
        }
      }
    });
  }

  // Bind Export Data button click listener
  const exportBtn = document.getElementById("export-data-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const formatSelect = document.getElementById("export-format-select");
      if (!formatSelect) return;
      const format = formatSelect.value;
      
      if (!patients || patients.length === 0) {
        alert("No patient data available to export.");
        return;
      }
      
      const headers = ["Name", "Frequency", "First injection", "Injected Doses", "Remaining Dose"];
      const rows = patients.map(p => {
        let freqLabel = "Once per week";
        if (p.frequency == 2) freqLabel = "Once per 2 weeks";
        if (p.frequency == 4) freqLabel = "Once per 4 weeks";
        
        const injected = p.injectionLogs ? p.injectionLogs.length : 0;
        const remaining = Math.max(0, (p.doses || 10) - injected);
        
        return [
          p.name,
          freqLabel,
          formatDateDMY(p.startDate),
          injected,
          remaining
        ];
      });

      if (format === "csv") {
        const csvContent = "\uFEFF" + [headers.join(",")].concat(rows.map(r => r.map(escapeCSV).join(","))).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "patient_clinical_summary.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (format === "xlsx") {
        if (typeof XLSX === "undefined") {
          alert("Excel export library is loading. Please try again in a moment.");
          return;
        }
        
        const sheetData = [headers, ...rows];
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        
        // Auto-fit column widths
        const colWidths = headers.map((h, i) => {
          let maxLen = h.length;
          rows.forEach(r => {
            const cellVal = String(r[i] || '');
            if (cellVal.length > maxLen) {
              maxLen = cellVal.length;
            }
          });
          return { wch: maxLen + 4 };
        });
        worksheet['!cols'] = colWidths;
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Patient Summary");
        XLSX.writeFile(workbook, "patient_clinical_summary.xlsx");
      } else if (format === "pdf") {
        exportToPDF(headers, rows);
      }
    });
  }
}

// 8. Application Initializer on DOM Load
document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  
  // Set currentMonth calendar header anchor, and default select selectedDate as today
  currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDate = today;

  // Seed database and complete safe schema migrations for existing LocalStorage data
  seedDatabase();

  // Load alert timings
  loadSettingsConfig();

  // Core Renderers
  updateDashboardStats();
  renderMonthlyCalendar();
  renderDailyAgenda(selectedDate);
  renderPatientDirectory();

  // Bind interactive modal available days checkboxes dropdown behaviors
  bindFormCheckboxesBehavior();
  initializeFormSecondaryToggle();

  // Bind left collapsible drawer toggle navigation (Midori-style)
  initializeDrawerNavigation();

  // 9. Event Listeners binding
  
  // Add patient navigation action
  const addPatientBtn = document.getElementById("add-patient-btn");
  if (addPatientBtn) {
    addPatientBtn.addEventListener("click", openAddPatientForm);
  }

  // Safely retrieve empty-add-btn to prevent click event binding failures if database is cleared/loaded
  const emptyAddBtn = document.getElementById("empty-add-btn");
  if (emptyAddBtn) {
    emptyAddBtn.addEventListener("click", openAddPatientForm);
  }

  // Form submission
  const patientForm = document.getElementById("patient-form");
  if (patientForm) {
    patientForm.addEventListener("submit", handleFormSubmit);
  }

  // Modal Cancel and Close button clicks
  const closeModalBtn = document.getElementById("close-modal-btn");
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => closeModal("patient-modal-overlay"));
  }
  const cancelFormBtn = document.getElementById("cancel-form-btn");
  if (cancelFormBtn) {
    cancelFormBtn.addEventListener("click", () => closeModal("patient-modal-overlay"));
  }
  const closeDetailBtn = document.getElementById("close-detail-btn");
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener("click", () => closeModal("detail-modal-overlay"));
  }
  const closeDetailBottomBtn = document.getElementById("close-detail-bottom-btn");
  if (closeDetailBottomBtn) {
    closeDetailBottomBtn.addEventListener("click", () => closeModal("detail-modal-overlay"));
  }

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

  // Month Navigator button clicks
  const prevMonthBtn = document.getElementById("prev-month-btn");
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener("click", () => {
      currentMonth.setMonth(currentMonth.getMonth() - 1);
      renderMonthlyCalendar();
    });
  }
  const nextMonthBtn = document.getElementById("next-month-btn");
  if (nextMonthBtn) {
    nextMonthBtn.addEventListener("click", () => {
      currentMonth.setMonth(currentMonth.getMonth() + 1);
      renderMonthlyCalendar();
    });
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
  const triggerTestNotifBtn = document.getElementById("trigger-test-notif-btn");
  if (triggerTestNotifBtn) {
    triggerTestNotifBtn.addEventListener("click", triggerTestNotification);
  }
  
  // Prompt notification permission request slightly after load
  setTimeout(requestNotificationPermission, 2000);

  // Start background alarms watcher
  startAlarmTimeWatcher();

  // Smooth local navigation links highlighting
  window.addEventListener("scroll", () => {
    const hash = window.location.hash;
    if (hash === "#calendar-section" || hash === "#calendar-page") return;

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

  // Handle SPA routing on load and hash change
  handleRouting();
  window.addEventListener("hashchange", handleRouting);

  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Vial Service Worker registered successfully:', reg.scope))
        .catch(err => console.error('Service Worker registration failed:', err));
    });
  }
});

// SPA Hash routing logic
function handleRouting() {
  const hash = window.location.hash;
  const isCalendar = (hash === "#calendar-section" || hash === "#calendar-page");

  const overviewSec = document.getElementById("overview-section");
  const calendarSec = document.getElementById("calendar-section");
  const databaseSec = document.getElementById("database-section");
  const settingsSec = document.getElementById("settings-section");
  const subNav = document.getElementById("sub-nav");

  if (isCalendar) {
    if (overviewSec) overviewSec.style.display = "none";
    if (databaseSec) databaseSec.style.display = "none";
    if (settingsSec) settingsSec.style.display = "none";
    if (subNav) subNav.style.display = "none";
    if (calendarSec) calendarSec.style.display = "block";

    // Update active highlight classes on links
    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.remove("active");
      if (item.getAttribute("href") === "#calendar-section") {
        item.classList.add("active");
      }
    });
    document.querySelectorAll(".drawer-item").forEach(item => {
      item.classList.remove("active");
      if (item.getAttribute("href") === "#calendar-section") {
        item.classList.add("active");
      }
    });
    
    window.scrollTo(0, 0);
  } else {
    // Show main sections
    if (overviewSec) overviewSec.style.display = "";
    if (databaseSec) databaseSec.style.display = "";
    if (settingsSec) settingsSec.style.display = "";
    if (subNav) subNav.style.display = "";
    if (calendarSec) calendarSec.style.display = "none";

    // Set correct active highlight on links based on current hash
    const currentHash = hash || "#overview-section";
    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.remove("active");
      if (item.getAttribute("href") === currentHash) {
        item.classList.add("active");
      }
    });
    document.querySelectorAll(".drawer-item").forEach(item => {
      item.classList.remove("active");
      if (item.getAttribute("href") === currentHash) {
        item.classList.add("active");
      }
    });
  }
}

// Export Format Helpers
function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function escapeXML(str) {
  if (!str) return '';
  return str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}



function exportToPDF(headers, rows) {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    alert("Popup blocker prevented exporting to PDF. Please allow popups for this site.");
    return;
  }
  
  // Format current date as DD/MM/YYYY
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const formattedDate = `${day}/${month}/${year}`;
  
  let html = `<!DOCTYPE html>
<html>
<head>
  <title>Patient Summary Report</title>
  <style>
    @page {
      margin: 0;
      size: letter;
    }
    html, body {
      margin: 0;
      padding: 0;
      user-select: text !important;
      -webkit-user-select: text !important;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1d1d1f;
      padding: 20mm;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 20px 0;
      color: #1d1d1f;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th {
      background-color: #f5f5f7;
      color: #1d1d1f;
      font-weight: 600;
      text-align: left;
      padding: 12px 16px;
      border-bottom: 1px solid #d2d2d7;
      font-size: 14px;
    }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e5ea;
      font-size: 14px;
    }
    tr:last-child td {
      border-bottom: 2px solid #d2d2d7;
    }
    .report-footer {
      text-align: right;
      margin-top: 40px;
      font-size: 12px;
      color: #86868b;
    }
    * {
      user-select: text !important;
      -webkit-user-select: text !important;
    }
  </style>
</head>
<body>
  <h1>Clinical Patient Summary Report</h1>

  <table>
    <thead>
      <tr>
        ${headers.map(h => `<th>${escapeXML(h)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          ${r.map(val => `<td>${escapeXML(String(val))}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="report-footer">
    Report Generated: ${formattedDate}
  </div>
  
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;
  
  printWindow.document.write(html);
  printWindow.document.close();
}

function formatDateDMY(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}
