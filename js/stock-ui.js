/* Stock on Hand page controller - uses the same DB and Movement modules as Daily Stock Movement. */
(() => {
  "use strict";
  const DB = window.DB;
  const Movement = window.Movement;
  if (!DB || !Movement) throw new Error("Please load inventory.js and movement.js before stock-ui.js.");

  const $ = id => document.getElementById(id);
  const fmt = n => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const materialModal = bootstrap.Modal.getOrCreateInstance($("materialModal"));
  const detailModal = bootstrap.Modal.getOrCreateInstance($("detailModal"));
  let page = 1;
  let filteredRows = [];

  function currentRows() {
    return DB.materials.map(m => {
      const movements = DB.movements.filter(x => x.materialId === m.id && x.status === "POSTED");
      const balance = Movement.getCurrentBalance(m.id, m.location);
      const stockIn = movements.filter(x => Movement.typeInfo(x.type).effect > 0).reduce((s,x) => s + Number(x.quantity || 0), 0);
      const stockOut = movements.filter(x => Movement.typeInfo(x.type).effect < 0).reduce((s,x) => s + Number(x.quantity || 0), 0);
      return { ...m, balance, stockIn, stockOut };
    });
  }

  function statusOf(row) {
    if (Number(row.statusUse) !== 1) return { key:"inactive", label:"Inactive" };
    if (row.balance < 0) return { key:"negative", label:"Negative" };
    if (row.balance === 0) return { key:"zero", label:"Zero stock" };
    if (row.balance <= Number($("lowThreshold").value || 10)) return { key:"low", label:"Low stock" };
    return { key:"available", label:"Available" };
  }

  function fillLocations() {
    const select = $("filterLocation");
    const current = select.value;
    const locations = [...new Set(DB.materials.map(m => m.location).filter(Boolean))].sort();
    select.innerHTML = '<option value="">All locations</option>' + locations.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
    if (locations.includes(current)) select.value = current;
  }

  function updateSummary(rows) {
    const active = rows.filter(x => Number(x.statusUse) === 1);
    $("sumLines").textContent = active.length.toLocaleString();
    $("sumStock").textContent = fmt(active.reduce((s,x) => s + x.balance, 0));
    $("sumIn").textContent = fmt(active.reduce((s,x) => s + x.stockIn, 0));
    $("sumLow").textContent = active.filter(x => x.balance <= Number($("lowThreshold").value || 10)).length.toLocaleString();
  }

  function getFiltered() {
    const q = $("filterSearch").value.trim().toLowerCase();
    const loc = $("filterLocation").value;
    const status = $("filterStock").value;
    return currentRows().filter(row => {
      const haystack = [row.materialNo,row.description,row.batch,row.location].join(" ").toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (loc && row.location !== loc) return false;
      const st = statusOf(row).key;
      if (status === "normal" && st !== "available") return false;
      if (status && status !== "normal" && st !== status) return false;
      return true;
    }).sort((a,b) => a.materialNo.localeCompare(b.materialNo) || a.batch.localeCompare(b.batch) || a.location.localeCompare(b.location));
  }

  function render() {
    fillLocations();
    const all = currentRows();
    updateSummary(all);
    filteredRows = getFiltered();
    const pageSize = Number($("pageSize").value || 10);
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    page = Math.min(page, totalPages);
    const start = (page - 1) * pageSize;
    const rows = filteredRows.slice(start, start + pageSize);
    $("recordCount").textContent = `${filteredRows.length.toLocaleString()} records`;
    $("tableInfo").textContent = filteredRows.length ? `Showing ${start+1}-${Math.min(start+pageSize,filteredRows.length)} of ${filteredRows.length}` : "Showing 0 records";
    $("stockTableBody").innerHTML = rows.length ? rows.map((r,i) => {
      const st = statusOf(r);
      return `<tr>
        <td>${start+i+1}</td>
        <td><span class="material-code">${esc(r.materialNo)}</span></td>
        <td><span class="material-desc" title="${esc(r.description)}">${esc(r.description)}</span></td>
        <td>${esc(r.location)}</td><td><span class="batch-code">${esc(r.batch)}</span></td>
        <td class="text-end qty">${fmt(r.openingStock)}</td>
        <td class="text-end qty in">${fmt(r.stockIn)}</td>
        <td class="text-end qty out">${fmt(r.stockOut)}</td>
        <td class="text-end qty balance ${r.balance < 0 ? "negative" : ""}">${fmt(r.balance)}</td>
        <td><span class="status-pill ${st.key}">${st.label}</span></td>
        <td><div class="action-group">
          <button class="action-btn" title="View details" data-action="view" data-id="${esc(r.id)}"><i class="bi bi-eye"></i></button>
          <button class="action-btn" title="Edit" data-action="edit" data-id="${esc(r.id)}"><i class="bi bi-pencil"></i></button>
          <button class="action-btn" title="Delete" data-action="delete" data-id="${esc(r.id)}"><i class="bi bi-trash3"></i></button>
        </div></td>
      </tr>`;
    }).join("") : `<tr><td colspan="11"><div class="empty-state"><i class="bi bi-inboxes"></i><b>No stock records found</b><span>Try changing your filters or add a material.</span></div></td></tr>`;
    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    let html = `<li class="page-item ${page===1?"disabled":""}"><button class="page-link" data-page="${page-1}">‹</button></li>`;
    const from = Math.max(1, page - 2), to = Math.min(totalPages, from + 4);
    for (let i=from;i<=to;i++) html += `<li class="page-item ${i===page?"active":""}"><button class="page-link" data-page="${i}">${i}</button></li>`;
    html += `<li class="page-item ${page===totalPages?"disabled":""}"><button class="page-link" data-page="${page+1}">›</button></li>`;
    $("pagination").innerHTML = html;
  }

  function openAdd() {
    $("materialForm").reset();
    $("materialId").value = "";
    $("materialModalTitle").textContent = "Add Material";
    $("openingStock").value = "0";
    $("statusUse").value = "1";
    materialModal.show();
  }

  function openEdit(id) {
    const m = DB.materials.find(x => x.id === id);
    if (!m) return;
    $("materialForm").reset();
    $("materialId").value = m.id;
    $("materialNo").value = m.materialNo;
    $("description").value = m.description;
    $("batch").value = m.batch;
    $("location").value = m.location;
    $("unit").value = m.unit || "KG";
    $("openingStock").value = m.openingStock;
    $("statusUse").value = String(m.statusUse ?? 1);
    $("materialModalTitle").textContent = "Edit Material";
    materialModal.show();
  }

  function saveMaterial(e) {
    e.preventDefault();
    const id = $("materialId").value;
    const data = {
      materialNo: $("materialNo").value.trim(),
      description: $("description").value.trim(),
      batch: $("batch").value.trim(),
      location: $("location").value.trim(),
      unit: $("unit").value,
      openingStock: Number($("openingStock").value),
      statusUse: Number($("statusUse").value)
    };
    if (!data.materialNo || !data.description || !data.batch || !data.location || !Number.isFinite(data.openingStock) || data.openingStock < 0) {
      Swal.fire({icon:"warning",title:"ข้อมูลไม่ครบ",text:"กรุณากรอกข้อมูล Material, Batch, Location และ Opening Stock ให้ถูกต้อง"});
      return;
    }
    const duplicate = DB.materials.some(m => m.id !== id && m.materialNo.toLowerCase() === data.materialNo.toLowerCase() && m.batch.toLowerCase() === data.batch.toLowerCase() && m.location.toLowerCase() === data.location.toLowerCase());
    if (duplicate) {
      Swal.fire({icon:"warning",title:"ข้อมูลซ้ำ",text:"Material No. + Batch + Storage Location นี้มีอยู่แล้ว"});
      return;
    }
    if (id) {
      const old = DB.materials.find(m => m.id === id);
      if (!old) return;
      // Preserve identity used by posted movements. Opening stock can be adjusted only with explicit confirmation.
      Object.assign(old, data);
    } else {
      DB.materials.push({ id: DB.makeId(), ...data });
    }
    DB.persistDB();
    materialModal.hide();
    render();
    Swal.fire({icon:"success",title:"บันทึกสำเร็จ",timer:1200,showConfirmButton:false});
  }

  function viewDetails(id) {
    const r = currentRows().find(x => x.id === id);
    if (!r) return;
    const history = DB.movements.filter(m => m.materialId === id).sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0,8);
    $("detailContent").innerHTML = `
      <div class="detail-grid mb-3">
        <div class="detail-item"><span>Material No.</span><b>${esc(r.materialNo)}</b></div>
        <div class="detail-item"><span>Description</span><b>${esc(r.description)}</b></div>
        <div class="detail-item"><span>Batch</span><b>${esc(r.batch)}</b></div>
        <div class="detail-item"><span>Storage Location</span><b>${esc(r.location)}</b></div>
        <div class="detail-item"><span>Opening Stock</span><b>${fmt(r.openingStock)} ${esc(r.unit)}</b></div>
        <div class="detail-item"><span>Posted Stock IN / OUT</span><b>${fmt(r.stockIn)} / ${fmt(r.stockOut)} ${esc(r.unit)}</b></div>
        <div class="detail-item detail-total"><span>Current Stock Balance</span><b>${fmt(r.balance)} ${esc(r.unit)}</b></div>
        <div class="detail-item"><span>Status</span><b>${statusOf(r).label}</b></div>
      </div>
      <h6 class="fw-semibold mt-3 mb-2" style="font-size:12px;color:#102b54">Recent Movement History</h6>
      ${history.length ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Date</th><th>Document</th><th>Type</th><th class="text-end">Qty</th><th>Status</th></tr></thead><tbody>${history.map(m=>`<tr><td>${esc(m.date)}</td><td>${esc(m.referenceNo || "-")}</td><td>${esc(Movement.typeInfo(m.type).label)}</td><td class="text-end">${fmt(m.quantity)}</td><td>${esc(m.status)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="text-muted small">No movement history.</div>`}`;
    detailModal.show();
  }

  async function deleteMaterial(id) {
    const m = DB.materials.find(x => x.id === id);
    if (!m) return;
    const hasMovements = DB.movements.some(x => x.materialId === id);
    if (hasMovements) {
      Swal.fire({icon:"info",title:"ไม่สามารถลบได้",text:"Material นี้มี Movement History อยู่แล้ว แนะนำให้เปลี่ยนสถานะเป็น Inactive"});
      return;
    }
    const result = await Swal.fire({icon:"warning",title:"Delete material?",text:`ต้องการลบ ${m.materialNo} / ${m.batch} ใช่หรือไม่`,showCancelButton:true,confirmButtonText:"Delete",cancelButtonText:"Cancel",confirmButtonColor:"#e0445d"});
    if (!result.isConfirmed) return;
    DB.materials = DB.materials.filter(x => x.id !== id);
    DB.persistDB();
    render();
    Swal.fire({icon:"success",title:"ลบข้อมูลแล้ว",timer:1000,showConfirmButton:false});
  }

  function exportExcel() {
    const rows = currentRows().map((r,i) => ({
      "No.":i+1,"Material No.":r.materialNo,"Material Description":r.description,"Storage Location":r.location,
      "Batch":r.batch,"Opening Stock":r.openingStock,"Stock IN":r.stockIn,"Stock OUT":r.stockOut,
      "Stock Balance":r.balance,"Unit":r.unit,"Status":statusOf(r).label
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{wch:7},{wch:18},{wch:38},{wch:18},{wch:20},{wch:16},{wch:16},{wch:16},{wch:18},{wch:10},{wch:14}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock on Hand");
    XLSX.writeFile(wb, `Stock_on_Hand_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function importExcel(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, {type:"array"});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, {defval:""});
        if (!raw.length) throw new Error("ไม่พบข้อมูลใน Sheet แรก");
        const key = s => String(s).toLowerCase().replace(/[\s._/-]/g,"");
        const find = (row, aliases) => {
          const kmap = Object.keys(row).reduce((o,k)=>(o[key(k)]=k,o),{});
          for (const a of aliases) if (kmap[key(a)] !== undefined) return row[kmap[key(a)]];
          return "";
        };
        let added=0, updated=0, skipped=0;
        raw.forEach(row => {
          const materialNo = String(find(row,["Material No.","Material","Material Number","Article Code No.","Article Code"])).trim();
          const description = String(find(row,["Material Description","Description","Material Desc"])).trim();
          const batch = String(find(row,["Batch","Batch No.","Batch Number"])).trim();
          const location = String(find(row,["Storage Location","SLoc","Location"])).trim();
          const opening = Number(String(find(row,["Opening Stock","OP Stock","Opening Balance","Stock Balance"])).replace(/,/g,"").replace(/^\((.*)\)$/,"-$1"));
          if (!materialNo || !batch || !location || !Number.isFinite(opening)) { skipped++; return; }
          const existing = DB.materials.find(m=>m.materialNo===materialNo && m.batch===batch && m.location===location);
          const item = {materialNo,description:description || materialNo,batch,location,openingStock:opening,unit:String(find(row,["Unit","UOM"]) || "KG"),statusUse:1};
          if (existing) { existing.description=item.description; existing.openingStock=item.openingStock; existing.unit=item.unit; updated++; }
          else { DB.materials.push({id:DB.makeId(),...item}); added++; }
        });
        DB.persistDB(); render();
        Swal.fire({icon:"success",title:"Import completed",html:`เพิ่มใหม่ <b>${added}</b> รายการ<br>อัปเดต <b>${updated}</b> รายการ<br>ข้าม <b>${skipped}</b> รายการ`});
      } catch(err) { Swal.fire({icon:"error",title:"Import failed",text:err.message || "อ่านไฟล์ไม่สำเร็จ"}); }
      $("excelFile").value = "";
    };
    reader.readAsArrayBuffer(file);
  }

  $("addMaterialBtn").addEventListener("click", openAdd);
  $("materialForm").addEventListener("submit", saveMaterial);
  $("filterSearch").addEventListener("input",()=>{page=1;render()});
  ["filterLocation","filterStock","lowThreshold","pageSize"].forEach(id=>$(id).addEventListener("change",()=>{page=1;render()}));
  $("resetFilters").addEventListener("click",()=>{$("filterSearch").value="";$("filterLocation").value="";$("filterStock").value="";$("lowThreshold").value="10";page=1;render()});
  $("pagination").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(!b)return;const n=Number(b.dataset.page);if(n>=1){page=n;render()}});
  $("stockTableBody").addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(!b)return;const {action,id}=b.dataset;if(action==="view")viewDetails(id);if(action==="edit")openEdit(id);if(action==="delete")deleteMaterial(id)});
  $("exportBtn").addEventListener("click",exportExcel);
  $("importBtn").addEventListener("click",()=>$("excelFile").click());
  $("excelFile").addEventListener("change",e=>{if(e.target.files[0])importExcel(e.target.files[0])});
  $("mobileMenu").addEventListener("click",()=>{$("sidebar").classList.toggle("open");$("sidebarBackdrop").classList.toggle("show")});
  $("sidebarBackdrop").addEventListener("click",()=>{$("sidebar").classList.remove("open");$("sidebarBackdrop").classList.remove("show")});
  render();
})();
