import {
  todayISO,
  addDays,
  diffDays,
  upcomingTuesdays,
  harvestTuesdayGroups,
  plantDateForHarvest,
  plantMovedOffTuesday,
  isTuesday,
  nextOnTimeCycle,
  prettyDate,
  prettyDateLong,
  weekdayName,
} from "./dates.js";
import { PRODUCTION_CROPS, productionCrop, statusLabel } from "./crops.js";
import { createStore, newId } from "./store.js";

const store = createStore();
const today = todayISO();
const tuesdays = upcomingTuesdays(today, 8);
const harvestGroups = harvestTuesdayGroups(today, 8, 8);
const harvestChoices = [...harvestGroups.past, ...harvestGroups.upcoming];
const thisTuesday = tuesdays[0];

const els = {
  tabButtons: [...document.querySelectorAll("[data-tab-btn]")],
  dashboard: document.getElementById("panel-dashboard"),
  production: document.getElementById("panel-production"),
  testing: document.getElementById("panel-testing"),
  plantGrid: document.getElementById("plant-grid"),
  dashHero: document.getElementById("dash-hero"),
  dashStats: document.getElementById("dash-stats"),
  dashJobs: document.getElementById("dash-jobs"),
  dashPlants: document.getElementById("dash-plants"),
  harvestHero: document.getElementById("harvest-hero"),
  harvestList: document.getElementById("harvest-list"),
  productionTrays: document.getElementById("production-trays"),
  testingTrays: document.getElementById("testing-trays"),
  dialog: document.getElementById("tray-dialog"),
  form: document.getElementById("tray-form"),
  formTitle: document.getElementById("form-title"),
  formFields: document.getElementById("form-fields"),
  syncPill: document.getElementById("sync-pill"),
  authSlot: document.getElementById("auth-slot"),
  fileInput: document.getElementById("import-file"),
};

let state = { trays: [], user: null, mode: "local", syncReady: false };
let activeTab = "dashboard";
let editingId = null;

store.subscribe((next) => {
  state = next;
  render();
});

els.tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    activeTab = btn.dataset.tabBtn;
    render();
  });
});

document.getElementById("add-production").addEventListener("click", () => openForm("production"));
document.getElementById("add-testing").addEventListener("click", () => openForm("testing"));
document.getElementById("export-btn").addEventListener("click", exportBackup);
document.getElementById("import-btn").addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", importBackup);
document.getElementById("form-cancel").addEventListener("click", () => els.dialog.close());
els.form.addEventListener("submit", onSubmit);

document.addEventListener("click", (e) => {
  const goto = e.target.closest("[data-goto-tab]");
  if (goto) {
    activeTab = goto.dataset.gotoTab;
    render();
    window.scrollTo(0, 0);
    return;
  }
  const action = e.target.closest("[data-action]");
  if (!action) return;
  const id = action.dataset.id;
  const act = action.dataset.action;
  if (act === "edit") {
    const tray = state.trays.find((t) => t.id === id);
    if (tray) openForm(tray.tab, tray);
  } else if (act === "planted") updateStatus(id, "planted");
  else if (act === "harvested") updateStatus(id, "harvested");
  else if (act === "delivered") updateStatus(id, "delivered");
  else if (act === "stopped") updateStatus(id, "stopped");
  else if (act === "delete") {
    if (confirm("Remove this tray?")) store.remove(id);
  }
});

async function updateStatus(id, status) {
  const tray = state.trays.find((t) => t.id === id);
  if (!tray) return;
  await store.upsert({ ...tray, status });
}

