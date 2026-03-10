const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const bookingForm = document.getElementById("bookingForm");
const formSuccess = document.getElementById("formSuccess");
const bookingModal = document.getElementById("bookingModal");
const closeModal = document.getElementById("closeModal");
const goToBooking = document.getElementById("goToBooking");
const openBookingButtons = document.querySelectorAll(".open-booking");
const faqItems = document.querySelectorAll(".faq-item");

const serviceSelect = document.getElementById("service");
const dateInput = document.getElementById("date");
const selectedDateDisplay = document.getElementById("selectedDateDisplay");
const timeSelect = document.getElementById("time");
const availabilityStatus = document.getElementById("availabilityStatus");

const bookingCalendar = document.getElementById("bookingCalendar");
const calendarMonthLabel = document.getElementById("calendarMonthLabel");
const calendarDays = document.getElementById("calendarDays");
const calendarPrev = document.getElementById("calendarPrev");
const calendarNext = document.getElementById("calendarNext");

const managerToggle = document.getElementById("managerToggle");
const managerPanel = document.getElementById("managerPanel");
const availabilityDateInput = document.getElementById("availabilityDate");
const slotPicker = document.getElementById("slotPicker");
const saveAvailabilityButton = document.getElementById("saveAvailability");
const clearDateAvailabilityButton = document.getElementById("clearDateAvailability");
const managerStatus = document.getElementById("managerStatus");
const availabilitySummary = document.getElementById("availabilitySummary");

const STORAGE_KEYS = {
  availability: "twissupsAvailabilityV1",
  bookings: "twissupsBookingsV1",
};

const BUSINESS_SCHEDULE = {
  openMinutes: 10 * 60,
  closeMinutes: 19 * 60,
  intervalMinutes: 30,
};

const SERVICE_DURATIONS = {
  "Knotless Braids": 240,
  Cornrows: 150,
  Twists: 180,
  "Stitch Braids": 180,
  Consultation: 30,
};

const STUDENT_TEMPLATE = {
  2: [[16 * 60, 19 * 60]],
  3: [[15 * 60, 19 * 60]],
  4: [[16 * 60, 19 * 60]],
  5: [[15 * 60, 19 * 60]],
  6: [[10 * 60, 17 * 60]],
};

const ALL_SLOT_OPTIONS = generateSlotsFromRange(
  BUSINESS_SCHEDULE.openMinutes,
  BUSINESS_SCHEDULE.closeMinutes,
  BUSINESS_SCHEDULE.intervalMinutes
);

let availabilityByDate = loadAvailabilityFromStorage();
let bookingsByDate = loadBookingsFromStorage();
let managerSelectedSlots = new Set();
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

function normalizeSlotValue(value) {
  const minute = Number(value);
  const withinHours =
    minute >= BUSINESS_SCHEDULE.openMinutes && minute < BUSINESS_SCHEDULE.closeMinutes;
  const onInterval = minute % BUSINESS_SCHEDULE.intervalMinutes === 0;

  if (!Number.isFinite(minute) || !withinHours || !onInterval) {
    return null;
  }

  return minute;
}

function safeParseStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write issues in restricted browser modes.
  }
}

function generateSlotsFromRange(startMinutes, endMinutes, interval) {
  const slots = [];
  for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
    slots.push(minutes);
  }
  return slots;
}

function createDefaultAvailability() {
  const defaults = {};
  const today = startOfDay(new Date());

  for (let offset = 0; offset < 45; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);

    const dayTemplate = STUDENT_TEMPLATE[date.getDay()];
    if (!dayTemplate) {
      continue;
    }

    const slots = [];
    dayTemplate.forEach(([start, end]) => {
      slots.push(...generateSlotsFromRange(start, end, BUSINESS_SCHEDULE.intervalMinutes));
    });

    defaults[toIsoDate(date)] = Array.from(new Set(slots)).sort((a, b) => a - b);
  }

  return defaults;
}

