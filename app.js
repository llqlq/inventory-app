const STORAGE_KEY = "personal-inventory-items-v1";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const els = {
  addBtn: document.querySelector("#addBtn"),
  emptyAddBtn: document.querySelector("#emptyAddBtn"),
  itemDialog: document.querySelector("#itemDialog"),
  backupDialog: document.querySelector("#backupDialog"),
  itemForm: document.querySelector("#itemForm"),
  closeDialogBtn: document.querySelector("#closeDialogBtn"),
  closeBackupBtn: document.querySelector("#closeBackupBtn"),
  deleteBtn: document.querySelector("#deleteBtn"),
  dialogTitle: document.querySelector("#dialogTitle"),
  itemsList: document.querySelector("#itemsList"),
  emptyState: document.querySelector("#emptyState"),
  itemTemplate: document.querySelector("#itemTemplate"),
  searchInput: document.querySelector("#searchInput"),
  backupBtn: document.querySelector("#backupBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  totalCount: document.querySelector("#totalCount"),
  expiringCount: document.querySelector("#expiringCount"),
  lowCount: document.querySelector("#lowCount"),
  filters: [...document.querySelectorAll(".chip")],
  fields: {
    id: document.querySelector("#itemId"),
    name: document.querySelector("#nameInput"),
    quantity: document.querySelector("#quantityInput"),
    unit: document.querySelector("#unitInput"),
    min: document.querySelector("#minInput"),
    expiry: document.querySelector("#expiryInput"),
    location: document.querySelector("#locationInput"),
    category: document.querySelector("#categoryInput"),
    photo: document.querySelector("#photoInput"),
    photoPreview: document.querySelector("#photoPreview"),
    photoPreviewImg: document.querySelector("#photoPreviewImg"),
    removePhotoBtn: document.querySelector("#removePhotoBtn"),
    notes: document.querySelector("#notesInput")
  }
};

let items = loadItems();
let activeFilter = "all";
let currentPhoto = "";

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

render();

els.addBtn.addEventListener("click", () => openEditor());
els.emptyAddBtn.addEventListener("click", () => openEditor());
els.closeDialogBtn.addEventListener("click", () => els.itemDialog.close());
els.closeBackupBtn.addEventListener("click", () => els.backupDialog.close());
els.backupBtn.addEventListener("click", () => els.backupDialog.showModal());
els.searchInput.addEventListener("input", render);
els.fields.photo.addEventListener("change", handlePhotoSelect);
els.fields.removePhotoBtn.addEventListener("click", () => {
  els.fields.photo.value = "";
  setPhoto("");
});

els.filters.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    els.filters.forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

els.itemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const item = readForm();
  const existingIndex = items.findIndex((entry) => entry.id === item.id);

  if (existingIndex >= 0) {
    items[existingIndex] = item;
  } else {
    items.unshift(item);
  }

  saveItems();
  els.itemDialog.close();
  render();
});

els.deleteBtn.addEventListener("click", () => {
  const id = els.fields.id.value;
  if (!id) {
    els.itemDialog.close();
    return;
  }

  if (!confirm("确定删除这条物品记录吗？")) return;

  items = items.filter((item) => item.id !== id);
  saveItems();
  els.itemDialog.close();
  render();
});

