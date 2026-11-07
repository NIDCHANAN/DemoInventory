/* Shared Stock on Hand master data.
   Integration: if your existing application already defines window.DB.materials,
   this file will reuse it. Otherwise it creates a small demo master for testing. */
(function (global) {
  "use strict";

  const MATERIAL_KEY = "raw_material_materials_v2";
  const MOVEMENT_KEY = "raw_material_movements_v2";

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.warn("Cannot read localStorage key:", key, err);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function makeId() {
    return (global.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function normalizeMaterial(raw) {
    const m = raw || {};
    return {
      id: String(m.id ?? m.materialId ?? makeId()),
      materialNo: String(m.materialNo ?? m.materialCode ?? m.code ?? m.articleCode ?? ""),
      description: String(m.description ?? m.materialDescription ?? m.name ?? ""),
      batch: String(m.batch ?? m.batchNo ?? ""),
      location: String(m.location ?? m.storageLocation ?? m.storageLocationCode ?? ""),
      openingStock: Number(m.openingStock ?? m.openingQty ?? m.openingBalance ?? m.stock ?? 0),
      unit: String(m.unit ?? "KG"),
      statusUse: m.statusUse ?? 1
    };
  }

  function normalizeMovement(raw) {
    const m = raw || {};
    return {
      ...m,
      id: String(m.id ?? makeId()),
      materialId: String(m.materialId ?? ""),
      materialNo: String(m.materialNo ?? ""),
      batch: String(m.batch ?? ""),
      location: String(m.location ?? ""),
      type: String(m.type ?? m.movementType ?? ""),
      date: String(m.date ?? m.postingDate ?? new Date().toISOString().slice(0, 10)),
      quantity: Math.abs(Number(m.quantity ?? 0)),
      status: String(m.status ?? "DRAFT").toUpperCase(),
      referenceNo: String(m.referenceNo ?? m.documentNo ?? ""),
      externalRef: String(m.externalRef ?? ""),
      remark: String(m.remark ?? ""),
      createdAt: m.createdAt ?? new Date().toISOString(),
      createdBy: m.createdBy ?? "Admin",
      postedAt: m.postedAt ?? null,
      postedBy: m.postedBy ?? null,
      reversedAt: m.reversedAt ?? null,
      reversedBy: m.reversedBy ?? null,
      reversalOf: m.reversalOf ?? null,
      reversedById: m.reversedById ?? null
    };
  }

  const existingDB = global.DB && typeof global.DB === "object" ? global.DB : {};
  const storedMaterials = readJSON(MATERIAL_KEY, null);
  const storedMovements = readJSON(MOVEMENT_KEY, null);

  // Keep an existing Stock on Hand DB array intact; only normalize its field aliases.
  const sourceMaterials = Array.isArray(existingDB.materials)
    ? existingDB.materials
    : (Array.isArray(storedMaterials) ? storedMaterials : null);

  const demoMaterials = [
    { id: "MAT-001", materialNo: "85970764", description: "Raw Material A - Production Grade", batch: "35B16A1505", location: "THGR", openingStock: 2250, unit: "KG", statusUse: 1 },
    { id: "MAT-002", materialNo: "87510485", description: "Raw Material B - Standard Grade", batch: "05PM6E0A40", location: "THGR", openingStock: 3600, unit: "KG", statusUse: 1 },
    { id: "MAT-003", materialNo: "84403025", description: "Raw Material C - Industrial Grade", batch: "05PM6E0A40", location: "WH01", openingStock: 4000, unit: "KG", statusUse: 1 },
    { id: "MAT-004", materialNo: "84403025", description: "Raw Material C - Industrial Grade", batch: "05PM6E0A41", location: "THGR", openingStock: 1800, unit: "KG", statusUse: 1 },
    { id: "MAT-005", materialNo: "87870554", description: "M.3108P 550115 Raw Material", batch: "BATCH-2609", location: "WH01", openingStock: 1250, unit: "KG", statusUse: 1 }
  ];

  const materials = (sourceMaterials || demoMaterials).map(normalizeMaterial);
  const movements = (Array.isArray(existingDB.movements)
    ? existingDB.movements
    : (Array.isArray(storedMovements) ? storedMovements : [])).map(normalizeMovement);

  const DB = existingDB;
  DB.materials = materials;
  DB.movements = movements;
  DB.persistDB = function () {
    writeJSON(MATERIAL_KEY, DB.materials);
    writeJSON(MOVEMENT_KEY, DB.movements);
  };
  DB.makeId = makeId;
  DB.normalizeMaterial = normalizeMaterial;
  DB.normalizeMovement = normalizeMovement;

  // Expose same DB object to the movement module and other pages.
  global.DB = DB;

  // Only seed the demo master when no existing master data was found.
  if (!sourceMaterials) DB.persistDB();

})(window);
