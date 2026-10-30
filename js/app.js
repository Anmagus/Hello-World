import {
  todayISO,
  addDays,
  diffDays,
  upcomingTuesdays,
  plantDateForHarvest,
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
const thisTuesday = tuesdays[0];

const els = {
  tabButtons: [...document.querySelectorAll("[data-tab-btn]")],
  production: document.getElementById("panel-production"),
  testing: document.getElementById("panel-testing"),
  plantGrid: document.getElementById("plant-grid"),
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
let activeTab = "production";
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
  return `Harvest date was ${prettyDate(tray.harvestOn)}.`;
}

function trayCard(tray) {
  const crop = productionCrop(tray.cropId);
  const tone = crop?.tone ?? "leaf";
  const due = dueLine(tray);
  const dueClass = due.includes("today") || due.startsWith("Plant today") || due.startsWith("Harvest today") ? "today" : "";
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

function renderPlantNext() {
  els.plantGrid.innerHTML = PRODUCTION_CROPS.map((crop) => {
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
        <p class="variety">${crop.variety} · ${crop.daysToHarvest} days to harvest</p>
        <p class="plant-date">${when}: <strong>${prettyDate(cycle.plant)}</strong></p>
        <p class="meta">Ready to cut ${prettyDateLong(cycle.harvest)}</p>
        <p class="meta">${crop.note}</p>
      </article>
    `;
  }).join("");
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
  els.production.hidden = activeTab !== "production";
  els.testing.hidden = activeTab !== "testing";
  renderPlantNext();
  renderHero();
  renderTrays();
  renderAuth();
}

function openForm(tab, tray = null) {
  editingId = tray?.id ?? null;
  els.formTitle.textContent = tray ? "Edit tray" : tab === "production" ? "Add production tray" : "Add test tray";
  if (tab === "production") {
    const cropId = tray?.cropId ?? "nasturtium";
    const crop = productionCrop(cropId);
    const harvest = tray?.harvestOn ?? nextOnTimeCycle(crop.daysToHarvest, today, tuesdays).harvest;
    els.formFields.innerHTML = `
      <input type="hidden" name="tab" value="production">
      <label>Crop
        <select name="cropId" id="field-crop">
          ${PRODUCTION_CROPS.map((c) => `<option value="${c.id}" ${c.id === cropId ? "selected" : ""}>${c.name} — ${c.variety}</option>`).join("")}
        </select>
      </label>
      <label>Harvest Tuesday
        <select name="harvestOn" id="field-harvest">
          ${tuesdays.map((d) => `<option value="${d}" ${d === harvest ? "selected" : ""}>${prettyDateLong(d)}</option>`).join("")}
        </select>
      </label>
      <p class="computed" id="plant-preview"></p>
      <label class="check"><input type="checkbox" name="alreadyPlanted" ${tray?.status && tray.status !== "planned" ? "checked" : ""}> I already planted this tray</label>
      <label>Notes
        <textarea name="notes">${escapeHtml(tray?.notes ?? "")}</textarea>
      </label>
    `;
    const updatePreview = () => {
      const c = productionCrop(document.getElementById("field-crop").value);
      const h = document.getElementById("field-harvest").value;
      const plant = plantDateForHarvest(h, c.daysToHarvest);
      document.getElementById("plant-preview").textContent =
        `Plant on ${prettyDateLong(plant)} (${weekdayName(plant)}) so it is ready ${prettyDateLong(h)}. ${c.note}`;
    };
    document.getElementById("field-crop").addEventListener("change", updatePreview);
    document.getElementById("field-harvest").addEventListener("change", updatePreview);
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
    const plantOn = plantDateForHarvest(harvestOn, crop.daysToHarvest);
    const already = data.get("alreadyPlanted") === "on";
    tray = {
      id: editingId ?? newId(),
      tab: "production",
      cropId: crop.id,
      variety: `${crop.name} — ${crop.variety}`,
      daysToHarvest: crop.daysToHarvest,
      plantOn,
      harvestOn,
      status: already ? "planted" : "planned",
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
      if (tab === "production" && data.get("alreadyPlanted") !== "on") tray.status = prev.status;
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