function sanitizeAvailability(rawAvailability) {
  const cleaned = {};

  if (!rawAvailability || typeof rawAvailability !== "object") {
    return cleaned;
  }

  Object.entries(rawAvailability).forEach(([date, slots]) => {
    if (!isIsoDate(date) || !Array.isArray(slots)) {
      return;
    }

    const normalized = slots
      .map(normalizeSlotValue)
      .filter((minute) => minute !== null)
      .sort((a, b) => a - b);

    if (normalized.length > 0) {
      cleaned[date] = Array.from(new Set(normalized));
    }
  });

  return cleaned;
}

function sanitizeBookings(rawBookings) {
  const cleaned = {};

  if (!rawBookings || typeof rawBookings !== "object") {
    return cleaned;
  }

  Object.entries(rawBookings).forEach(([date, bookings]) => {
    if (!isIsoDate(date) || !Array.isArray(bookings)) {
      return;
    }

    const normalized = bookings
      .map((booking) => {
        if (!booking || typeof booking !== "object") {
          return null;
        }

        const startMinutes = normalizeSlotValue(booking.startMinutes);
        const durationMinutes = Number(booking.durationMinutes);

        if (
          startMinutes === null ||
          !Number.isFinite(durationMinutes) ||
          durationMinutes <= 0 ||
          durationMinutes % BUSINESS_SCHEDULE.intervalMinutes !== 0
        ) {
          return null;
        }

        return {
          startMinutes,
          durationMinutes,
          service: typeof booking.service === "string" ? booking.service : "",
        };
      })
      .filter((booking) => booking !== null)
      .sort((a, b) => a.startMinutes - b.startMinutes);

    if (normalized.length > 0) {
      cleaned[date] = normalized;
    }
  });

  return cleaned;
}

function loadAvailabilityFromStorage() {
  const stored = sanitizeAvailability(safeParseStorage(STORAGE_KEYS.availability));
  if (Object.keys(stored).length > 0) {
    return stored;
  }

  const seeded = createDefaultAvailability();
  saveStorage(STORAGE_KEYS.availability, seeded);
  return seeded;
}

function loadBookingsFromStorage() {
  return sanitizeBookings(safeParseStorage(STORAGE_KEYS.bookings));
}

function persistAvailability() {
  saveStorage(STORAGE_KEYS.availability, availabilityByDate);
}

function persistBookings() {
  saveStorage(STORAGE_KEYS.bookings, bookingsByDate);
}

function formatLongDate(dateValue) {
  return fromIsoDate(dateValue).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeLabel(minutes) {
  const period = minutes >= 12 * 60 ? "PM" : "AM";
  const rawHour = Math.floor(minutes / 60);
  const hour12 = rawHour % 12 || 12;
  const mins = String(minutes % 60).padStart(2, "0");
  return `${hour12}:${mins} ${period}`;
}

function formatDuration(minutes) {
  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }

  return `${hours.toFixed(1)} hrs`;
}

function setAvailabilityStatus(message, tone = "neutral") {
  availabilityStatus.textContent = message;
  availabilityStatus.dataset.tone = tone;
}

function setManagerStatus(message, tone = "neutral") {
  managerStatus.textContent = message;
  managerStatus.dataset.tone = tone;
}

function resetTimeOptions(message) {
  timeSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = message;
  placeholder.disabled = true;
  placeholder.selected = true;
  timeSelect.appendChild(placeholder);
}

function getServiceDuration(serviceName) {
  return SERVICE_DURATIONS[serviceName] || 0;
}

function getIntervalsNeeded(serviceName) {
  const duration = getServiceDuration(serviceName);
  return duration / BUSINESS_SCHEDULE.intervalMinutes;
}

function hasBookingConflict(startMinutes, durationMinutes, dayBookings) {
  const endMinutes = startMinutes + durationMinutes;

  return dayBookings.some((booking) => {
    const bookingEnd = booking.startMinutes + booking.durationMinutes;
    return startMinutes < bookingEnd && endMinutes > booking.startMinutes;
  });
}

function getAvailableStartTimes(dateValue, serviceName) {
  const duration = getServiceDuration(serviceName);
  const intervalsNeeded = getIntervalsNeeded(serviceName);

  if (!duration || !intervalsNeeded || !availabilityByDate[dateValue]) {
    return [];
  }

  const daySlots = availabilityByDate[dateValue];
  const slotSet = new Set(daySlots);
  const dayBookings = bookingsByDate[dateValue] || [];

  return daySlots.filter((startMinutes) => {
    for (let step = 0; step < intervalsNeeded; step += 1) {
      const slotToCheck = startMinutes + step * BUSINESS_SCHEDULE.intervalMinutes;
      if (!slotSet.has(slotToCheck)) {
        return false;
      }
    }

    return !hasBookingConflict(startMinutes, duration, dayBookings);
  });
}

