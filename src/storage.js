const DB_NAME = "roda-certa-db";
const DB_VERSION = 1;
const STORE_SHIFTS = "shifts";
const STORE_SETTINGS = "settings";

export const DEFAULT_SETTINGS = {
  fuelPrice: 5.8,
  targetConsumption: 10,
  insuranceMonthly: 0,
  maintenancePerKm: 0.25,
  cleaningMonthly: 0,
  otherMonthly: 0,
  minimumHourlyProfit: 20,
  goodHourlyProfit: 35,
  monthlyNetGoal: 0,
  goalCycleStart: "",
  goalDueDate: ""
};

let db;
let mode = "indexeddb";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const nextDb = request.result;
      if (!nextDb.objectStoreNames.contains(STORE_SHIFTS)) {
        nextDb.createObjectStore(STORE_SHIFTS, { keyPath: "id" });
      }
      if (!nextDb.objectStoreNames.contains(STORE_SETTINGS)) {
        nextDb.createObjectStore(STORE_SETTINGS, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function objectStore(storeName, transactionMode = "readonly") {
  return db.transaction(storeName, transactionMode).objectStore(storeName);
}

function localKey(storeName) {
  return `roda-certa-${storeName}`;
}

function getLocalData(storeName) {
  return JSON.parse(localStorage.getItem(localKey(storeName)) || "[]");
}

function setLocalData(storeName, value) {
  localStorage.setItem(localKey(storeName), JSON.stringify(value));
}

async function getAll(storeName) {
  if (mode === "localstorage") return getLocalData(storeName);

  return new Promise((resolve, reject) => {
    const request = objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put(storeName, value) {
  if (mode === "localstorage") {
    const data = getLocalData(storeName);
    const index = data.findIndex((item) => item.id === value.id);
    if (index >= 0) data[index] = value;
    else data.push(value);
    setLocalData(storeName, data);
    return value.id;
  }

  return new Promise((resolve, reject) => {
    const request = objectStore(storeName, "readwrite").put(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function remove(storeName, id) {
  if (mode === "localstorage") {
    setLocalData(storeName, getLocalData(storeName).filter((item) => item.id !== id));
    return;
  }

  return new Promise((resolve, reject) => {
    const request = objectStore(storeName, "readwrite").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clear(storeName) {
  if (mode === "localstorage") {
    setLocalData(storeName, []);
    return;
  }

  return new Promise((resolve, reject) => {
    const request = objectStore(storeName, "readwrite").clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function initStorage() {
  try {
    db = await openDatabase();
    mode = "indexeddb";
  } catch (error) {
    console.warn("IndexedDB indisponível; usando localStorage.", error);
    mode = "localstorage";
  }
}

export async function loadData() {
  const [storedSettings, shifts] = await Promise.all([
    getAll(STORE_SETTINGS),
    getAll(STORE_SHIFTS)
  ]);
  return {
    settings: { ...DEFAULT_SETTINGS, ...(storedSettings[0] || {}) },
    shifts
  };
}

export async function saveShift(shift) {
  await put(STORE_SHIFTS, shift);
}

export async function deleteShift(id) {
  await remove(STORE_SHIFTS, id);
}

export async function saveSettings(settings) {
  await put(STORE_SETTINGS, { ...settings, id: "main" });
}

export async function replaceAll({ settings, shifts }) {
  await clear(STORE_SHIFTS);
  await clear(STORE_SETTINGS);
  await saveSettings({ ...DEFAULT_SETTINGS, ...settings });
  for (const shift of shifts) {
    await saveShift({ ...shift, id: shift.id || crypto.randomUUID() });
  }
}
