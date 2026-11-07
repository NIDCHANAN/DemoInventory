/* Daily Stock Movement business rules */
(function (global) {
  "use strict";

  const DB = global.DB;
  if (!DB) throw new Error("DB is not initialized. Load inventory.js before movement.js.");

  const TYPE_INFO = {
    "261": { label: "261 · Goods Issue", effect: -1, direction: "OUT" },
    "262": { label: "262 · Reversal of Issue", effect: 1, direction: "IN" },
    "311_IN": { label: "311 · Transfer In", effect: 1, direction: "IN" },
    "311_OUT": { label: "311 · Transfer Out", effect: -1, direction: "OUT" },
    "OTHER_IN": { label: "Other · Stock In", effect: 1, direction: "IN" },
    "OTHER_OUT": { label: "Other · Stock Out", effect: -1, direction: "OUT" }
  };

  function id() { return DB.makeId ? DB.makeId() : "mv-" + Date.now(); }
  function typeInfo(type) { return TYPE_INFO[type] || { label: type || "Unknown", effect: 0, direction: "NONE" }; }
  function isEffective(m) { return m.status === "POSTED"; }
  function isReversal(m) { return !!m.reversalOf; }
  function signedQty(m) { return typeInfo(m.type).effect * Number(m.quantity || 0); }

  function materialById(materialId) {
    return DB.materials.find(m => String(m.id) === String(materialId)) || null;
  }

  function materialByIdentity(materialNo, batch, location) {
    return DB.materials.find(m =>
      String(m.materialNo) === String(materialNo) &&
      String(m.batch) === String(batch) &&
      String(m.location) === String(location)
    ) || null;
  }

  function locations() {
    return [...new Set(DB.materials.map(m => m.location).filter(Boolean))].sort();
  }

  function materialsForSelect() {
    return DB.materials.filter(m => Number(m.statusUse ?? 1) === 1);
  }

  function movementsForBalance(materialId, location, beforeDate) {
    return DB.movements.filter(m => {
      if (!isEffective(m) || isReversal(m)) return false;
      if (String(m.materialId) !== String(materialId)) return false;
      if (location && String(m.location) !== String(location)) return false;
      if (beforeDate && String(m.date) >= String(beforeDate)) return false;
      return true;
    });
  }

  function getBalance(materialId, location, asOfDate) {
    const material = materialById(materialId);
    if (!material) return 0;
    let balance = Number(material.openingStock || 0);
    DB.movements.forEach(m => {
      if (!isEffective(m)) return;
      if (String(m.materialId) !== String(materialId)) return;
      if (location && String(m.location) !== String(location)) return;
      if (asOfDate && String(m.date) > String(asOfDate)) return;
      balance += signedQty(m);
    });
    return balance;
  }

  function getCurrentBalance(materialId, location) {
    return getBalance(materialId, location, null);
  }

  function getBalanceBeforeMovement(materialId, location, date, excludeId) {
    const material = materialById(materialId);
    if (!material) return 0;
    let balance = Number(material.openingStock || 0);
    DB.movements.forEach(m => {
      if (!isEffective(m)) return;
      if (excludeId && m.id === excludeId) return;
      if (String(m.materialId) !== String(materialId)) return;
      if (location && String(m.location) !== String(location)) return;
      // Include transactions on the same date; this is a conservative current-stock check.
      if (String(m.date) <= String(date)) balance += signedQty(m);
    });
    return balance;
  }

  function validateDraft(data, editingId) {
    const errors = [];
    const material = materialById(data.materialId);
    if (!material) errors.push("กรุณาเลือก Material");
    if (!data.batch) errors.push("กรุณาเลือก Batch");
    if (!data.location) errors.push("กรุณาเลือก Storage Location");
    if (!TYPE_INFO[data.type]) errors.push("กรุณาเลือก Movement Type");
    if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) errors.push("กรุณาระบุ Posting Date");
    if (!Number.isFinite(Number(data.quantity)) || Number(data.quantity) <= 0) errors.push("Quantity ต้องมากกว่า 0");
    if (material && (material.batch !== data.batch || material.location !== data.location)) {
      errors.push("Batch หรือ Location ไม่ตรงกับ Material master data");
    }
    const duplicate = DB.movements.some(m =>
      m.id !== editingId &&
      m.status !== "REVERSED" &&
      data.referenceNo &&
      m.referenceNo.toLowerCase() === data.referenceNo.toLowerCase() &&
      m.materialId === data.materialId &&
      m.type === data.type
    );
    if (duplicate) errors.push("พบ Document Number ซ้ำสำหรับ Material และ Movement Type นี้");
    if (data.type === "311_IN" || data.type === "311_OUT") {
      if (!data.transferFrom || !data.transferTo || data.transferFrom === data.transferTo) {
        errors.push("กรุณาระบุ Transfer From และ Transfer To ให้แตกต่างกัน");
      }
    }
    return errors;
  }

  function saveDraft(data, editingId) {
    const errors = validateDraft(data, editingId);
    if (errors.length) return { ok: false, errors };
    const material = materialById(data.materialId);
    const now = new Date().toISOString();

    if (editingId) {
      const index = DB.movements.findIndex(m => m.id === editingId);
      if (index < 0) return { ok: false, errors: ["ไม่พบรายการที่ต้องการแก้ไข"] };
      const old = DB.movements[index];
      if (old.status !== "DRAFT") return { ok: false, errors: ["แก้ไขได้เฉพาะรายการ Draft"] };
      DB.movements[index] = {
        ...old, ...data,
        materialNo: material.materialNo,
        description: material.description,
        quantity: Number(data.quantity),
        status: "DRAFT",
        updatedAt: now,
        updatedBy: "Admin"
      };
      DB.persistDB();
      return { ok: true, movement: DB.movements[index] };
    }

    const movement = {
      id: id(),
      ...data,
      materialNo: material.materialNo,
      description: material.description,
      quantity: Number(data.quantity),
      status: "DRAFT",
      createdAt: now,
      createdBy: "Admin",
      postedAt: null,
      postedBy: null,
      reversedAt: null,
      reversedBy: null,
      reversalOf: null,
      reversedById: null
    };
    DB.movements.unshift(movement);
    DB.persistDB();
    return { ok: true, movement };
  }

  function postMovement(movementId) {
    const movement = DB.movements.find(m => m.id === movementId);
    if (!movement) return { ok: false, message: "ไม่พบรายการ" };
    if (movement.status !== "DRAFT") return { ok: false, message: "Post ได้เฉพาะรายการ Draft" };
    if (movement.reversalOf) return { ok: false, message: "ไม่สามารถ Post รายการกลับรายการซ้ำได้" };

    const info = typeInfo(movement.type);
    if (info.effect < 0) {
      const balance = getCurrentBalance(movement.materialId, movement.location);
      if (balance < movement.quantity) {
        return { ok: false, message: `Stock ไม่เพียงพอ ยอดคงเหลือปัจจุบัน ${balance.toLocaleString()} KG` };
      }
    }

    movement.status = "POSTED";
    movement.postedAt = new Date().toISOString();
    movement.postedBy = "Admin";
    DB.persistDB();
    return { ok: true, movement };
  }

  function reverseMovement(movementId, reason) {
    const original = DB.movements.find(m => m.id === movementId);
    if (!original) return { ok: false, message: "ไม่พบรายการ" };
    if (original.status !== "POSTED") return { ok: false, message: "Reverse ได้เฉพาะรายการ Posted" };
    if (original.reversedById) return { ok: false, message: "รายการนี้ถูก Reverse ไปแล้ว" };

    const inverseType = {
      "261": "262",
      "262": "261",
      "311_IN": "311_OUT",
      "311_OUT": "311_IN",
      "OTHER_IN": "OTHER_OUT",
      "OTHER_OUT": "OTHER_IN"
    }[original.type];

    const inverse = {
      id: id(),
      materialId: original.materialId,
      materialNo: original.materialNo,
      description: original.description,
      batch: original.batch,
      location: original.location,
      type: inverseType,
      date: new Date().toISOString().slice(0, 10),
      quantity: Number(original.quantity),
      status: "POSTED",
      referenceNo: original.referenceNo ? `REV-${original.referenceNo}` : `REV-${original.id.slice(0, 8)}`,
      externalRef: original.id,
      remark: `Reversal of ${original.id}. Reason: ${reason || "No reason provided"}`,
      createdAt: new Date().toISOString(),
      createdBy: "Admin",
      postedAt: new Date().toISOString(),
      postedBy: "Admin",
      reversedAt: null,
      reversedBy: null,
      reversalOf: original.id,
      reversedById: null
    };

    // Reversal of an inbound transaction is an outbound movement; prevent negative stock.
    if (typeInfo(inverse.type).effect < 0) {
      const current = getCurrentBalance(inverse.materialId, inverse.location);
      if (current < inverse.quantity) {
        return { ok: false, message: `ไม่สามารถ Reverse ได้ เพราะ Stock ปัจจุบัน ${current.toLocaleString()} KG น้อยกว่าจำนวนที่จะกลับรายการ ${inverse.quantity.toLocaleString()} KG` };
      }
    }

    DB.movements.unshift(inverse);
    original.reversedById = inverse.id;
    original.reversedAt = new Date().toISOString();
    original.reversedBy = "Admin";
    original.status = "REVERSED";
    DB.persistDB();
    return { ok: true, original, reversal: inverse };
  }

  function deleteDraft(movementId) {
    const movement = DB.movements.find(m => m.id === movementId);
    if (!movement) return { ok: false, message: "ไม่พบรายการ" };
    if (movement.status !== "DRAFT") return { ok: false, message: "ลบได้เฉพาะรายการ Draft" };
    DB.movements = DB.movements.filter(m => m.id !== movementId);
    DB.persistDB();
    return { ok: true };
  }

  function getMovement(idValue) {
    return DB.movements.find(m => m.id === idValue) || null;
  }

  global.Movement = {
    TYPE_INFO, typeInfo, signedQty, materialById, materialByIdentity,
    locations, materialsForSelect, getBalance, getCurrentBalance,
    getBalanceBeforeMovement, saveDraft, postMovement, reverseMovement,
    deleteDraft, getMovement, isEffective
  };
})(window);