function setDateConstraints() {
  const minDate = toIsoDate(startOfDay(new Date()));
  availabilityDateInput.min = minDate;
}

function selectBookingDate(dateValue) {
  dateInput.value = dateValue;
  selectedDateDisplay.value = formatLongDate(dateValue);
  formSuccess.style.display = "none";
  refreshAvailability();
  renderBookingCalendar();
}

function clearBookingDateSelection() {
  dateInput.value = "";
  selectedDateDisplay.value = "";
  refreshAvailability();
  renderBookingCalendar();
}

function renderBookingCalendar() {
  if (!bookingCalendar) {
    return;
  }

  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();

  calendarMonthLabel.textContent = calendarViewDate.toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  });

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = startOfDay(new Date());
  const selectedService = serviceSelect.value;

  calendarDays.innerHTML = "";

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    const filler = document.createElement("div");
    filler.className = "calendar-filler";
    calendarDays.appendChild(filler);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = String(day);

    const date = new Date(year, month, day);
    const isoDate = toIsoDate(date);
    const isPast = date < today;
    const hasDateAvailability = Boolean(availabilityByDate[isoDate]?.length);
    const hasServiceAvailability = selectedService
      ? getAvailableStartTimes(isoDate, selectedService).length > 0
      : hasDateAvailability;

    if (isoDate === dateInput.value) {
      button.classList.add("selected");
    }

    if (isPast || !hasServiceAvailability) {
      button.classList.add("unavailable");
      button.disabled = true;
    } else {
      button.classList.add("available");
      button.addEventListener("click", () => selectBookingDate(isoDate));
    }

    button.setAttribute(
      "aria-label",
      `${formatLongDate(isoDate)} ${isPast || !hasServiceAvailability ? "unavailable" : "available"}`
    );

    calendarDays.appendChild(button);
  }
}

function renderSlotPicker() {
  slotPicker.innerHTML = "";

  ALL_SLOT_OPTIONS.forEach((minute) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slot-chip";
    button.dataset.minute = String(minute);
    button.textContent = formatTimeLabel(minute);
    slotPicker.appendChild(button);
  });

  updateSlotPickerState();
}

function updateSlotPickerState() {
  const hasDate = Boolean(availabilityDateInput.value);
  slotPicker.querySelectorAll(".slot-chip").forEach((chip) => {
    const minute = Number(chip.dataset.minute);
    chip.disabled = !hasDate;
    chip.classList.toggle("active", managerSelectedSlots.has(minute));
  });
}

function loadManagerDate(dateValue) {
  if (!dateValue) {
    managerSelectedSlots = new Set();
    updateSlotPickerState();
    setManagerStatus("Select a date to manage available time slots.");
    return;
  }

  managerSelectedSlots = new Set(availabilityByDate[dateValue] || []);
  updateSlotPickerState();

  const selectedCount = managerSelectedSlots.size;
  if (selectedCount === 0) {
    setManagerStatus("No time blocks are currently open for this date.", "warning");
    return;
  }

  setManagerStatus(
    `${selectedCount} time block${selectedCount === 1 ? "" : "s"} currently open on ${formatLongDate(dateValue)}.`,
    "success"
  );
}

function renderAvailabilitySummary() {
  const todayIso = toIsoDate(startOfDay(new Date()));
  const upcomingDates = Object.keys(availabilityByDate)
    .filter((date) => date >= todayIso && availabilityByDate[date].length > 0)
    .sort();

  availabilitySummary.innerHTML = "";

  if (upcomingDates.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No available dates set yet.";
    availabilitySummary.appendChild(empty);
    return;
  }

  upcomingDates.slice(0, 12).forEach((date) => {
    const item = document.createElement("li");
    const slotCount = availabilityByDate[date].length;
    item.textContent = `${formatLongDate(date)} - ${slotCount} open time block${slotCount === 1 ? "" : "s"}`;
    availabilitySummary.appendChild(item);
  });
}

