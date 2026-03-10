const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");

const bookingForm = document.getElementById("bookingForm");
const formSuccess = document.getElementById("formSuccess");
const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");
const selectedDateDisplay = document.getElementById("selectedDateDisplay");
const selectedTimeDisplay = document.getElementById("selectedTimeDisplay");
const availabilityStatus = document.getElementById("availabilityStatus");
const bookingDetails = document.getElementById("bookingDetails");

const calendarMonthLabel = document.getElementById("calendarMonthLabel");
const calendarDays = document.getElementById("calendarDays");
const calendarPrev = document.getElementById("calendarPrev");
const calendarNext = document.getElementById("calendarNext");
const timeSlotGrid = document.getElementById("timeSlotGrid");

const STORAGE_KEY = "twissupsAvailabilityV3";
const BOOKINGS_KEY = "twissupsBookingsV3";

const BOOKING_WINDOW = {
  openMinutes: 10 * 60,
  closeMinutes: 19 * 60,
  intervalMinutes: 30,
};

const STUDENT_TEMPLATE = {
  2: [[16 * 60, 19 * 60]],
  3: [[15 * 60, 19 * 60]],
  4: [[16 * 60, 19 * 60]],
  5: [[15 * 60, 19 * 60]],
  6: [[10 * 60, 17 * 60]],
};

let availabilityByDate = loadAvailability();
let bookings = loadBookings();
let calendarViewDate = startOfMonth(new Date());

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromIsoDate(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeSlot(slotValue) {
  const slot = Number(slotValue);
  const withinBounds = slot >= BOOKING_WINDOW.openMinutes && slot < BOOKING_WINDOW.closeMinutes;
  const onInterval = slot % BOOKING_WINDOW.intervalMinutes === 0;

  if (!Number.isFinite(slot) || !withinBounds || !onInterval) {
    return null;
  }

  return slot;
}

function generateSlots(startMinutes, endMinutes, intervalMinutes) {
  const output = [];
  for (let minute = startMinutes; minute < endMinutes; minute += intervalMinutes) {
    output.push(minute);
  }
  return output;
}

function formatLongDate(dateValue) {
  return fromIsoDate(dateValue).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(minutes) {
  const period = minutes >= 12 * 60 ? "PM" : "AM";
  const rawHour = Math.floor(minutes / 60);
  const hour = rawHour % 12 || 12;
  const mins = String(minutes % 60).padStart(2, "0");
  return `${hour}:${mins} ${period}`;
}

function safeReadStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeWriteStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore localStorage write failures.
  }
}

function sanitizeAvailability(raw) {
  const cleaned = {};

  if (!raw || typeof raw !== "object") {
    return cleaned;
  }

  Object.entries(raw).forEach(([date, slots]) => {
    if (!isIsoDate(date) || !Array.isArray(slots)) {
      return;
    }

    const normalized = slots
      .map(normalizeSlot)
      .filter((slot) => slot !== null)
      .sort((a, b) => a - b);

    if (normalized.length > 0) {
      cleaned[date] = Array.from(new Set(normalized));
    }
  });

  return cleaned;
}

function createDefaultAvailability() {
  const seeded = {};
  const today = startOfDay(new Date());

  for (let dayOffset = 0; dayOffset < 60; dayOffset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + dayOffset);

    const ranges = STUDENT_TEMPLATE[date.getDay()];
    if (!ranges) {
      continue;
    }

    const slots = [];
    ranges.forEach(([start, end]) => {
      slots.push(...generateSlots(start, end, BOOKING_WINDOW.intervalMinutes));
    });

    seeded[toIsoDate(date)] = Array.from(new Set(slots)).sort((a, b) => a - b);
  }

  return seeded;
}

function loadAvailability() {
  const parsed = sanitizeAvailability(safeReadStorage(STORAGE_KEY));
  if (Object.keys(parsed).length > 0) {
    return parsed;
  }

  const seeded = createDefaultAvailability();
  safeWriteStorage(STORAGE_KEY, seeded);
  return seeded;
}

function loadBookings() {
  const parsed = safeReadStorage(BOOKINGS_KEY);
  return Array.isArray(parsed) ? parsed : [];
}

function saveAvailability() {
  safeWriteStorage(STORAGE_KEY, availabilityByDate);
}

function saveBookings() {
  safeWriteStorage(BOOKINGS_KEY, bookings);
}

function setAvailabilityStatus(message, tone = "neutral") {
  availabilityStatus.textContent = message;
  availabilityStatus.dataset.tone = tone;
}

function resetBookingSelection(hideSuccess = true) {
  dateInput.value = "";
  timeInput.value = "";
  selectedDateDisplay.value = "";
  selectedTimeDisplay.value = "";
  bookingDetails.hidden = true;

  if (hideSuccess) {
    formSuccess.style.display = "none";
  }
}

