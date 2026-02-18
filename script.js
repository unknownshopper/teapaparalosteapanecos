function normalizeText(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function ensureId(obj) {
  if (obj && (typeof obj.id === "string" || typeof obj.id === "number")) return obj;
  return { ...(obj || {}), id: (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`) };
}

function initCandidatesPage() {
  const grid = document.getElementById("candidatesGrid");
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll(".card"));
  const searchInput = document.getElementById("searchInput");
  const partyFilter = document.getElementById("partyFilter");
  const emptyState = document.getElementById("emptyState");

  const modal = document.getElementById("candModal");
  const form = document.getElementById("candForm");
  const cancelBtn = document.getElementById("candCancel");
  const cancelBtn2 = document.getElementById("candCancel2");
  const deleteBtn = document.getElementById("candDelete");
  const titleEl = document.getElementById("candModalTitle");
  const summaryInput = document.getElementById("candSummary");
  const backgroundInput = document.getElementById("candBackground");
  const flagsInput = document.getElementById("candFlags");
  const sourcesInput = document.getElementById("candSources");
  const notesInput = document.getElementById("candNotes");

  const storageKey = "teapa_candits";
  let store = {};
  let currentId = null;
  let currentCard = null;

  function safeLoadStore() {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? safeJsonParse(raw) : null;
      store = parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      store = {};
    }
  }

  function safeSaveStore() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(store));
    } catch {
      // ignore
    }
  }

  function linesToArray(text) {
    return (text || "")
      .toString()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function arrayToLines(arr) {
    return (Array.isArray(arr) ? arr : []).join("\n");
  }

  function candidateIdFromCard(card) {
    const title = card?.querySelector?.(".card-title")?.textContent || card?.getAttribute?.("data-name") || "";
    return normalizeText(title).replace(/\s+/g, "-");
  }

  function renderCandidateIntoCard(card, data) {
    if (!card || !data) return;
    const body = card.querySelector(".card-body");
    if (!body) return;

    const summaryP = body.querySelector(".card-section-title + p");
    if (summaryP) {
      summaryP.textContent = (data.summary || "").trim() || "(pendiente)";
      summaryP.classList.toggle("muted", !((data.summary || "").trim()));
    }

    const sections = Array.from(body.querySelectorAll(".card-section-title"));
    const getSection = (label) => sections.find((h) => normalizeText(h.textContent).includes(normalizeText(label)));

    const bgHeader = getSection("Antecedentes");
    const bgList = bgHeader ? bgHeader.nextElementSibling : null;
    if (bgList && bgList.tagName === "UL") {
      const items = linesToArray(data.background);
      bgList.replaceChildren();
      for (const it of items.length ? items : ["(pendiente)"]) {
        const li = document.createElement("li");
        li.textContent = it;
        bgList.appendChild(li);
      }
    }

    const flHeader = getSection("Señalamientos");
    const flList = flHeader ? flHeader.nextElementSibling : null;
    if (flList && flList.tagName === "UL") {
      const items = linesToArray(data.flags);
      flList.replaceChildren();
      for (const it of items.length ? items : ["(pendiente)"]) {
        const li = document.createElement("li");
        li.textContent = it;
        flList.appendChild(li);
      }
    }

    const srcHeader = getSection("Fuentes");
    const srcList = srcHeader ? srcHeader.nextElementSibling : null;
    if (srcList && srcList.tagName === "UL") {
      const items = linesToArray(data.sources);
      srcList.replaceChildren();
      for (const it of items.length ? items : ["(agrega enlaces aquí)"]) {
        const li = document.createElement("li");
        if (items.length) {
          const a = document.createElement("a");
          a.href = it;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = it;
          li.appendChild(a);
        } else {
          const a = document.createElement("a");
          a.href = "#";
          a.setAttribute("aria-disabled", "true");
          a.textContent = it;
          li.appendChild(a);
        }
        srcList.appendChild(li);
      }
    }

    const notesHeader = getSection("Notas internas");
    const notesP = notesHeader ? notesHeader.nextElementSibling : null;
    if (notesP && notesP.tagName === "P") {
      notesP.textContent = (data.notes || "").trim() || "(pendiente)";
      notesP.classList.toggle("muted", !((data.notes || "").trim()));
    }
  }

  function openEdit(card) {
    if (!modal || !form) return;
    safeLoadStore();
    currentCard = card;
    currentId = candidateIdFromCard(card);
    const name = card?.querySelector?.(".card-title")?.textContent || card?.getAttribute?.("data-name") || "";
    if (titleEl) titleEl.textContent = `Editar ficha: ${name}`;

    const existing = store[currentId] || {};
    if (summaryInput) summaryInput.value = (existing.summary || "").toString();
    if (backgroundInput) backgroundInput.value = arrayToLines(existing.background || []);
    if (flagsInput) flagsInput.value = arrayToLines(existing.flags || []);
    if (sourcesInput) sourcesInput.value = arrayToLines(existing.sources || []);
    if (notesInput) notesInput.value = (existing.notes || "").toString();

    if (deleteBtn) deleteBtn.hidden = !Boolean(store[currentId]);
    if (typeof modal.showModal === "function") modal.showModal();
    if (summaryInput) summaryInput.focus();
  }

  function closeModal() {
    if (!modal) return;
    if (typeof modal.close === "function") modal.close();
  }

  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  if (cancelBtn2) cancelBtn2.addEventListener("click", closeModal);

  if (deleteBtn) {
    deleteBtn.hidden = true;
    deleteBtn.addEventListener("click", () => {
      if (!currentId) return;
      safeLoadStore();
      delete store[currentId];
      safeSaveStore();
      closeModal();
      if (currentCard) {
        renderCandidateIntoCard(currentCard, {
          summary: "",
          background: [],
          flags: [],
          sources: [],
          notes: "",
        });
        applyFilters();
      }
    });
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!currentId || !currentCard) return;
      safeLoadStore();
      store[currentId] = {
        summary: (summaryInput?.value || "").toString(),
        background: linesToArray(backgroundInput?.value),
        flags: linesToArray(flagsInput?.value),
        sources: linesToArray(sourcesInput?.value),
        notes: (notesInput?.value || "").toString(),
      };
      safeSaveStore();
      renderCandidateIntoCard(currentCard, store[currentId]);
      closeModal();
      applyFilters();
    });
  }

  if (cards.length) {
    for (const card of cards) {
      card.addEventListener("dblclick", () => openEdit(card));
    }
  }

  safeLoadStore();
  for (const card of cards) {
    const id = candidateIdFromCard(card);
    if (store[id]) renderCandidateIntoCard(card, store[id]);
  }

  function applyFilters() {
    const q = normalizeText(searchInput?.value);
    const party = normalizeText(partyFilter?.value);

    let visibleCount = 0;

    for (const card of cards) {
      const name = normalizeText(card.getAttribute("data-name"));
      const tags = normalizeText(card.getAttribute("data-tags"));
      const cardParty = normalizeText(card.getAttribute("data-party"));
      const text = normalizeText(card.textContent);

      const matchesParty = !party || cardParty === party;
      const matchesQuery =
        !q || name.includes(q) || tags.includes(q) || text.includes(q);

      const visible = matchesParty && matchesQuery;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    }

    if (emptyState) {
      emptyState.hidden = visibleCount !== 0;
    }
  }

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (partyFilter) partyFilter.addEventListener("change", applyFilters);
  applyFilters();
}

document.addEventListener("DOMContentLoaded", () => {
  initCandidatesPage();
  initNetworkPage();
  initStaffPage();
  initStockPage();
  initStockTotsPage();
});

function fillSelect(selectEl, options, includeAllLabel) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.replaceChildren();

  const all = document.createElement("option");
  all.value = "";
  all.textContent = includeAllLabel || "Todos";
  selectEl.appendChild(all);

  for (const opt of options || []) {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    selectEl.appendChild(o);
  }

  selectEl.value = current;
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function initStaffPage() {
  const table = document.getElementById("staffTable");
  if (!table) return;

  const tbody = table.querySelector("tbody");
  const searchInput = document.getElementById("staffSearch");
  const roleSelect = document.getElementById("staffRole");
  const emptyState = document.getElementById("staffEmpty");

  const addToggleBtn = document.getElementById("staffAddToggle");
  const modal = document.getElementById("staffModal");
  const addForm = document.getElementById("staffAddForm");
  const addCancelBtn = document.getElementById("staffAddCancel");
  const addCancelBtn2 = document.getElementById("staffAddCancel2");
  const nameInput = document.getElementById("staffName");
  const roleInput = document.getElementById("staffRoleInput");
  const roleOtherField = document.getElementById("staffRoleOtherField");
  const roleOtherInput = document.getElementById("staffRoleOther");
  const phoneInput = document.getElementById("staffPhone");
  const addressInput = document.getElementById("staffAddress");
  const licenseInput = document.getElementById("staffLicense");
  const notesInput = document.getElementById("staffNotes");
  const deleteBtn = document.getElementById("staffDelete");

  const exportBtn = document.getElementById("staffExport");

  const defaultData = window.__STAFF_DEFAULT__ || { roles: [], people: [] };
  const storageKey = "teapa_ggm_staff";
  let data = structuredClone(defaultData);
  let editingId = null;

  function loadFromLocalStorage() {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    const next = safeJsonParse(raw);
    if (!next || !Array.isArray(next.people)) return false;
    data = structuredClone(next);
    return true;
  }

  function saveToLocalStorage() {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  function openModal() {
    if (!modal) return;
    if (typeof modal.showModal === "function") modal.showModal();
    if (nameInput) nameInput.focus();
    if (roleInput) {
      roleInput.dispatchEvent(new Event("change"));
    }
  }

  function setEditingMode(id) {
    editingId = id;
    const isEditing = Boolean(id);
    if (deleteBtn) deleteBtn.hidden = !isEditing;
  }

  function openEditModal(person) {
    const p = person || {};
    setEditingMode(p.id);

    if (nameInput) nameInput.value = p.name || "";
    if (phoneInput) phoneInput.value = p.phone || "";
    if (addressInput) addressInput.value = p.address || "";
    if (licenseInput) licenseInput.value = p.license || "no";
    if (notesInput) notesInput.value = p.notes || "";

    const role = (p.role || "").toString();
    const roleIsBase = ["Operativo", "Recomendado", "Observación"].some(
      (r) => normalizeText(r) === normalizeText(role)
    );
    if (roleInput) roleInput.value = roleIsBase ? role : "Otro";
    setOtherRoleVisible(!roleIsBase && Boolean(role));
    if (!roleIsBase && roleOtherInput) roleOtherInput.value = role;

    openModal();
  }

  function closeModal() {
    if (!modal) return;
    if (typeof modal.close === "function") modal.close();
  }

  // Init: prefer saved data
  try {
    loadFromLocalStorage();
  } catch {
    // ignore
  }

  data.people = Array.isArray(data.people) ? data.people.map(ensureId) : [];

  function filteredPeople() {
    const q = normalizeText(searchInput?.value);
    const r = (roleSelect?.value || "").toString();

    return (data.people || []).filter((p) => {
      const matchesRole = !r || p.role === r;
      const hay = normalizeText(
        `${p.name || ""} ${p.role || ""} ${p.phone || ""} ${p.address || ""} ${p.license || ""} ${p.notes || ""}`
      );
      const matchesQ = !q || hay.includes(q);
      return matchesRole && matchesQ;
    });
  }

  function render() {
    if (!tbody) return;
    const rows = filteredPeople();
    tbody.replaceChildren();

    for (const p of rows) {
      const tr = document.createElement("tr");
      tr.dataset.id = (p?.id || "").toString();
      const cells = [
        p.name || "",
        p.role || "",
        p.phone || "",
        p.address || "",
        p.license || "",
        p.notes || "",
      ];
      for (const value of cells) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    if (emptyState) emptyState.hidden = rows.length !== 0;
  }

  if (tbody) {
    tbody.addEventListener("dblclick", (e) => {
      const tr = e.target?.closest?.("tr");
      const id = tr?.dataset?.id;
      if (!id) return;
      const p = (data.people || []).find((x) => x?.id?.toString() === id);
      if (!p) return;
      openEditModal(p);
    });
  }

  fillSelect(roleSelect, data.roles || [], "Todos");
  // roleInput in modal is fixed list in HTML

  function normalizeRoleLabel(value) {
    const raw = (value || "").toString().trim().replace(/\s+/g, " ");
    if (!raw) return "";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function setOtherRoleVisible(visible) {
    if (roleOtherField) roleOtherField.hidden = !visible;
    if (visible && roleOtherInput) roleOtherInput.focus();
    if (!visible && roleOtherInput) roleOtherInput.value = "";
  }

  if (roleInput) {
    roleInput.addEventListener("change", () => {
      setOtherRoleVisible(normalizeText(roleInput.value) === "otro");
    });
    roleInput.dispatchEvent(new Event("change"));
  }

  if (modal) {
    modal.addEventListener("close", () => {
      setEditingMode(null);
      if (roleInput) roleInput.value = "Operativo";
      setOtherRoleVisible(false);
      if (nameInput) nameInput.value = "";
      if (phoneInput) phoneInput.value = "";
      if (addressInput) addressInput.value = "";
      if (licenseInput) licenseInput.value = "no";
      if (notesInput) notesInput.value = "";
    });
  }

  if (searchInput) searchInput.addEventListener("input", render);
  if (roleSelect) roleSelect.addEventListener("change", render);

  if (addToggleBtn) {
    addToggleBtn.addEventListener("click", () => {
      setEditingMode(null);
      openModal();
    });
  }
  if (addCancelBtn) addCancelBtn.addEventListener("click", closeModal);
  if (addCancelBtn2) addCancelBtn2.addEventListener("click", closeModal);

  if (addForm) {
    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = (nameInput?.value || "").trim();
      const roleKey = (roleInput?.value || "").trim();
      if (!name || !roleKey) return;

      let role = roleKey;
      const isOther = normalizeText(roleKey) === "otro";
      if (isOther) {
        role = normalizeRoleLabel(roleOtherInput?.value);
        if (!role) return;
      }

      data.roles = Array.isArray(data.roles) ? data.roles : [];
      const exists = data.roles.some((r) => normalizeText(r) === normalizeText(role));
      if (!exists && normalizeText(role) !== "otro") {
        data.roles.push(role);
        data.roles.sort((a, b) => a.localeCompare(b, "es"));
        fillSelect(roleSelect, data.roles || [], "Todos");
      }

      const phone = (phoneInput?.value || "").trim();
      const address = (addressInput?.value || "").trim();
      const license = (licenseInput?.value || "no").trim();
      const notes = (notesInput?.value || "").trim();

      data.people = Array.isArray(data.people) ? data.people : [];

      if (editingId) {
        const idx = data.people.findIndex((p) => p?.id === editingId);
        if (idx !== -1) {
          data.people[idx] = { ...data.people[idx], name, role, phone, address, license, notes };
        }
      } else {
        data.people.unshift(ensureId({ name, role, phone, address, license, notes }));
      }
      try {
        saveToLocalStorage();
      } catch {
        // ignore
      }

      if (nameInput) nameInput.value = "";
      if (roleInput) roleInput.value = "Operativo";
      setOtherRoleVisible(false);
      if (phoneInput) phoneInput.value = "";
      if (addressInput) addressInput.value = "";
      if (licenseInput) licenseInput.value = "no";
      if (notesInput) notesInput.value = "";
      closeModal();
      render();
    });
  }

  if (deleteBtn) {
    deleteBtn.hidden = true;
    deleteBtn.addEventListener("click", () => {
      if (!editingId) return;
      data.people = Array.isArray(data.people) ? data.people : [];
      const idx = data.people.findIndex((p) => p?.id === editingId);
      if (idx === -1) return;
      data.people.splice(idx, 1);
      try {
        saveToLocalStorage();
      } catch {
        // ignore
      }
      closeModal();
      render();
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => downloadJson("ggm-staff.json", data));
  }

  render();
}

function initStockPage() {
  const table = document.getElementById("stockTable");
  if (!table) return;

  const tbody = table.querySelector("tbody");
  const searchInput = document.getElementById("stockSearch");
  const originSelect = document.getElementById("stockOrigin");
  const categorySelect = document.getElementById("stockCategory");
  const emptyState = document.getElementById("stockEmpty");

  const addToggleBtn = document.getElementById("stockAddToggle");
  const modal = document.getElementById("stockModal");
  const addForm = document.getElementById("stockAddForm");
  const addCancelBtn = document.getElementById("stockAddCancel");
  const addCancelBtn2 = document.getElementById("stockAddCancel2");
  const categoryInput = document.getElementById("stockCategoryInput");
  const categoryOtherField = document.getElementById("stockCategoryOtherField");
  const categoryOtherInput = document.getElementById("stockCategoryOther");
  const originInput = document.getElementById("stockOriginInput");
  const quantityInput = document.getElementById("stockQuantity");
  const unitInput = document.getElementById("stockUnit");
  const sourceNameInput = document.getElementById("stockSourceName");
  const sourceContactInput = document.getElementById("stockSourceContact");
  const unitCostInput = document.getElementById("stockUnitCost");
  const totalInput = document.getElementById("stockTotal");
  const notesInput = document.getElementById("stockNotes");
  const deleteBtn = document.getElementById("stockDelete");

  const exportBtn = document.getElementById("stockExport");

  const defaultData = window.__STOCK_DEFAULT__ || {
    candidates: [],
    categories: [],
    inventory: [],
  };
  const storageKey = "teapa_ggm_stock";
  let data = structuredClone(defaultData);
  let editingId = null;

  function loadFromLocalStorage() {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    const next = safeJsonParse(raw);
    if (!next || !Array.isArray(next.inventory)) return false;
    data = structuredClone(next);
    return true;
  }

  function saveToLocalStorage() {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  function setPanelOpen(open) {
    // Backward compat: replaced by dialog modal
    if (!modal) return;
    if (open) {
      if (typeof modal.showModal === "function") modal.showModal();
      if (categoryInput) categoryInput.focus();
      updateUnitCostState();
      updateModalTotal();
    } else {
      if (typeof modal.close === "function") modal.close();
    }
  }

  function setEditingMode(id) {
    editingId = id;
    const isEditing = Boolean(id);
    if (deleteBtn) deleteBtn.hidden = !isEditing;
  }

  function openEditModal(item) {
    const s = item || {};
    setEditingMode(s.id);

    const cat = (s.category || "").toString();
    const catIsKnown = (data.categories || []).some((c) => normalizeText(c) === normalizeText(cat));
    if (categoryInput) categoryInput.value = catIsKnown ? cat : "Otro";
    setOtherCategoryVisible(!catIsKnown && Boolean(cat));
    if (!catIsKnown && categoryOtherInput) categoryOtherInput.value = cat;

    if (originInput) originInput.value = s.origin || "compra";
    if (quantityInput) quantityInput.value = (s.quantity ?? "").toString();
    if (unitInput) unitInput.value = s.unit || "pza";
    if (sourceNameInput) sourceNameInput.value = s.sourceName || "";
    if (sourceContactInput) sourceContactInput.value = s.sourceContact || "";
    if (unitCostInput) unitCostInput.value = (s.unitCost ?? 0).toString();
    if (notesInput) notesInput.value = s.notes || "";

    updateUnitCostState();
    updateModalTotal();
    setPanelOpen(true);
  }

  // Init: prefer saved data
  try {
    loadFromLocalStorage();
  } catch {
    // ignore
  }

  // Asegurar ids en inventario para edición/eliminación
  data.inventory = Array.isArray(data.inventory) ? data.inventory.map(ensureId) : [];

  // Migración: evitar confusión "Otros" (categoría) vs "Otro" (personalizada)
  if (Array.isArray(data.categories)) {
    data.categories = data.categories.map((c) => (normalizeText(c) === "otros" ? "Misceláneo" : c));
  }
  if (Array.isArray(data.inventory)) {
    data.inventory = data.inventory.map((s) => ({
      ...s,
      category: normalizeText(s.category) === "otros" ? "Misceláneo" : s.category,
    }));
  }

  try {
    saveToLocalStorage();
  } catch {
    // ignore
  }

  function computeTotal(s) {
    const qty = Number(s?.quantity);
    const unitCost = Number(s?.unitCost);
    if (!Number.isFinite(qty) || !Number.isFinite(unitCost)) return "";
    return qty * unitCost;
  }


  function filteredInventory() {
    const q = normalizeText(searchInput?.value);
    const origin = normalizeText(originSelect?.value);
    const cat = (categorySelect?.value || "").toString();

    return (data.inventory || []).filter((s) => {
      const matchesOrigin = !origin || normalizeText(s.origin) === origin;
      const matchesCategory = !cat || s.category === cat;
      const hay = normalizeText(
        `${s.category || ""} ${s.origin || ""} ${s.quantity || ""} ${s.unit || ""} ${s.sourceName || ""} ${s.sourceContact || ""} ${s.unitCost || ""} ${s.notes || ""}`
      );
      const matchesQ = !q || hay.includes(q);
      return matchesOrigin && matchesCategory && matchesQ;
    });
  }

  function render() {
    if (!tbody) return;
    const rows = filteredInventory();
    tbody.replaceChildren();

    for (const s of rows) {
      const tr = document.createElement("tr");
      tr.dataset.id = (s?.id || "").toString();
      const total = computeTotal(s);
      const cells = [
        s.category || "",
        s.origin || "",
        (s.quantity ?? "").toString(),
        s.unit || "",
        s.sourceName || "",
        s.sourceContact || "",
        (s.unitCost ?? "").toString(),
        total === "" ? "" : total.toString(),
        s.notes || "",
      ];
      for (const value of cells) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    if (emptyState) emptyState.hidden = rows.length !== 0;
  }

  fillSelect(categorySelect, data.categories || [], "Todos");
  fillSelect(categoryInput, data.categories || [], "Selecciona...");
  if (categoryInput) categoryInput.remove(0);

  function normalizeCategoryLabel(value) {
    const raw = (value || "").toString().trim().replace(/\s+/g, " ");
    if (!raw) return "";
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }

  function setOtherCategoryVisible(visible) {
    if (categoryOtherField) categoryOtherField.hidden = !visible;
    if (visible && categoryOtherInput) categoryOtherInput.focus();
    if (!visible && categoryOtherInput) categoryOtherInput.value = "";
  }

  if (categoryInput) {
    const hasOther = Array.from(categoryInput.options).some(
      (o) => normalizeText(o.value) === "otro"
    );
    if (!hasOther) {
      const otherOpt = document.createElement("option");
      otherOpt.value = "Otro";
      otherOpt.textContent = "Otro";
      categoryInput.appendChild(otherOpt);
    }

    categoryInput.addEventListener("change", () => {
      setOtherCategoryVisible(normalizeText(categoryInput.value) === "otro");
    });
    categoryInput.dispatchEvent(new Event("change"));
  }

  function defaultUnitForCategory(category) {
    const c = normalizeText(category);
    if (c.includes("gasolina")) return "lt";
    if (c.includes("agua") || c.includes("alimentos")) return "caja";
    if (c.includes("transporte")) return "viaje";
    if (c.includes("sonido")) return "servicio";
    if (c.includes("lona")) return "pza";
    if (c.includes("volante")) return "pza";
    if (c.includes("gorra")) return "pza";
    if (c.includes("camisa")) return "pza";
    return "pza";
  }

  function syncUnitDefault() {
    if (!unitInput || !categoryInput) return;
    const categoryKey = categoryInput.value;
    const isOther = normalizeText(categoryKey) === "otro";
    const cat = isOther ? "" : categoryKey;
    unitInput.value = defaultUnitForCategory(cat);
  }

  if (categoryInput) {
    categoryInput.addEventListener("change", syncUnitDefault);
  }
  syncUnitDefault();

  if (searchInput) searchInput.addEventListener("input", render);
  if (originSelect) originSelect.addEventListener("change", render);
  if (categorySelect) categorySelect.addEventListener("change", render);

  if (addToggleBtn) {
    addToggleBtn.addEventListener("click", () => {
      setEditingMode(null);
      setPanelOpen(true);
    });
  }
  if (addCancelBtn) addCancelBtn.addEventListener("click", () => setPanelOpen(false));
  if (addCancelBtn2) addCancelBtn2.addEventListener("click", () => setPanelOpen(false));

  if (originInput && unitCostInput) {
    originInput.addEventListener("change", () => {
      updateUnitCostState();
      updateModalTotal();
    });
    originInput.dispatchEvent(new Event("change"));
  }

  function updateUnitCostState() {
    if (!originInput || !unitCostInput) return;
    const origin = normalizeText(originInput.value);
    if (origin === "donacion") {
      if (!unitCostInput.value) unitCostInput.value = "0";
      unitCostInput.disabled = false;
      unitCostInput.readOnly = false;
    } else {
      unitCostInput.disabled = false;
      unitCostInput.readOnly = false;
    }
  }

  function updateModalTotal() {
    if (!totalInput) return;
    const qty = Number(quantityInput?.value);
    const unitCost = Number(unitCostInput?.value);
    if (!Number.isFinite(qty) || !Number.isFinite(unitCost)) {
      totalInput.value = "0";
      return;
    }
    totalInput.value = (qty * unitCost).toString();
  }

  if (quantityInput) {
    quantityInput.addEventListener("input", updateModalTotal);
    quantityInput.addEventListener("blur", updateModalTotal);
  }
  if (unitCostInput) {
    unitCostInput.addEventListener("input", updateModalTotal);
    unitCostInput.addEventListener("blur", updateModalTotal);
    unitCostInput.addEventListener("focus", () => {
      updateUnitCostState();
      updateModalTotal();
    });
  }

  if (addForm) {
    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const categoryKey = (categoryInput?.value || "").trim();
      const origin = (originInput?.value || "").trim();
      const quantity = Number(quantityInput?.value);
      const unit = (unitInput?.value || "").trim();

      if (!categoryKey || !origin || !unit || !Number.isFinite(quantity)) return;

      let category = categoryKey;
      const isOther = normalizeText(categoryKey) === "otro";
      if (isOther) {
        category = normalizeCategoryLabel(categoryOtherInput?.value);
        if (!category) return;
      }

      data.categories = Array.isArray(data.categories) ? data.categories : [];
      const exists = data.categories.some((c) => normalizeText(c) === normalizeText(category));
      if (!exists && normalizeText(category) !== "otro") {
        data.categories.push(category);
        data.categories.sort((a, b) => a.localeCompare(b, "es"));
        fillSelect(categorySelect, data.categories || [], "Todos");
      }

      const sourceName = (sourceNameInput?.value || "").trim();
      const sourceContact = (sourceContactInput?.value || "").trim();
      const unitCost = Number(unitCostInput?.value);
      const notes = (notesInput?.value || "").trim();

      data.inventory = Array.isArray(data.inventory) ? data.inventory : [];
      if (editingId) {
        const idx = data.inventory.findIndex((x) => x?.id === editingId);
        if (idx !== -1) {
          data.inventory[idx] = {
            ...data.inventory[idx],
            category,
            origin,
            quantity,
            unit,
            sourceName,
            sourceContact,
            unitCost: Number.isFinite(unitCost) ? unitCost : 0,
            notes,
          };
        }
      } else {
        data.inventory.unshift(
          ensureId({
            category,
            origin,
            quantity,
            unit,
            sourceName,
            sourceContact,
            unitCost: Number.isFinite(unitCost) ? unitCost : 0,
            notes,
          })
        );
      }
      try {
        saveToLocalStorage();
      } catch {
        // ignore
      }

      if (categoryInput) categoryInput.value = data.categories?.[0] || "";
      setOtherCategoryVisible(false);
      syncUnitDefault();
      if (quantityInput) quantityInput.value = "";
      if (unitInput) unitInput.value = "pza";
      if (sourceNameInput) sourceNameInput.value = "";
      if (sourceContactInput) sourceContactInput.value = "";
      if (unitCostInput) unitCostInput.value = "0";
      if (totalInput) totalInput.value = "";
      if (notesInput) notesInput.value = "";
      setPanelOpen(false);
      render();
    });
  }

  if (tbody) {
    tbody.addEventListener("dblclick", (e) => {
      const tr = e.target?.closest?.("tr");
      const id = tr?.dataset?.id;
      if (!id) return;
      const s = (data.inventory || []).find((x) => x?.id?.toString() === id);
      if (!s) return;
      openEditModal(s);
    });
  }

  if (deleteBtn) {
    deleteBtn.hidden = true;
    deleteBtn.addEventListener("click", () => {
      if (!editingId) return;
      data.inventory = Array.isArray(data.inventory) ? data.inventory : [];
      const idx = data.inventory.findIndex((x) => x?.id === editingId);
      if (idx === -1) return;
      data.inventory.splice(idx, 1);
      try {
        saveToLocalStorage();
      } catch {
        // ignore
      }
      setPanelOpen(false);
      render();
    });
  }

  if (modal) {
    modal.addEventListener("close", () => {
      setEditingMode(null);
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => downloadJson("ggm-stock.json", data));
  }

  render();
}

function safeJsonParse(text) {
  return JSON.parse(text);
}

function initStockTotsPage() {
  const totalsTable = document.getElementById("stockTotsTable");
  if (!totalsTable) return;

  const totalsTbody = totalsTable.querySelector("tbody");
  const totalsEmpty = document.getElementById("stockTotsEmpty");
  const searchInput = document.getElementById("stockTotsSearch");
  const exportBtn = document.getElementById("stockTotsExport");

  const outTable = document.getElementById("stockOutTable");
  const outTbody = outTable?.querySelector("tbody") || null;
  const outEmpty = document.getElementById("stockOutEmpty");

  const addToggleBtn = document.getElementById("stockOutAddToggle");
  const modal = document.getElementById("stockOutModal");
  const form = document.getElementById("stockOutForm");
  const cancelBtn = document.getElementById("stockOutCancel");
  const cancelBtn2 = document.getElementById("stockOutCancel2");
  const deleteBtn = document.getElementById("stockOutDelete");

  const typeInput = document.getElementById("stockOutType");
  const categoryField = document.getElementById("stockOutCategoryField");
  const categoryInput = document.getElementById("stockOutCategory");
  const categoryOtherField = document.getElementById("stockOutCategoryOtherField");
  const categoryOtherInput = document.getElementById("stockOutCategoryOther");
  const quantityField = document.getElementById("stockOutQuantityField");
  const quantityInput = document.getElementById("stockOutQuantity");
  const unitField = document.getElementById("stockOutUnitField");
  const unitInput = document.getElementById("stockOutUnit");
  const unitCostField = document.getElementById("stockOutUnitCostField");
  const unitCostInput = document.getElementById("stockOutUnitCost");
  const moneyField = document.getElementById("stockOutMoneyField");
  const moneyInput = document.getElementById("stockOutMoney");
  const destinationInput = document.getElementById("stockOutDestination");
  const notesInput = document.getElementById("stockOutNotes");

  const stockKey = "teapa_ggm_stock";
  const outKey = "teapa_ggm_stock_out";

  let stockData = { categories: [], inventory: [] };
  let outflows = [];
  let editingId = null;

  function loadStock() {
    const raw = localStorage.getItem(stockKey);
    const next = raw ? safeJsonParse(raw) : null;
    if (!next || !Array.isArray(next.inventory)) return;
    stockData = structuredClone(next);

    if (Array.isArray(stockData.categories)) {
      stockData.categories = stockData.categories.map((c) => (normalizeText(c) === "otros" ? "Misceláneo" : c));
    }
    if (Array.isArray(stockData.inventory)) {
      stockData.inventory = stockData.inventory.map((s) => ({
        ...s,
        category: normalizeText(s.category) === "otros" ? "Misceláneo" : s.category,
      }));
    }
  }

  function loadOutflows() {
    const raw = localStorage.getItem(outKey);
    const next = raw ? safeJsonParse(raw) : null;
    outflows = Array.isArray(next) ? structuredClone(next) : [];
    outflows = outflows.map(ensureId);
  }

  function saveOutflows() {
    localStorage.setItem(outKey, JSON.stringify(outflows));
  }

  function openModal() {
    if (!modal) return;
    if (typeof modal.showModal === "function") modal.showModal();
  }

  function closeModal() {
    if (!modal) return;
    if (typeof modal.close === "function") modal.close();
  }

  function setEditingMode(id) {
    editingId = id;
    if (deleteBtn) deleteBtn.hidden = !Boolean(id);
  }

  function setOtherCategoryVisible(visible) {
    if (categoryOtherField) categoryOtherField.hidden = !visible;
    if (!visible && categoryOtherInput) categoryOtherInput.value = "";
  }

  function syncCategoryOptions() {
    if (!categoryInput) return;
    const current = categoryInput.value;
    categoryInput.replaceChildren();
    for (const c of stockData.categories || []) {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      categoryInput.appendChild(o);
    }
    const hasOther = Array.from(categoryInput.options).some((o) => normalizeText(o.value) === "otro");
    if (!hasOther) {
      const o = document.createElement("option");
      o.value = "Otro";
      o.textContent = "Otro";
      categoryInput.appendChild(o);
    }
    if (current) categoryInput.value = current;
  }

  function syncTypeUI() {
    const t = normalizeText(typeInput?.value);
    const isMoney = t === "dinero";
    if (categoryField) categoryField.hidden = isMoney;
    if (quantityField) quantityField.hidden = isMoney;
    if (unitField) unitField.hidden = isMoney;
    if (unitCostField) unitCostField.hidden = isMoney;
    if (moneyField) moneyField.hidden = !isMoney;
    if (isMoney) setOtherCategoryVisible(false);
  }

  function computeTotals() {
    const map = new Map();

    for (const s of stockData.inventory || []) {
      const category = (s.category || "").toString();
      const unit = (s.unit || "pza").toString();
      const key = `${category}||${unit}`;
      const qty = Number(s.quantity);
      const unitCost = Number(s.unitCost);

      const row = map.get(key) || {
        category,
        unit,
        inQty: 0,
        outQty: 0,
        inValue: 0,
        outValue: 0,
      };

      if (Number.isFinite(qty)) row.inQty += qty;
      if (Number.isFinite(qty) && Number.isFinite(unitCost)) row.inValue += qty * unitCost;
      map.set(key, row);
    }

    let moneyOut = 0;
    for (const o of outflows || []) {
      const t = normalizeText(o.type);
      if (t === "dinero") {
        const m = Number(o.money);
        if (Number.isFinite(m)) moneyOut += m;
        continue;
      }

      const category = (o.category || "").toString();
      const unit = (o.unit || "pza").toString();
      const key = `${category}||${unit}`;
      const qty = Number(o.quantity);
      const unitCost = Number(o.unitCost);

      const row = map.get(key) || {
        category,
        unit,
        inQty: 0,
        outQty: 0,
        inValue: 0,
        outValue: 0,
      };

      if (Number.isFinite(qty)) row.outQty += qty;
      if (Number.isFinite(qty) && Number.isFinite(unitCost)) row.outValue += qty * unitCost;
      map.set(key, row);
    }

    const rows = Array.from(map.values()).map((r) => {
      const totalQty = r.inQty - r.outQty;
      const totalValue = r.inValue - r.outValue;
      return {
        ...r,
        totalQty,
        totalValue,
      };
    });

    rows.sort((a, b) => a.category.localeCompare(b.category, "es"));
    return { rows, moneyOut };
  }

  function renderTotals() {
    if (!totalsTbody) return;
    const q = normalizeText(searchInput?.value);
    const { rows, moneyOut } = computeTotals();

    const filtered = rows.filter((r) => {
      const hay = normalizeText(`${r.category} ${r.unit}`);
      return !q || hay.includes(q);
    });

    totalsTbody.replaceChildren();
    for (const r of filtered) {
      const tr = document.createElement("tr");
      const cells = [
        r.category,
        r.unit,
        r.inQty.toString(),
        r.outQty.toString(),
        r.totalQty.toString(),
        r.totalValue.toString(),
      ];
      for (const v of cells) {
        const td = document.createElement("td");
        td.textContent = v;
        tr.appendChild(td);
      }
      totalsTbody.appendChild(tr);
    }

    if (Number.isFinite(moneyOut) && moneyOut > 0) {
      const tr = document.createElement("tr");
      const cells = [
        "Dinero",
        "MXN",
        "0",
        moneyOut.toString(),
        (-moneyOut).toString(),
        (-moneyOut).toString(),
      ];
      for (const v of cells) {
        const td = document.createElement("td");
        td.textContent = v;
        tr.appendChild(td);
      }
      totalsTbody.appendChild(tr);
    }

    if (totalsEmpty) totalsEmpty.hidden = filtered.length !== 0 || moneyOut > 0;
  }

  function fmtDate(value) {
    try {
      const d = value ? new Date(value) : new Date();
      return d.toLocaleString("es-MX");
    } catch {
      return "";
    }
  }

  function renderOutflows() {
    if (!outTbody) return;
    outTbody.replaceChildren();
    const rows = Array.isArray(outflows) ? outflows.slice() : [];
    rows.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    for (const o of rows) {
      const tr = document.createElement("tr");
      tr.dataset.id = (o?.id || "").toString();
      const t = normalizeText(o.type) === "dinero" ? "Dinero" : "Artículo";
      const article = normalizeText(o.type) === "dinero" ? "Dinero" : (o.category || "");
      const qty = normalizeText(o.type) === "dinero" ? "" : (o.quantity ?? "").toString();
      const unit = normalizeText(o.type) === "dinero" ? "" : (o.unit || "");
      const money = normalizeText(o.type) === "dinero" ? (o.money ?? "").toString() : "";
      const cells = [
        fmtDate(o.date),
        t,
        article,
        qty,
        unit,
        money,
        o.destination || "",
        o.notes || "",
      ];
      for (const v of cells) {
        const td = document.createElement("td");
        td.textContent = v;
        tr.appendChild(td);
      }
      outTbody.appendChild(tr);
    }

    if (outEmpty) outEmpty.hidden = rows.length !== 0;
  }

  function openNewOutflow() {
    setEditingMode(null);
    if (typeInput) typeInput.value = "articulo";
    syncTypeUI();
    if (categoryInput) categoryInput.value = (stockData.categories || [])[0] || "Otro";
    setOtherCategoryVisible(normalizeText(categoryInput?.value) === "otro");
    if (quantityInput) quantityInput.value = "";
    if (unitInput) unitInput.value = "pza";
    if (unitCostInput) unitCostInput.value = "0";
    if (moneyInput) moneyInput.value = "0";
    if (destinationInput) destinationInput.value = "";
    if (notesInput) notesInput.value = "";
    openModal();
  }

  function openEditOutflow(o) {
    const item = o || {};
    setEditingMode(item.id);
    if (typeInput) typeInput.value = normalizeText(item.type) === "dinero" ? "dinero" : "articulo";
    syncTypeUI();

    const cat = (item.category || "").toString();
    const catIsKnown = (stockData.categories || []).some((c) => normalizeText(c) === normalizeText(cat));
    if (categoryInput) categoryInput.value = catIsKnown ? cat : "Otro";
    setOtherCategoryVisible(!catIsKnown && Boolean(cat));
    if (!catIsKnown && categoryOtherInput) categoryOtherInput.value = cat;

    if (quantityInput) quantityInput.value = (item.quantity ?? "").toString();
    if (unitInput) unitInput.value = item.unit || "pza";
    if (unitCostInput) unitCostInput.value = (item.unitCost ?? 0).toString();
    if (moneyInput) moneyInput.value = (item.money ?? 0).toString();
    if (destinationInput) destinationInput.value = item.destination || "";
    if (notesInput) notesInput.value = item.notes || "";
    openModal();
  }

  loadStock();
  loadOutflows();
  syncCategoryOptions();
  syncTypeUI();
  if (deleteBtn) deleteBtn.hidden = true;

  renderTotals();
  renderOutflows();

  if (searchInput) searchInput.addEventListener("input", renderTotals);

  if (typeInput) {
    typeInput.addEventListener("change", () => {
      syncTypeUI();
    });
  }

  if (categoryInput) {
    categoryInput.addEventListener("change", () => {
      setOtherCategoryVisible(normalizeText(categoryInput.value) === "otro");
    });
  }

  if (addToggleBtn) addToggleBtn.addEventListener("click", openNewOutflow);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  if (cancelBtn2) cancelBtn2.addEventListener("click", closeModal);

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const t = normalizeText(typeInput?.value);
      const destination = (destinationInput?.value || "").trim();
      const notes = (notesInput?.value || "").trim();
      if (!destination) return;

      if (t === "dinero") {
        const money = Number(moneyInput?.value);
        if (!Number.isFinite(money) || money <= 0) return;
        const payload = ensureId({
          id: editingId || undefined,
          type: "dinero",
          money,
          destination,
          notes,
          date: new Date().toISOString(),
        });

        if (editingId) {
          const idx = outflows.findIndex((x) => x?.id === editingId);
          if (idx !== -1) outflows[idx] = { ...outflows[idx], ...payload, id: editingId };
        } else {
          outflows.unshift(payload);
        }
      } else {
        const categoryKey = (categoryInput?.value || "").trim();
        if (!categoryKey) return;
        let category = categoryKey;
        if (normalizeText(categoryKey) === "otro") {
          category = (categoryOtherInput?.value || "").trim();
          if (!category) return;
        }
        const quantity = Number(quantityInput?.value);
        const unit = (unitInput?.value || "").trim();
        const unitCost = Number(unitCostInput?.value);
        if (!Number.isFinite(quantity) || quantity <= 0) return;
        if (!unit) return;
        const payload = ensureId({
          id: editingId || undefined,
          type: "articulo",
          category,
          quantity,
          unit,
          unitCost: Number.isFinite(unitCost) ? unitCost : 0,
          destination,
          notes,
          date: new Date().toISOString(),
        });

        if (editingId) {
          const idx = outflows.findIndex((x) => x?.id === editingId);
          if (idx !== -1) outflows[idx] = { ...outflows[idx], ...payload, id: editingId };
        } else {
          outflows.unshift(payload);
        }
      }

      try {
        saveOutflows();
      } catch {
        // ignore
      }
      closeModal();
      renderTotals();
      renderOutflows();
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      if (!editingId) return;
      const idx = outflows.findIndex((x) => x?.id === editingId);
      if (idx === -1) return;
      outflows.splice(idx, 1);
      try {
        saveOutflows();
      } catch {
        // ignore
      }
      closeModal();
      renderTotals();
      renderOutflows();
    });
  }

  if (outTbody) {
    outTbody.addEventListener("dblclick", (e) => {
      const tr = e.target?.closest?.("tr");
      const id = tr?.dataset?.id;
      if (!id) return;
      const o = outflows.find((x) => x?.id?.toString() === id);
      if (!o) return;
      openEditOutflow(o);
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      downloadJson("ggm-stock-totales.json", {
        stock: stockData,
        outflows,
      });
    });
  }
}

function getLinkTypeColor(type) {
  switch (type) {
    case "investigacion":
      return "rgba(99, 102, 241, 0.9)";
    case "senalamiento":
      return "rgba(239, 68, 68, 0.9)";
    case "alianza":
      return "rgba(34, 197, 94, 0.9)";
    case "negocio":
      return "rgba(245, 158, 11, 0.9)";
    case "asociacion":
    default:
      return "rgba(148, 163, 184, 0.85)";
  }
}

function getNodeColor(node) {
  const type = normalizeText(node?.type);
  if (type.includes("investigacion")) return "rgba(99, 102, 241, 0.85)";
  if (type.includes("contrato")) return "rgba(245, 158, 11, 0.85)";
  if (type.includes("persona")) return "rgba(148, 163, 184, 0.85)";

  const party = normalizeText(node?.party);
  if (party.includes("morena")) return "rgba(22, 163, 74, 0.9)";
  if (party.includes("pri")) return "rgba(239, 68, 68, 0.9)";

  return "rgba(226, 232, 240, 0.85)";
}

function initNetworkPage() {
  const canvas = document.getElementById("networkCanvas");
  if (!canvas) return;

  const jsonTextarea = document.getElementById("netJson");
  const applyJsonBtn = document.getElementById("applyJson");
  const resetViewBtn = document.getElementById("resetView");
  const searchInput = document.getElementById("netSearch");
  const linkTypeSelect = document.getElementById("netLinkType");
  const detail = document.getElementById("nodeDetail");

  const defaultData = window.__NETWORK_DEFAULT__ || { nodes: [], links: [] };
  if (jsonTextarea) {
    jsonTextarea.value = JSON.stringify(defaultData, null, 2);
  }

  let data = structuredClone(defaultData);
  let selectedNodeId = null;

  // --- D3 setup
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  const svg = d3
    .select(canvas)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const zoomLayer = svg.append("g");

  const zoom = d3
    .zoom()
    .scaleExtent([0.25, 3])
    .on("zoom", (event) => {
      zoomLayer.attr("transform", event.transform);
    });

  svg.call(zoom);

  const linkLayer = zoomLayer.append("g").attr("stroke-linecap", "round");
  const nodeLayer = zoomLayer.append("g");
  const labelLayer = zoomLayer.append("g");

  let simulation = null;

  function setDetailNode(node) {
    if (!detail) return;
    if (!node) {
      detail.textContent = "Selecciona un nodo…";
      return;
    }

    detail.replaceChildren();

    if (node.img) {
      const img = document.createElement("img");
      img.src = node.img;
      img.alt = node.label || node.id;
      img.loading = "lazy";
      img.style.width = "100%";
      img.style.maxHeight = "180px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "12px";
      img.style.border = "1px solid rgba(255,255,255,0.12)";
      img.style.marginBottom = "10px";
      detail.appendChild(img);
    }

    const pre = document.createElement("pre");
    pre.style.margin = "0";
    pre.style.whiteSpace = "pre-wrap";
    pre.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace";
    pre.style.fontSize = "12px";
    pre.style.lineHeight = "1.35";

    const lines = [];
    lines.push(`Nombre: ${node.label || node.id}`);
    if (node.type) lines.push(`Tipo: ${node.type}`);
    if (node.party) lines.push(`Partido: ${node.party}`);
    if (Array.isArray(node.tags) && node.tags.length) {
      lines.push(`Tags: ${node.tags.join(", ")}`);
    }
    if (node.notes) lines.push(`Notas: ${node.notes}`);

    pre.textContent = lines.join("\n");
    detail.appendChild(pre);
  }

  function currentFilters() {
    const q = normalizeText(searchInput?.value);
    const linkType = normalizeText(linkTypeSelect?.value);
    return { q, linkType };
  }

  function filteredGraph() {
    const { q, linkType } = currentFilters();
    const nodes = data.nodes.map((n) => ({ ...n }));

    const nodeMatches = new Set();
    if (!q) {
      for (const n of nodes) nodeMatches.add(n.id);
    } else {
      for (const n of nodes) {
        const hay = normalizeText(`${n.label || ""} ${n.id || ""} ${(n.tags || []).join(" ")}`);
        if (hay.includes(q)) nodeMatches.add(n.id);
      }
    }

    const links = data.links
      .filter((l) => {
        const matchesType = !linkType || normalizeText(l.type) === linkType;
        return matchesType;
      })
      .filter((l) => nodeMatches.has(l.source) || nodeMatches.has(l.target));

    // Keep nodes that are part of remaining links (or match query directly)
    const linkedIds = new Set();
    for (const l of links) {
      linkedIds.add(l.source);
      linkedIds.add(l.target);
    }

    const finalNodes = nodes.filter((n) => nodeMatches.has(n.id) && (linkedIds.size === 0 || linkedIds.has(n.id) || q));
    const finalNodeIds = new Set(finalNodes.map((n) => n.id));
    const finalLinks = links.filter((l) => finalNodeIds.has(l.source) && finalNodeIds.has(l.target));

    return { nodes: finalNodes, links: finalLinks };
  }

  function render() {
    const graph = filteredGraph();

    if (simulation) simulation.stop();

    // D3 link force expects objects for source/target; map ids.
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    const links = graph.links
      .map((l) => ({ ...l }))
      .filter((l) => nodeById.has(l.source) && nodeById.has(l.target))
      .map((l) => ({
        ...l,
        source: nodeById.get(l.source),
        target: nodeById.get(l.target),
      }));

    const nodes = graph.nodes.map((n) => ({ ...n }));

    // Links
    const linkSel = linkLayer.selectAll("line").data(links, (d) => `${d.source.id}->${d.target.id}:${d.type}:${d.label}`);
    linkSel.exit().remove();
    const linkEnter = linkSel
      .enter()
      .append("line")
      .attr("stroke-width", (d) => Math.max(1, Number(d.weight || 1)))
      .attr("stroke", (d) => getLinkTypeColor(normalizeText(d.type)))
      .attr("opacity", 0.9);

    const linksMerged = linkEnter.merge(linkSel);

    // Nodes
    const nodeSel = nodeLayer.selectAll("circle").data(nodes, (d) => d.id);
    nodeSel.exit().remove();
    const nodeEnter = nodeSel
      .enter()
      .append("circle")
      .attr("r", 10)
      .attr("fill", (d) => getNodeColor(d))
      .attr("stroke", "rgba(0,0,0,0.35)")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        selectedNodeId = d.id;
        setDetailNode(d);
        updateSelection();
        event.stopPropagation();
      });

    const nodesMerged = nodeEnter.merge(nodeSel);

    // Labels
    const labelSel = labelLayer.selectAll("text").data(nodes, (d) => d.id);
    labelSel.exit().remove();
    const labelEnter = labelSel
      .enter()
      .append("text")
      .text((d) => d.label || d.id)
      .attr("font-size", 11)
      .attr("fill", "rgba(231, 233, 238, 0.9)")
      .attr("paint-order", "stroke")
      .attr("stroke", "rgba(11, 16, 32, 0.85)")
      .attr("stroke-width", 4)
      .attr("stroke-linejoin", "round")
      .style("pointer-events", "none");

    const labelsMerged = labelEnter.merge(labelSel);

    function updateSelection() {
      nodesMerged.attr("stroke-width", (d) => (d.id === selectedNodeId ? 3 : 1));
      nodesMerged.attr("stroke", (d) => (d.id === selectedNodeId ? "rgba(231, 233, 238, 0.9)" : "rgba(0,0,0,0.35)"));
    }

    svg.on("click", () => {
      selectedNodeId = null;
      setDetailNode(null);
      updateSelection();
    });

    // Drag behavior
    function drag(sim) {
      function dragstarted(event, d) {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }
      function dragended(event, d) {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }

    // Simulation
    simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(80)
          .strength(0.8)
      )
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(18));

    nodesMerged.call(drag(simulation));

    simulation.on("tick", () => {
      linksMerged
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      nodesMerged.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      labelsMerged.attr("x", (d) => d.x + 14).attr("y", (d) => d.y + 4);
    });

    updateSelection();
  }

  function recenter() {
    svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity);
  }

  function applyJson() {
    if (!jsonTextarea) return;
    try {
      const next = safeJsonParse(jsonTextarea.value);
      if (!next || !Array.isArray(next.nodes) || !Array.isArray(next.links)) {
        throw new Error("El JSON debe tener { nodes: [], links: [] }.");
      }
      const idSet = new Set();
      for (const n of next.nodes) {
        if (!n.id) throw new Error("Todos los nodos requieren un id.");
        if (idSet.has(n.id)) throw new Error(`Id duplicado: ${n.id}`);
        idSet.add(n.id);
      }
      for (const l of next.links) {
        if (!l.source || !l.target) throw new Error("Todos los links requieren source y target (ids).");
      }

      data = structuredClone(next);
      selectedNodeId = null;
      setDetailNode(null);
      render();
    } catch (err) {
      alert(err?.message || "JSON inválido.");
    }
  }

  if (applyJsonBtn) applyJsonBtn.addEventListener("click", applyJson);
  if (resetViewBtn) resetViewBtn.addEventListener("click", recenter);
  if (searchInput) searchInput.addEventListener("input", render);
  if (linkTypeSelect) linkTypeSelect.addEventListener("change", render);

  render();
}