els.exportBtn.addEventListener("click", () => {
  const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `物品库存备份-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

els.importInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(imported)) throw new Error("Invalid backup");

    const byId = new Map(items.map((item) => [item.id, item]));
    imported.map(normalizeItem).forEach((item) => byId.set(item.id, item));
    items = [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    saveItems();
    render();
    els.backupDialog.close();
  } catch {
    alert("备份文件无法识别，请选择之前导出的 JSON 文件。");
  } finally {
    event.target.value = "";
  }
});

function render() {
  const query = els.searchInput.value.trim().toLowerCase();
  const enriched = items.map((item) => ({ ...item, status: getStatus(item) }));
  const visible = enriched.filter((item) => matchesQuery(item, query) && matchesFilter(item));

  els.totalCount.textContent = items.length;
  els.expiringCount.textContent = enriched.filter((item) => item.status.kind === "expiring").length;
  els.lowCount.textContent = enriched.filter((item) => item.status.low).length;
  els.itemsList.innerHTML = "";
  els.emptyState.hidden = visible.length > 0;

  visible.forEach((item) => els.itemsList.append(renderItem(item)));
}

function renderItem(item) {
  const node = els.itemTemplate.content.firstElementChild.cloneNode(true);
  const category = node.querySelector(".category-cell");
  const itemName = node.querySelector(".item-name");
  const photo = node.querySelector(".item-photo");
  const nameText = node.querySelector(".name-text");
  const location = node.querySelector(".location-cell");
  const pill = node.querySelector(".status-pill");
  const quantity = node.querySelector(".quantity-value");
  const decrease = node.querySelector(".decrease");
  const increase = node.querySelector(".increase");

  category.textContent = item.category || "其他";
  nameText.textContent = item.name;
  photo.hidden = !item.photo;
  photo.src = item.photo || "";
  photo.alt = item.photo ? `${item.name}照片` : "";
  itemName.classList.toggle("no-photo", !item.photo);
  location.textContent = item.location || "未记录";
  quantity.textContent = `${item.quantity}${item.unit || ""}`;
  pill.textContent = item.status.label;
  pill.classList.toggle("alert", item.status.kind === "expired" || item.status.kind === "expiring");
  pill.classList.toggle("warning", item.status.kind === "low");
  itemName.title = buildDetails(item);

  itemName.addEventListener("click", () => openEditor(item));
  decrease.addEventListener("click", () => adjustQuantity(item.id, -1));
  increase.addEventListener("click", () => adjustQuantity(item.id, 1));
  return node;
}

function openEditor(item) {
  const isEditing = Boolean(item);
  els.dialogTitle.textContent = isEditing ? "编辑物品" : "新增物品";
  els.deleteBtn.hidden = !isEditing;
  els.fields.id.value = item?.id || "";
  els.fields.name.value = item?.name || "";
  els.fields.quantity.value = item?.quantity ?? 1;
  els.fields.unit.value = item?.unit || "";
  els.fields.min.value = item?.min ?? 1;
  els.fields.expiry.value = item?.expiry || "";
  els.fields.location.value = item?.location || "";
  els.fields.category.value = item?.category || "其他";
  els.fields.photo.value = "";
  setPhoto(item?.photo || "");
  els.fields.notes.value = item?.notes || "";
  els.itemDialog.showModal();
  els.fields.name.focus();
}

function readForm() {
  return normalizeItem({
    id: els.fields.id.value || createId(),
    name: els.fields.name.value.trim(),
    quantity: Number(els.fields.quantity.value || 0),
    unit: els.fields.unit.value.trim(),
    min: Number(els.fields.min.value || 0),
    expiry: els.fields.expiry.value,
    location: els.fields.location.value.trim(),
    category: els.fields.category.value,
    photo: currentPhoto,
    notes: els.fields.notes.value.trim(),
    updatedAt: new Date().toISOString()
  });
}

function normalizeItem(item) {
  return {
    id: item.id || createId(),
    name: String(item.name || "未命名物品").trim(),
    quantity: Math.max(0, Number(item.quantity || 0)),
    unit: String(item.unit || "").trim(),
    min: Math.max(0, Number(item.min || 0)),
    expiry: item.expiry || "",
    location: String(item.location || "").trim(),
    category: String(item.category || "其他").trim(),
    photo: String(item.photo || ""),
    notes: String(item.notes || "").trim(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

async function handlePhotoSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const photo = await resizePhoto(file);
    setPhoto(photo);
  } catch {
    alert("照片无法读取，请重新拍摄或选择一张图片。");
  }
}

function setPhoto(photo) {
  currentPhoto = photo;
  els.fields.photoPreview.hidden = !photo;
  els.fields.photoPreviewImg.src = photo || "";
}

function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function adjustQuantity(id, delta) {
  items = items.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      quantity: Math.max(0, Number(item.quantity) + delta),
      updatedAt: new Date().toISOString()
    };
  });
  saveItems();
  render();
}

function getStatus(item) {
  const low = Number(item.quantity) <= Number(item.min);
  const days = daysUntil(item.expiry);

  if (days !== null && days < 0) return { kind: "expired", label: "已过期", low };
  if (days !== null && days <= 30) return { kind: "expiring", label: `${days}天到期`, low };
  if (low) return { kind: "low", label: "低库存", low };
  return { kind: "ok", label: "正常", low };
}

function matchesQuery(item, query) {
  if (!query) return true;
  return [item.name, item.location, item.category, item.notes]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function matchesFilter(item) {
  if (activeFilter === "all") return true;
  if (activeFilter === "low") return item.status.low;
  return item.status.kind === activeFilter;
}

function buildDetails(item) {
  const parts = [`库存 ${item.quantity}${item.unit || ""}`];
  if (item.location) parts.push(`位置 ${item.location}`);
  if (item.expiry) parts.push(`有效期 ${item.expiry}`);
  if (Number(item.min) > 0) parts.push(`低库存线 ${item.min}${item.unit || ""}`);
  return parts.join(" · ");
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${dateString}T00:00:00`);
  return Math.ceil((date - today) / MS_PER_DAY);
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "今天";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").map(normalizeItem);
  } catch {
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