function dueLine(tray) {
  if (tray.status === "delivered") return "Delivered.";
  if (tray.status === "stopped") return "Stopped — not for harvest.";
  if (tray.status === "harvested") {
    if (tray.tab === "production") return "Harvested. Deliver today if it is Tuesday.";
    return "Harvested.";
  }
  if (tray.status === "planned" && tray.plantOn === today) return "Plant today.";
  if (tray.status === "planned" && tray.plantOn > today) {
    const n = diffDays(today, tray.plantOn);
    return `Plant in ${n} day${n === 1 ? "" : "s"} (${prettyDate(tray.plantOn)}).`;
  }
  if (tray.status === "planned" && tray.plantOn < today) {
    return `Plant date was ${prettyDate(tray.plantOn)} — plant as soon as you can, or retarget a later Tuesday.`;
  }
  if (tray.harvestOn === today) return "Harvest today. Deliver today.";
  if (tray.harvestOn > today) {
    const n = diffDays(today, tray.harvestOn);
    return `Harvest in ${n} day${n === 1 ? "" : "s"} (${prettyDate(tray.harvestOn)}).`;
  }
  if (tray.status === "planted" || tray.status === "planned") {
    return `Harvest window was ${prettyDate(tray.harvestOn)} — missed. Mark harvested if you cut late, or stop the tray.`;
  }
  return `Harvest date was ${prettyDate(tray.harvestOn)}.`;
}

function windowFlags(tray) {
  const flags = [];
  const crop = productionCrop(tray.cropId);
  if (crop) {
    const onTime = plantDateForHarvest(tray.harvestOn, crop.daysToHarvest);
    if (tray.plantOn > onTime) flags.push("Planted late");
    else if (tray.plantOn < onTime) flags.push("Planted early");
  }
  if (tray.harvestOn < today && (tray.status === "planned" || tray.status === "planted")) {
    flags.push("Missed harvest window");
  }
  return flags;
}

function trayCard(tray) {
  const crop = productionCrop(tray.cropId);
  const tone = crop?.tone ?? "leaf";
  const due = dueLine(tray);
  const flags = windowFlags(tray);
  const missed = due.includes("missed");
  const dueClass = missed
    ? "missed"
    : due.includes("today") || due.startsWith("Plant today") || due.startsWith("Harvest today")
      ? "today"
      : "";
  return `
    <article class="card tray ${tone}">
      <header>
        <div>
          <h3 class="crop">${escapeHtml(tray.variety)}</h3>
          <p class="variety">${tray.tab === "production" ? "Tuesday restaurant tray" : "Test grow"}</p>
        </div>
        <span class="status ${tray.status}">${statusLabel(tray.status)}</span>
      </header>
      <p class="meta">Plant ${prettyDate(tray.plantOn)} · Harvest ${prettyDate(tray.harvestOn)}</p>
      ${flags.length ? `<p class="flags">${flags.join(" · ")}</p>` : ""}
      <p class="due ${dueClass}">${due}</p>
      ${tray.notes ? `<p class="notes">${escapeHtml(tray.notes)}</p>` : ""}
      <div class="row-actions">
        ${tray.status === "planned" ? `<button class="btn" data-action="planted" data-id="${tray.id}">Mark planted</button>` : ""}
        ${tray.status === "planted" ? `<button class="btn" data-action="harvested" data-id="${tray.id}">Mark harvested</button>` : ""}
        ${tray.status === "harvested" && tray.tab === "production" ? `<button class="btn" data-action="delivered" data-id="${tray.id}">Mark delivered</button>` : ""}
        ${tray.status !== "stopped" && tray.status !== "delivered" ? `<button class="btn ghost" data-action="stopped" data-id="${tray.id}">Stop tray</button>` : ""}
        <button class="btn ghost" data-action="edit" data-id="${tray.id}">Edit</button>
        <button class="btn danger" data-action="delete" data-id="${tray.id}">Remove</button>
      </div>
    </article>
  `;
}

function plantCardsHtml() {
  return PRODUCTION_CROPS.map((crop) => {
    const cycle = nextOnTimeCycle(crop.daysToHarvest, today, tuesdays);
    const daysOut = diffDays(today, cycle.plant);
    const when =
      daysOut === 0
        ? "Plant today"
        : daysOut === 1
          ? "Plant tomorrow"
          : `Plant ${weekdayName(cycle.plant)}`;
    return `
      <article class="card ${crop.tone}">
        <h3 class="crop">${crop.name}</h3>
        <p class="variety">${crop.variety} · ${crop.daysToHarvest} days to harvest · never plant Tuesday</p>
        <p class="plant-date">${when}: <strong>${prettyDate(cycle.plant)}</strong></p>
        <p class="meta">Ready to cut ${prettyDateLong(cycle.harvest)}</p>
        <p class="meta">${crop.note}</p>
      </article>
    `;
  }).join("");
}