function refreshAvailability() {
  const service = serviceSelect.value;
  const dateValue = dateInput.value;

  timeSelect.disabled = true;

  if (!service && !dateValue) {
    resetTimeOptions("Select a service and date first");
    setAvailabilityStatus("Pick a service and date to view available time options.");
    return;
  }

  if (!service) {
    resetTimeOptions("Select a service first");
    setAvailabilityStatus("Select your service before choosing a time.", "warning");
    return;
  }

  if (!dateValue) {
    resetTimeOptions("Pick a date from the calendar");
    setAvailabilityStatus("Choose a date in the calendar to load available times.", "warning");
    return;
  }

  const hasDateAvailability = Boolean(availabilityByDate[dateValue]?.length);
  if (!hasDateAvailability) {
    resetTimeOptions("No availability on this date");
    setAvailabilityStatus("No availability is set for that date yet. Please choose another day.", "danger");
    return;
  }

  const startTimes = getAvailableStartTimes(dateValue, service);
  if (startTimes.length === 0) {
    resetTimeOptions("No fitting times for this service");
    setAvailabilityStatus(
      "This service does not fit into the remaining open time blocks on that date.",
      "danger"
    );
    return;
  }

  resetTimeOptions("Choose an available time");
  startTimes.forEach((startMinutes) => {
    const option = document.createElement("option");
    option.value = String(startMinutes);
    option.textContent = formatTimeLabel(startMinutes);
    timeSelect.appendChild(option);
  });

  timeSelect.disabled = false;

  const duration = formatDuration(getServiceDuration(service));
  setAvailabilityStatus(
    `${startTimes.length} time option${startTimes.length === 1 ? "" : "s"} open on ${formatLongDate(
      dateValue
    )} for ${service} (${duration}).`,
    "success"
  );
}

function consumeBookedSlots(dateValue, serviceName, startMinutes) {
  const intervalsNeeded = getIntervalsNeeded(serviceName);
  const consumed = new Set();

  for (let step = 0; step < intervalsNeeded; step += 1) {
    consumed.add(startMinutes + step * BUSINESS_SCHEDULE.intervalMinutes);
  }

  const remainingSlots = (availabilityByDate[dateValue] || []).filter((slot) => !consumed.has(slot));

  if (remainingSlots.length > 0) {
    availabilityByDate[dateValue] = remainingSlots;
  } else {
    delete availabilityByDate[dateValue];
  }
}

