/* Daily Stock Movement UI */
(function (global) {
  "use strict";
  const $ = id => document.getElementById(id);
  const DB = global.DB;
  const M = global.Movement;
  let page = 1;
  let detailId = null;
  let modal, detailModal;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }
  function fmt(value) {
    return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  function dateText(value) {
    if (!value) return "-";
    const d = new Date(value + "T00:00:00");
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  function notify(message, icon = "info") {
    if (global.Swal) Swal.fire({ toast: true, position: "top-end", icon, title: message, showConfirmButton: false, timer: 2600, timerProgressBar: true });
    else alert(message);
  }
  function confirmAction(title, text, confirmText = "Confirm") {
    return Swal.fire({ icon: "warning", title, text, showCancelButton: true, confirmButtonText: confirmText, cancelButtonText: "Cancel", confirmButtonColor: "#0878df" });
  }
  function activeMaterial(materialId) { return M.materialById(materialId); }

  function fillFilterLocations() {
    const select = $("filterLocation");
    const current = select.value;
    select.innerHTML = '<option value="">All locations</option>' + M.locations().map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
    select.value = current;
  }

  function populateMaterials(selectedId) {
    const select = $("materialSelect");
    select.innerHTML = '<option value="">Select material...</option>' + M.materialsForSelect().map(m =>
      `<option value="${escapeHtml(m.id)}">${escapeHtml(m.materialNo)} — ${escapeHtml(m.description)}</option>`
    ).join("");
    if (selectedId) select.value = selectedId;
    updateMaterialChoices();
  }

  function updateMaterialChoices(selectedBatch, selectedLocation) {
    const material = activeMaterial($("materialSelect").value);
    $("materialDescription").textContent = material ? material.description : "Choose a material to view its description.";
    const batch = $("batchSelect"), location = $("locationSelect");
    if (!material) {
      batch.innerHTML = '<option value="">Select batch...</option>'; batch.disabled = true;
      location.innerHTML = '<option value="">Select location...</option>'; location.disabled = true;
      $("stockPreview").innerHTML = '<i class="bi bi-info-circle"></i><span>Select material, batch and location to view current balance.</span>';
      return;
    }
    // Master rows represent valid Material + Batch + Location combinations.
    const siblings = M.materialsForSelect().filter(m => m.materialNo === material.materialNo);
    const batches = [...new Set(siblings.map(m => m.batch))];
    batch.innerHTML = '<option value="">Select batch...</option>' + batches.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
    batch.disabled = false;
    batch.value = selectedBatch || material.batch;
    updateLocations(selectedLocation || material.location);
  }

  function updateLocations(selectedLocation) {
    const material = activeMaterial($("materialSelect").value);
    const location = $("locationSelect");
    if (!material) return;
    const rows = M.materialsForSelect().filter(m => m.materialNo === material.materialNo && m.batch === $("batchSelect").value);
    const locations = [...new Set(rows.map(m => m.location))];
    location.innerHTML = '<option value="">Select location...</option>' + locations.map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
    location.disabled = false;
    location.value = selectedLocation || locations[0] || "";
    updateStockPreview();
  }

  function selectedMaster() {
    const material = activeMaterial($("materialSelect").value);
    if (!material) return null;
    return DB.materials.find(m =>
      m.materialNo === material.materialNo &&
      m.batch === $("batchSelect").value &&
      m.location === $("locationSelect").value
    ) || null;
  }

  function updateStockPreview() {
    const material = selectedMaster();
    if (!material) {
      $("stockPreview").innerHTML = '<i class="bi bi-info-circle"></i><span>Select material, batch and location to view current balance.</span>';
      return;
    }
    const balance = M.getCurrentBalance(material.id, material.location);
    $("stockPreview").innerHTML = `<i class="bi bi-box-seam"></i><span>Current Stock Balance: <strong>${fmt(balance)} ${escapeHtml(material.unit || "KG")}</strong></span>`;
  }

  function getFilters() {
    return {
      search: $("filterSearch").value.trim().toLowerCase(),
      from: $("filterFrom").value,
      to: $("filterTo").value,
      type: $("filterType").value,
      status: $("filterStatus").value,
      location: $("filterLocation").value
    };
  }

  function filteredMovements() {
    const f = getFilters();
    return DB.movements.filter(m => {
      const searchBlob = [m.materialNo, m.description, m.batch, m.referenceNo, m.externalRef, m.remark, m.location, m.type].join(" ").toLowerCase();
      if (f.search && !searchBlob.includes(f.search)) return false;
      if (f.from && m.date < f.from) return false;
      if (f.to && m.date > f.to) return false;
      if (f.type && m.type !== f.type) return false;
      if (f.status && m.status !== f.status) return false;
      if (f.location && m.location !== f.location) return false;
      return true;
    }).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function renderSummary(rows) {
    const posted = rows.filter(m => m.status === "POSTED" || m.status === "REVERSED");
    let stockIn = 0, stockOut = 0, net = 0;
    posted.forEach(m => {
      // Original reversed movement is neutralized by its linked reversal record.
      const effect = M.signedQty(m);
      net += effect;
      if (effect > 0) stockIn += effect;
      if (effect < 0) stockOut += Math.abs(effect);
    });
    $("sumTransactions").textContent = rows.length.toLocaleString();
    $("sumIn").textContent = fmt(stockIn);
    $("sumOut").textContent = fmt(stockOut);
    $("sumNet").textContent = (net > 0 ? "+" : "") + fmt(net);
  }

  function statusBadge(status) {
    const label = { DRAFT: "Draft", POSTED: "Posted", REVERSED: "Reversed" }[status] || status;
    return `<span class="status-pill status-${escapeHtml(status)}">${escapeHtml(label)}</span>`;
  }
  function typeBadge(type) {
    const info = M.typeInfo(type);
    return `<span class="type-pill type-${escapeHtml(type)}">${escapeHtml(info.label)}</span>`;
  }

  function renderTable() {
    fillFilterLocations();
    const rows = filteredMovements();
    renderSummary(rows);
    const size = Number($("pageSize").value || 10);
    const totalPages = Math.max(1, Math.ceil(rows.length / size));
    page = Math.min(page, totalPages);
    const start = (page - 1) * size;
    const visible = rows.slice(start, start + size);
    $("recordCount").textContent = `${rows.length.toLocaleString()} records`;
    $("tableInfo").textContent = rows.length ? `Showing ${start + 1}-${Math.min(start + size, rows.length)} of ${rows.length}` : "Showing 0 records";
    $("movementTableBody").innerHTML = visible.length ? visible.map(m => {
      const signed = M.signedQty(m);
      const qtyClass = signed > 0 ? "qty-in" : signed < 0 ? "qty-out" : "qty-neutral";
      const qtyText = `${signed > 0 ? "+" : ""}${fmt(signed)}`;
      return `<tr>
        <td>${dateText(m.date)}</td>
        <td><b>${escapeHtml(m.referenceNo || "—")}</b><span class="sub-cell">${escapeHtml(m.externalRef || "")}</span></td>
        <td><span class="material-code">${escapeHtml(m.materialNo)}</span><span class="sub-cell">${escapeHtml(m.description || "")}</span></td>
        <td>${escapeHtml(m.batch)}</td>
        <td>${escapeHtml(m.location)}</td>
        <td>${typeBadge(m.type)}</td>
        <td class="text-end ${qtyClass}">${qtyText}</td>
        <td>${statusBadge(m.status)}</td>
        <td><div class="action-group">
          <button class="btn-table" title="View details" data-action="view" data-id="${escapeHtml(m.id)}"><i class="bi bi-eye"></i></button>
          ${m.status === "DRAFT" ? `<button class="btn-table" title="Edit draft" data-action="edit" data-id="${escapeHtml(m.id)}"><i class="bi bi-pencil"></i></button><button class="btn-table" title="Post" data-action="post" data-id="${escapeHtml(m.id)}"><i class="bi bi-check2-circle"></i></button><button class="btn-table" title="Delete draft" data-action="delete" data-id="${escapeHtml(m.id)}"><i class="bi bi-trash3"></i></button>` : ""}
          ${m.status === "POSTED" && !m.reversedById ? `<button class="btn-table" title="Reverse" data-action="reverse" data-id="${escapeHtml(m.id)}"><i class="bi bi-arrow-counterclockwise"></i></button>` : ""}
        </div></td>
      </tr>`;
    }).join("") : `<tr><td colspan="9" class="empty-state"><i class="bi bi-inbox"></i>No movement transactions found.<br><small>Add a movement or change your filters.</small></td></tr>`;

    const pages = [];
    for (let p = 1; p <= totalPages; p++) {
      pages.push(`<li class="page-item ${p === page ? "active" : ""}"><button class="page-link" data-page="${p}">${p}</button></li>`);
    }
    $("pagination").innerHTML = pages.join("");
  }

  function resetForm() {
    $("movementForm").reset();
    $("movementId").value = "";
    $("movementModalTitle").textContent = "Add Stock Movement";
    $("postingDate").value = new Date().toISOString().slice(0, 10);
    $("batchSelect").disabled = true;
    $("locationSelect").disabled = true;
    $("transferFromWrap").classList.add("d-none");
    $("transferToWrap").classList.add("d-none");
    populateMaterials();
    populateTransferLocations();
  }

  function populateTransferLocations() {
    const options = M.locations().map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
    $("transferFrom").innerHTML = '<option value="">Select source...</option>' + options;
    $("transferTo").innerHTML = '<option value="">Select destination...</option>' + options;
  }

  function openAdd() {
    resetForm();
    modal.show();
  }

  function openEdit(movementId) {
    const m = M.getMovement(movementId);
    if (!m || m.status !== "DRAFT") return notify("แก้ไขได้เฉพาะรายการ Draft", "warning");
    resetForm();
    $("movementId").value = m.id;
    $("movementModalTitle").textContent = "Edit Stock Movement";
    populateMaterials(m.materialId);
    const master = activeMaterial(m.materialId);
    if (master) {
      $("batchSelect").value = m.batch;
      updateLocations(m.location);
    }
    $("movementType").value = m.type;
    $("postingDate").value = m.date;
    $("quantity").value = m.quantity;
    $("referenceNo").value = m.referenceNo || "";
    $("externalRef").value = m.externalRef || "";
    $("remark").value = m.remark || "";
    $("transferFrom").value = m.transferFrom || "";
    $("transferTo").value = m.transferTo || "";
    toggleTransferFields();
    modal.show();
  }

  function toggleTransferFields() {
    const transfer = $("movementType").value === "311_IN" || $("movementType").value === "311_OUT";
    $("transferFromWrap").classList.toggle("d-none", !transfer);
    $("transferToWrap").classList.toggle("d-none", !transfer);
    $("transferFrom").required = transfer;
    $("transferTo").required = transfer;
  }

  function saveForm(event) {
    event.preventDefault();
    const master = selectedMaster();
    if (!master) return notify("กรุณาเลือก Material, Batch และ Location ให้ถูกต้อง", "warning");
    const data = {
      materialId: master.id,
      materialNo: master.materialNo,
      batch: $("batchSelect").value,
      location: $("locationSelect").value,
      type: $("movementType").value,
      date: $("postingDate").value,
      quantity: Number($("quantity").value),
      referenceNo: $("referenceNo").value.trim(),
      externalRef: $("externalRef").value.trim(),
      remark: $("remark").value.trim(),
      transferFrom: $("transferFrom").value,
      transferTo: $("transferTo").value
    };
    const result = M.saveDraft(data, $("movementId").value || null);
    if (!result.ok) {
      Swal.fire({ icon: "warning", title: "Please check the information", html: result.errors.map(escapeHtml).join("<br>") });
      return;
    }
    modal.hide();
    notify("บันทึก Draft เรียบร้อย", "success");
    page = 1;
    renderTable();
  }

  function detailHtml(m) {
    const signed = M.signedQty(m);
    const reversal = m.reversedById ? M.getMovement(m.reversedById) : null;
    const original = m.reversalOf ? M.getMovement(m.reversalOf) : null;
    const fields = [
      ["Posting Date", dateText(m.date)], ["Status", statusBadge(m.status)],
      ["Material No.", m.materialNo], ["Description", m.description || "-"],
      ["Batch", m.batch], ["Storage Location", m.location],
      ["Movement Type", M.typeInfo(m.type).label], ["Quantity", `${signed > 0 ? "+" : ""}${fmt(signed)} KG`],
      ["Document Number", m.referenceNo || "-"], ["External Reference", m.externalRef || "-"],
      ["Created By", m.createdBy || "-"], ["Created At", m.createdAt ? new Date(m.createdAt).toLocaleString() : "-"],
      ["Posted By", m.postedBy || "-"], ["Posted At", m.postedAt ? new Date(m.postedAt).toLocaleString() : "-"],
      ["Transfer From", m.transferFrom || "-"], ["Transfer To", m.transferTo || "-"],
      ["Remark", m.remark || "-"]
    ];
    if (reversal) fields.push(["Reversed By Document", reversal.referenceNo || reversal.id]);
    if (original) fields.push(["Reversal Of", original.referenceNo || original.id]);
    return `<div class="detail-grid">${fields.map(([label, value]) => `<div class="detail-item ${label === "Remark" ? "detail-wide" : ""}"><small>${escapeHtml(label)}</small><b>${label === "Status" ? value : escapeHtml(value)}</b></div>`).join("")}</div>`;
  }

  function openDetails(movementId) {
    const m = M.getMovement(movementId);
    if (!m) return;
    detailId = movementId;
    $("detailContent").innerHTML = detailHtml(m);
    let actions = '<button class="btn btn-light" data-bs-dismiss="modal">Close</button>';
    if (m.status === "DRAFT") {
      actions += `<button class="btn btn-outline-primary" id="detailEditBtn"><i class="bi bi-pencil me-1"></i>Edit</button><button class="btn btn-primary" id="detailPostBtn"><i class="bi bi-check2-circle me-1"></i>Post</button>`;
    }
    if (m.status === "POSTED" && !m.reversedById) actions += `<button class="btn btn-danger" id="detailReverseBtn"><i class="bi bi-arrow-counterclockwise me-1"></i>Reverse</button>`;
    $("detailActions").innerHTML = actions;
    detailModal.show();
  }

  async function post(idValue) {
    const m = M.getMovement(idValue);
    if (!m) return;
    const result = await confirmAction("Post this movement?", `ยืนยัน Post ${m.materialNo} จำนวน ${fmt(m.quantity)} KG หรือไม่?`, "Post");
    if (!result.isConfirmed) return;
    const posted = M.postMovement(idValue);
    if (!posted.ok) return Swal.fire({ icon: "error", title: "Post failed", text: posted.message });
    detailModal.hide();
    notify("Post รายการสำเร็จ และอัปเดต Stock Balance แล้ว", "success");
    renderTable();
  }

  async function reverse(idValue) {
    const m = M.getMovement(idValue);
    if (!m) return;
    const ask = await Swal.fire({
      title: "Reverse this movement?",
      text: `ระบบจะสร้างรายการกลับรายการสำหรับ ${m.materialNo} จำนวน ${fmt(m.quantity)} KG`,
      input: "textarea",
      inputLabel: "Reason for reversal",
      inputPlaceholder: "Enter reason...",
      showCancelButton: true,
      confirmButtonText: "Confirm Reverse",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#e34f63"
    });
    if (!ask.isConfirmed) return;
    const result = M.reverseMovement(idValue, ask.value || "");
    if (!result.ok) return Swal.fire({ icon: "error", title: "Reverse failed", text: result.message });
    detailModal.hide();
    notify("Reverse สำเร็จ เก็บประวัติรายการเดิมไว้แล้ว", "success");
    renderTable();
  }

  function exportExcel() {
    if (!global.XLSX) return notify("ไม่พบไลบรารี Excel", "error");
    const rows = filteredMovements().map(m => ({
      "Posting Date": m.date,
      "Document No.": m.referenceNo,
      "Material No.": m.materialNo,
      "Material Description": m.description,
      "Batch": m.batch,
      "Storage Location": m.location,
      "Movement Type": m.type,
      "Movement Description": M.typeInfo(m.type).label,
      "Quantity": m.quantity,
      "Signed Quantity": M.signedQty(m),
      "Unit": "KG",
      "Status": m.status,
      "External Reference": m.externalRef,
      "Remark": m.remark,
      "Created By": m.createdBy,
      "Created At": m.createdAt,
      "Posted By": m.postedBy,
      "Posted At": m.postedAt,
      "Reversal Of": m.reversalOf
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Movement");
    XLSX.writeFile(wb, `Daily_Stock_Movement_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function bindEvents() {
    $("addMovementBtn").addEventListener("click", openAdd);
    $("movementForm").addEventListener("submit", saveForm);
    $("materialSelect").addEventListener("change", () => updateMaterialChoices());
    $("batchSelect").addEventListener("change", () => updateLocations());
    $("locationSelect").addEventListener("change", updateStockPreview);
    $("movementType").addEventListener("change", toggleTransferFields);
    ["filterSearch","filterFrom","filterTo","filterType","filterStatus","filterLocation","pageSize"].forEach(idValue => {
      $(idValue).addEventListener(idValue === "filterSearch" ? "input" : "change", () => { page = 1; renderTable(); });
    });
    $("resetFilters").addEventListener("click", () => {
      ["filterSearch","filterFrom","filterTo","filterType","filterStatus","filterLocation"].forEach(idValue => $(idValue).value = "");
      page = 1; renderTable();
    });
    $("exportBtn").addEventListener("click", exportExcel);
    $("movementTableBody").addEventListener("click", event => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const idValue = button.dataset.id;
      const action = button.dataset.action;
      if (action === "view") openDetails(idValue);
      if (action === "edit") openEdit(idValue);
      if (action === "post") post(idValue);
      if (action === "reverse") reverse(idValue);
      if (action === "delete") confirmAction("Delete this draft?", "รายการ Draft นี้จะถูกลบถาวร", "Delete").then(r => {
        if (!r.isConfirmed) return;
        const result = M.deleteDraft(idValue);
        if (result.ok) { notify("ลบ Draft แล้ว", "success"); renderTable(); }
        else notify(result.message, "error");
      });
    });
    $("pagination").addEventListener("click", event => {
      const button = event.target.closest("[data-page]");
      if (!button) return;
      page = Number(button.dataset.page); renderTable();
    });
    $("detailActions").addEventListener("click", event => {
      if (event.target.closest("#detailEditBtn")) { detailModal.hide(); openEdit(detailId); }
      if (event.target.closest("#detailPostBtn")) post(detailId);
      if (event.target.closest("#detailReverseBtn")) reverse(detailId);
    });
    $("mobileMenu").addEventListener("click", () => {
      $("sidebar").classList.add("open"); $("sidebarBackdrop").classList.add("show");
    });
    $("sidebarBackdrop").addEventListener("click", () => {
      $("sidebar").classList.remove("open"); $("sidebarBackdrop").classList.remove("show");
    });
  }

  function seedDemoMovements() {
    if (DB.movements.length) return;
    const today = new Date();
    const date = (offset) => {
      const d = new Date(today); d.setDate(d.getDate() - offset);
      const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), day = String(d.getDate()).padStart(2,"0");
      return `${y}-${m}-${day}`;
    };
    const demo = [
      { id:"DEMO-MV-001", materialId:"MAT-001", materialNo:"85970764", description:"Raw Material A - Production Grade", batch:"35B16A1505", location:"THGR", type:"261", date:date(1), quantity:150, status:"POSTED", referenceNo:"4900001001", createdBy:"Admin", createdAt:new Date().toISOString(), postedBy:"Admin", postedAt:new Date().toISOString(), remark:"Production issue" },
      { id:"DEMO-MV-002", materialId:"MAT-002", materialNo:"87510485", description:"Raw Material B - Standard Grade", batch:"05PM6E0A40", location:"THGR", type:"OTHER_IN", date:date(0), quantity:250, status:"DRAFT", referenceNo:"GR-2026-001", createdBy:"Admin", createdAt:new Date().toISOString(), remark:"Sample draft receipt" }
    ];
    DB.movements.push(...demo.map(DB.normalizeMovement));
    DB.persistDB();
  }

  function init() {
    modal = new bootstrap.Modal($("movementModal"));
    detailModal = new bootstrap.Modal($("detailModal"));
    seedDemoMovements();
    resetForm();
    bindEvents();
    renderTable();
  }

  global.MovementUI = { notify, render: renderTable, openDetails };
  document.addEventListener("DOMContentLoaded", init);
})(window);