function renderPlantNext() {
  els.plantGrid.innerHTML = plantCardsHtml();
}

function activeTrays(tab) {
  return state.trays.filter((t) => t.tab === tab && t.status !== "stopped");
}

function renderDashboard() {
  const daysOut = diffDays(today, thisTuesday);
  const when =
    daysOut === 0
      ? "Harvest and deliver today."
      : daysOut === 1
        ? "Harvest and deliver tomorrow."
        : `${daysOut} days until harvest Tuesday.`;
  els.dashHero.innerHTML = `
    <div>
      <p class="kicker">Dashboard</p>
      <h2>${prettyDateLong(thisTuesday)}</h2>
      <p class="sub">${when} Cut in the morning, drop off the same day.</p>
    </div>
  `;

  const prod = activeTrays("production");
  const test = activeTrays("testing").filter((t) => t.status !== "harvested");
  const growing = prod.filter((t) => t.status === "planted");
  const plantToday = prod.filter((t) => t.status === "planned" && t.plantOn <= today);
  const plantSoon = prod.filter((t) => t.status === "planned" && t.plantOn > today && diffDays(today, t.plantOn) <= 2);
  const cutTue = prod.filter((t) => t.harvestOn === thisTuesday && (t.status === "planted" || t.status === "planned" || t.status === "harvested"));
  const missed = prod.filter((t) => (t.status === "planned" || t.status === "planted") && t.harvestOn < today);
  const harvested = prod.filter((t) => t.status === "harvested");

  els.dashStats.innerHTML = [
    ["Growing", growing.length, "In the trays now"],
    ["Plant now", plantToday.length, "Missed or due today"],
    ["Cut this Tuesday", cutTue.length, prettyDate(thisTuesday)],
    ["Testing", test.length, "Trial greens"],
    ["Missed windows", missed.length, "Need a decision"],
    ["Harvested, not delivered", harvested.length, "Still in the cooler"],
  ].map(([label, n, hint]) => `
    <article class="stat-card ${Number(n) && (label === "Missed windows" || label === "Plant now") ? "alert" : ""}">
      <p class="stat-n">${n}</p>
      <p class="stat-label">${label}</p>
      <p class="stat-hint">${hint}</p>
    </article>
  `).join("");

  const jobs = [];
  if (daysOut === 0) {
    jobs.push({
      title: "Harvest and deliver today",
      body: cutTue.length
        ? `${cutTue.length} production tray${cutTue.length === 1 ? "" : "s"} aimed at this Tuesday.`
        : "No trays are aimed at today. Add a backdated tray if you still cut something.",
      tab: "production",
    });
  }
  if (plantToday.length) {
    jobs.push({
      title: "Plant these trays",
      body: plantToday.map((t) => t.variety).join(", "),
      tab: "production",
    });
  }
  if (plantSoon.length) {
    jobs.push({
      title: "Plant in the next two days",
      body: plantSoon.map((t) => `${t.variety} on ${prettyDate(t.plantOn)}`).join(" · "),
      tab: "production",
    });
  }
  if (missed.length) {
    jobs.push({
      title: "Missed harvest windows",
      body: "Log a late cut, retarget a later Tuesday, or stop the tray.",
      tab: "production",
    });
  }
  if (test.length) {
    jobs.push({
      title: "Testing greens in progress",
      body: test.map((t) => `${t.variety} · harvest ${prettyDate(t.harvestOn)}`).join(" · "),
      tab: "testing",
    });
  }
  if (!jobs.length) {
    jobs.push({
      title: "No jobs yet",
      body: "Add a production tray or a test tray and this board will tell you what to do today.",
      tab: "production",
    });
  }

  els.dashJobs.innerHTML = jobs.map((job) => `
    <article class="card job-card">
      <h3 class="crop">${escapeHtml(job.title)}</h3>
      <p class="meta">${escapeHtml(job.body)}</p>
      <div class="row-actions">
        <button class="btn" type="button" data-goto-tab="${job.tab}">Open board</button>
      </div>
    </article>
  `).join("");

  els.dashPlants.innerHTML = plantCardsHtml();
}