function initBookingSystem() {
  setDateConstraints();
  resetTimeOptions("Select a service and date first");
  setAvailabilityStatus("Pick a service and date to view available time options.");

  renderSlotPicker();
  renderAvailabilitySummary();
  renderBookingCalendar();

  managerToggle.addEventListener("click", () => {
    const isHidden = managerPanel.hidden;
    managerPanel.hidden = !isHidden;
    managerToggle.textContent = isHidden ? "Close Manager" : "Open Manager";
  });

  availabilityDateInput.addEventListener("change", () => {
    loadManagerDate(availabilityDateInput.value);
  });

  slotPicker.addEventListener("click", (event) => {
    const chip = event.target.closest(".slot-chip");
    if (!chip || chip.disabled) {
      return;
    }

    const minute = Number(chip.dataset.minute);
    if (managerSelectedSlots.has(minute)) {
      managerSelectedSlots.delete(minute);
    } else {
      managerSelectedSlots.add(minute);
    }

    updateSlotPickerState();
  });

  saveAvailabilityButton.addEventListener("click", () => {
    const dateValue = availabilityDateInput.value;
    if (!dateValue) {
      setManagerStatus("Choose a date before saving availability.", "warning");
      return;
    }

    const sortedSlots = Array.from(managerSelectedSlots).sort((a, b) => a - b);

    if (sortedSlots.length === 0) {
      delete availabilityByDate[dateValue];
      setManagerStatus("No times selected, so this date now has no availability.", "warning");
    } else {
      availabilityByDate[dateValue] = sortedSlots;
      setManagerStatus(
        `Saved ${sortedSlots.length} open time block${sortedSlots.length === 1 ? "" : "s"} for ${formatLongDate(
          dateValue
        )}.`,
        "success"
      );
    }

    persistAvailability();
    renderAvailabilitySummary();
    renderBookingCalendar();

    if (dateInput.value === dateValue) {
      formSuccess.style.display = "none";
      refreshAvailability();
    }
  });

  clearDateAvailabilityButton.addEventListener("click", () => {
    const dateValue = availabilityDateInput.value;
    if (!dateValue) {
      setManagerStatus("Select a date to clear.", "warning");
      return;
    }

    delete availabilityByDate[dateValue];
    managerSelectedSlots = new Set();
    updateSlotPickerState();
    persistAvailability();
    renderAvailabilitySummary();
    renderBookingCalendar();

    if (dateInput.value === dateValue) {
      clearBookingDateSelection();
    }

    setManagerStatus(`Cleared all availability on ${formatLongDate(dateValue)}.`, "warning");
  });

  calendarPrev.addEventListener("click", () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1);
    renderBookingCalendar();
  });

  calendarNext.addEventListener("click", () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1);
    renderBookingCalendar();
  });

  serviceSelect.addEventListener("change", () => {
    formSuccess.style.display = "none";
    refreshAvailability();
    renderBookingCalendar();
  });

  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(bookingForm);
    const name = formData.get("name")?.toString().trim();
    const phone = formData.get("phone")?.toString().trim();
    const email = formData.get("email")?.toString().trim();
    const service = formData.get("service")?.toString();
    const dateValue = formData.get("date")?.toString();
    const selectedTimeRaw = formData.get("time")?.toString();

    if (!name || !phone || !email || !service || !dateValue || !selectedTimeRaw) {
      alert("Please complete all required booking fields.");
      return;
    }

    const selectedTime = Number(selectedTimeRaw);
    const allowedTimes = getAvailableStartTimes(dateValue, service);

    if (!allowedTimes.includes(selectedTime)) {
      alert("That time is no longer available. Please choose a different slot.");
      refreshAvailability();
      renderBookingCalendar();
      return;
    }

    if (!bookingsByDate[dateValue]) {
      bookingsByDate[dateValue] = [];
    }

    bookingsByDate[dateValue].push({
      startMinutes: selectedTime,
      durationMinutes: getServiceDuration(service),
      service,
    });

    bookingsByDate[dateValue].sort((a, b) => a.startMinutes - b.startMinutes);
    consumeBookedSlots(dateValue, service, selectedTime);

    persistBookings();
    persistAvailability();

    if (availabilityDateInput.value === dateValue) {
      loadManagerDate(dateValue);
    }

    renderAvailabilitySummary();
    renderBookingCalendar();

    formSuccess.textContent = `Booked ${service} on ${formatLongDate(dateValue)} at ${formatTimeLabel(
      selectedTime
    )} in this demo.`;
    formSuccess.style.display = "block";

    bookingForm.reset();
    dateInput.value = "";
    selectedDateDisplay.value = "";
    resetTimeOptions("Select a service and date first");
    setAvailabilityStatus("Pick a service and date to view available time options.");

    formSuccess.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

// mobile nav
menuBtn.addEventListener("click", () => {
  navLinks.classList.toggle("mobile-open");
});

document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("mobile-open");
  });
});

// booking modal
openBookingButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    bookingModal.classList.add("active");
    bookingModal.setAttribute("aria-hidden", "false");
  });
});

function closeBookingModal() {
  bookingModal.classList.remove("active");
  bookingModal.setAttribute("aria-hidden", "true");
}

closeModal.addEventListener("click", closeBookingModal);

bookingModal.addEventListener("click", (event) => {
  if (event.target === bookingModal) {
    closeBookingModal();
  }
});

goToBooking.addEventListener("click", () => {
  closeBookingModal();
});

initBookingSystem();

// FAQ accordion
faqItems.forEach((item) => {
  const question = item.querySelector(".faq-question");

  question.addEventListener("click", () => {
    const isActive = item.classList.contains("active");

    faqItems.forEach((faq) => faq.classList.remove("active"));

    if (!isActive) {
      item.classList.add("active");
    }
  });
});