function renderBookingCalendar() {
  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = startOfDay(new Date());

  calendarMonthLabel.textContent = calendarViewDate.toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  });

  calendarDays.innerHTML = "";

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    const filler = document.createElement("div");
    filler.className = "calendar-filler";
    calendarDays.appendChild(filler);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const isoDate = toIsoDate(date);
    const isPast = date < today;
    const hasAvailability = Boolean(availabilityByDate[isoDate]?.length);

    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = "calendar-day";
    dayButton.textContent = String(day);

    if (isoDate === dateInput.value) {
      dayButton.classList.add("selected");
    }

    if (isPast || !hasAvailability) {
      dayButton.classList.add("unavailable");
      dayButton.disabled = true;
    } else {
      dayButton.classList.add("available");
      dayButton.addEventListener("click", () => {
        selectDate(isoDate);
      });
    }

    dayButton.setAttribute(
      "aria-label",
      `${formatLongDate(isoDate)} ${isPast || !hasAvailability ? "unavailable" : "available"}`
    );

    calendarDays.appendChild(dayButton);
  }
}

function renderTimeSlots(dateValue) {
  timeSlotGrid.innerHTML = "";
  timeInput.value = "";
  selectedTimeDisplay.value = "";
  bookingDetails.hidden = true;

  if (!dateValue) {
    const empty = document.createElement("p");
    empty.className = "time-slot-empty";
    empty.textContent = "Select a date in the calendar to view available times.";
    timeSlotGrid.appendChild(empty);
    setAvailabilityStatus("Select a date to load available times.");
    return;
  }

  const times = availabilityByDate[dateValue] || [];
  if (times.length === 0) {
    const empty = document.createElement("p");
    empty.className = "time-slot-empty";
    empty.textContent = "No available times are set for this date.";
    timeSlotGrid.appendChild(empty);
    setAvailabilityStatus("No available times on this date. Please pick another day.", "danger");
    return;
  }

  times.forEach((slot) => {
    const timeButton = document.createElement("button");
    timeButton.type = "button";
    timeButton.className = "time-slot-btn";
    timeButton.dataset.slot = String(slot);
    timeButton.textContent = formatTime(slot);

    timeButton.addEventListener("click", () => {
      selectTime(slot);
    });

    timeSlotGrid.appendChild(timeButton);
  });

  setAvailabilityStatus("Choose a time to continue.");
}

function selectDate(dateValue) {
  dateInput.value = dateValue;
  selectedDateDisplay.value = formatLongDate(dateValue);
  formSuccess.style.display = "none";

  renderBookingCalendar();
  renderTimeSlots(dateValue);
}

function selectTime(slot) {
  timeInput.value = String(slot);
  selectedTimeDisplay.value = formatTime(slot);
  bookingDetails.hidden = false;
  formSuccess.style.display = "none";

  timeSlotGrid.querySelectorAll(".time-slot-btn").forEach((button) => {
    button.classList.toggle("selected", Number(button.dataset.slot) === slot);
  });

  setAvailabilityStatus(
    `Selected ${formatLongDate(dateInput.value)} at ${formatTime(slot)}. Complete your details below.`,
    "success"
  );
}

function removeBookedSlot(dateValue, slot) {
  const existing = availabilityByDate[dateValue] || [];
  const remaining = existing.filter((minute) => minute !== slot);

  if (remaining.length > 0) {
    availabilityByDate[dateValue] = remaining;
  } else {
    delete availabilityByDate[dateValue];
  }
}

function initBookingFlow() {
  resetBookingSelection();
  renderBookingCalendar();
  renderTimeSlots("");

  calendarPrev.addEventListener("click", () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1);
    renderBookingCalendar();
  });

  calendarNext.addEventListener("click", () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1);
    renderBookingCalendar();
  });

  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(bookingForm);
    const name = formData.get("name")?.toString().trim();
    const phone = formData.get("phone")?.toString().trim();
    const email = formData.get("email")?.toString().trim();
    const notes = formData.get("notes")?.toString().trim();
    const dateValue = formData.get("date")?.toString();
    const timeValue = formData.get("time")?.toString();

    if (!dateValue || !timeValue) {
      alert("Please select a date and time first.");
      return;
    }

    if (!name || !phone || !email || !notes) {
      alert("Please complete all required details.");
      return;
    }

    const slot = Number(timeValue);
    const stillAvailable = (availabilityByDate[dateValue] || []).includes(slot);

    if (!stillAvailable) {
      alert("That time is no longer available. Please choose another time.");
      renderBookingCalendar();
      renderTimeSlots(dateValue);
      return;
    }

    bookings.push({
      name,
      phone,
      email,
      notes,
      date: dateValue,
      time: slot,
      createdAt: new Date().toISOString(),
    });

    removeBookedSlot(dateValue, slot);
    saveBookings();
    saveAvailability();

    renderBookingCalendar();

    formSuccess.textContent = `Booked ${formatLongDate(dateValue)} at ${formatTime(slot)} in this demo.`;
    formSuccess.style.display = "block";

    bookingForm.reset();
    resetBookingSelection(false);
    renderTimeSlots("");
  });
}

if (menuBtn && navLinks) {
  menuBtn.addEventListener("click", () => {
    navLinks.classList.toggle("mobile-open");
  });

  document.querySelectorAll(".nav-links a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("mobile-open");
    });
  });
}

initBookingFlow();