function renderHero() {
  const harvestToday = thisTuesday === today;
  els.harvestHero.innerHTML = `
    <div>
      <p class="kicker">${harvestToday ? "Today" : "Next harvest day"}</p>
      <h2>${prettyDateLong(thisTuesday)}</h2>
      <p class="sub">Harvest in the morning. Deliver to the restaurant the same day.</p>
    </div>
  `;
  const due = state.trays.filter(
    (t) => t.tab === "production" && t.harvestOn === thisTuesday && t.status !== "stopped"
  );
  els.harvestList.innerHTML = due.length
    ? `<div class="tray-grid">${due.map(trayCard).join("")}</div>`
    : `<div class="empty">No production trays aimed at this Tuesday yet. Add a tray and the plant date will fill in.</div>`;
}

function renderTrays() {
  const prod = state.trays.filter((t) => t.tab === "production");
  const test = state.trays.filter((t) => t.tab === "testing");
  els.productionTrays.innerHTML = prod.length
    ? prod.map(trayCard).join("")
    : `<div class="empty">No production trays yet. Track each nasturtium, amaranth, and cilantro tray here.</div>`;
  els.testingTrays.innerHTML = test.length
    ? test.map(trayCard).join("")
    : `<div class="empty">Use this tab for trial greens you may distribute later. They are not locked to Tuesday.</div>`;
}

function renderAuth() {
  if (state.mode === "cloud") {
    els.syncPill.textContent = `Synced · ${state.user?.email ?? "signed in"}`;
    els.syncPill.className = "sync-pill cloud";
    els.authSlot.innerHTML = `
      <span class="userchip">
        ${state.user?.photo ? `<img src="${state.user.photo}" alt="">` : ""}
        ${escapeHtml(state.user?.name || state.user?.email || "")}
      </span>
      <button class="btn ghost" type="button" id="sign-out">Sign out</button>
    `;
    document.getElementById("sign-out").addEventListener("click", () => store.signOut());
  } else if (state.syncReady) {
    els.syncPill.textContent = "Cloud ready · sign in to share with Rebecca";
    els.syncPill.className = "sync-pill warn";
    els.authSlot.innerHTML = `<button class="btn" type="button" id="sign-in">Sign in with Google</button>`;
    document.getElementById("sign-in").addEventListener("click", () =>
      store.signIn().catch((err) => alert(err.message))
    );
  } else {
    els.syncPill.textContent = "On this device · add Firebase to sync";
    els.syncPill.className = "sync-pill";
    els.authSlot.innerHTML = "";
  }
}

function render() {
  els.tabButtons.forEach((btn) => {
    btn.setAttribute("aria-selected", String(btn.dataset.tabBtn === activeTab));
  });
  els.dashboard.hidden = activeTab !== "dashboard";
  els.production.hidden = activeTab !== "production";
  els.testing.hidden = activeTab !== "testing";
  renderDashboard();
  renderPlantNext();
  renderHero();
  renderTrays();
  renderAuth();
}

function harvestOptionGroups(selected) {
  const extra = selected && !harvestChoices.includes(selected)
    ? `<option value="${selected}" selected>${prettyDateLong(selected)}</option>`
    : "";
  const pastOpts = harvestGroups.past
    .map((d) => `<option value="${d}" ${d === selected ? "selected" : ""}>${prettyDate(d)} — past</option>`)
    .join("");
  const upcomingOpts = harvestGroups.upcoming
    .map((d) => {
      const tag = d === today ? " — today" : d === thisTuesday ? " — next" : "";
      return `<option value="${d}" ${d === selected ? "selected" : ""}>${prettyDateLong(d)}${tag}</option>`;
    })
    .join("");
  return `
    ${extra}
    <optgroup label="Past Tuesdays (missed windows)">${pastOpts}</optgroup>
    <optgroup label="Upcoming Tuesdays">${upcomingOpts}</optgroup>
  `;
}

function openForm(tab, tray = null) {
  editingId = tray?.id ?? null;
  els.formTitle.textContent = tray ? "Edit tray" : tab === "production" ? "Add production tray" : "Add test tray";
  if (tab === "production") {
    const cropId = tray?.cropId ?? "nasturtium";
    const crop = productionCrop(cropId);
    const harvest = tray?.harvestOn ?? nextOnTimeCycle(crop.daysToHarvest, today, tuesdays).harvest;
    const plantOn = tray?.plantOn ?? plantDateForHarvest(harvest, crop.daysToHarvest);
    const alreadyPlanted = Boolean(tray?.status && tray.status !== "planned") || (!tray && plantOn < today);
    const alreadyHarvested = tray?.status === "harvested" || tray?.status === "delivered";
    els.formFields.innerHTML = `
      <input type="hidden" name="tab" value="production">
      <label>Crop
        <select name="cropId" id="field-crop">
          ${PRODUCTION_CROPS.map((c) => `<option value="${c.id}" ${c.id === cropId ? "selected" : ""}>${c.name} — ${c.variety}</option>`).join("")}
        </select>
      </label>
      <label>Harvest Tuesday
        <select name="harvestOn" id="field-harvest">
          ${harvestOptionGroups(harvest)}
        </select>
      </label>
      <p class="hint">Pick a past Tuesday if you missed the harvest window. Harvest and delivery stay on Tuesday — we do not schedule planting on Tuesday.</p>
      <label>Planted on
        <input name="plantOn" id="field-plant" type="date" required value="${plantOn}">
      </label>
      <p class="hint">Past dates are OK if you missed the plant window. If the count lands on a Tuesday, the board moves planting to Monday.</p>
      <p class="computed" id="plant-preview"></p>
      <label class="check"><input type="checkbox" name="alreadyPlanted" id="field-planted" ${alreadyPlanted ? "checked" : ""}> I already planted this tray</label>
      <label class="check"><input type="checkbox" name="alreadyHarvested" id="field-harvested" ${alreadyHarvested ? "checked" : ""}> I already harvested this tray (including a late or missed cut)</label>
      <label>Notes
        <textarea name="notes">${escapeHtml(tray?.notes ?? "")}</textarea>
      </label>
    `;
    const cropEl = document.getElementById("field-crop");
    const harvestEl = document.getElementById("field-harvest");
    const plantEl = document.getElementById("field-plant");
    let suggestedPlant = plantDateForHarvest(harvest, crop.daysToHarvest);
    const updatePreview = () => {
      const c = productionCrop(cropEl.value);
      const h = harvestEl.value;
      const planted = plantEl.value;
      const onTime = plantDateForHarvest(h, c.daysToHarvest);
      const notes = [];
      if (!planted || !h) return;
      if (planted === onTime) {
        notes.push(`On-time plant for ${c.daysToHarvest} days: ${prettyDateLong(planted)} (${weekdayName(planted)}).`);
        if (plantMovedOffTuesday(h, c.daysToHarvest)) {
          notes.push("Exact count would have been a Tuesday, so planting moved to Monday. Harvest and delivery stay Tuesday.");
        }
      } else if (planted > onTime) {
        const n = diffDays(onTime, planted);
        notes.push(`Planted ${n} day${n === 1 ? "" : "s"} late. On-time was ${prettyDate(onTime)}. Leaves may be smaller by ${prettyDate(h)}.`);
      } else {
        const n = diffDays(planted, onTime);
        notes.push(`Planted ${n} day${n === 1 ? "" : "s"} early. On-time was ${prettyDate(onTime)}.`);
      }
      if (isTuesday(planted)) notes.push("Tuesday is harvest and delivery day. Plant Monday instead if you can.");
      if (h < today) notes.push("This harvest Tuesday is already past. Save to record a missed window, or pick a later Tuesday.");
      else if (h === today) notes.push("Harvest and deliver today.");
      const preview = document.getElementById("plant-preview");
      preview.textContent = notes.join(" ");
      preview.className = h < today || planted > onTime || isTuesday(planted) ? "computed warn" : "computed";
    };
    const fillOnTimePlant = () => {
      const c = productionCrop(cropEl.value);
      const nextSuggested = plantDateForHarvest(harvestEl.value, c.daysToHarvest);
      if (plantEl.value === suggestedPlant || !plantEl.value) plantEl.value = nextSuggested;
      suggestedPlant = nextSuggested;
      if (plantEl.value < today) document.getElementById("field-planted").checked = true;
      updatePreview();
    };
    cropEl.addEventListener("change", fillOnTimePlant);
    harvestEl.addEventListener("change", fillOnTimePlant);
    plantEl.addEventListener("change", updatePreview);
    updatePreview();
  } else {
    const plantOn = tray?.plantOn ?? today;
    const dth = tray?.daysToHarvest ?? 14;
    els.formFields.innerHTML = `
      <input type="hidden" name="tab" value="testing">
      <label>Variety
        <input name="variety" required value="${escapeHtml(tray?.variety ?? "")}" placeholder="e.g. Triton Purple radish">
      </label>
      <label>Days to harvest
        <input name="daysToHarvest" type="number" min="4" max="40" required value="${dth}">
      </label>
      <label>Planted on
        <input name="plantOn" type="date" required value="${plantOn}">
      </label>
      <p class="hint">Past dates are OK if you are logging a test tray after it was planted.</p>
      <p class="computed" id="test-preview"></p>
      <label>Notes
        <textarea name="notes">${escapeHtml(tray?.notes ?? "")}</textarea>
      </label>
    `;
    const updatePreview = () => {
      const days = Number(els.form.daysToHarvest.value || 0);
      const plant = els.form.plantOn.value;
      if (!plant || !days) return;
      const harvest = addDays(plant, days);
      document.getElementById("test-preview").textContent =
        `Expected harvest ${prettyDateLong(harvest)} (${weekdayName(harvest)}). Not locked to Tuesday.`;
    };
    els.form.daysToHarvest.addEventListener("input", updatePreview);
    els.form.plantOn.addEventListener("change", updatePreview);
    updatePreview();
  }
  els.dialog.showModal();
}

async function onSubmit(e) {
  e.preventDefault();
  const data = new FormData(els.form);
  const tab = data.get("tab");
  let tray;
  if (tab === "production") {
    const crop = productionCrop(data.get("cropId"));
    const harvestOn = data.get("harvestOn");
    const plantOn = data.get("plantOn");
    const alreadyHarvested = data.get("alreadyHarvested") === "on";
    const alreadyPlanted = alreadyHarvested || data.get("alreadyPlanted") === "on";
    tray = {
      id: editingId ?? newId(),
      tab: "production",
      cropId: crop.id,
      variety: `${crop.name} — ${crop.variety}`,
      daysToHarvest: crop.daysToHarvest,
      plantOn,
      harvestOn,
      status: alreadyHarvested ? "harvested" : alreadyPlanted ? "planted" : "planned",
      notes: String(data.get("notes") || "").trim(),
      createdAt: Date.now(),
    };
  } else {
    const plantOn = data.get("plantOn");
    const daysToHarvest = Number(data.get("daysToHarvest"));
    tray = {
      id: editingId ?? newId(),
      tab: "testing",
      cropId: "custom",
      variety: String(data.get("variety") || "").trim(),
      daysToHarvest,
      plantOn,
      harvestOn: addDays(plantOn, daysToHarvest),
      status: plantOn <= today ? "planted" : "planned",
      notes: String(data.get("notes") || "").trim(),
      createdAt: Date.now(),
    };
  }
  if (editingId) {
    const prev = state.trays.find((t) => t.id === editingId);
    if (prev) {
      tray.createdAt = prev.createdAt;
      if (tab === "production" && data.get("alreadyHarvested") !== "on" && data.get("alreadyPlanted") !== "on") {
        tray.status = prev.status;
      }
    }
  }
  await store.upsert(tray);
  els.dialog.close();
}

function exportBackup() {
  const blob = new Blob([store.exportJson()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gold-leaf-harvest-trays-${today}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importBackup(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    await store.importJson(await file.text());
  } catch (err) {
    alert(`Could not import: ${err.message}`);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

render();
