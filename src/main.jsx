import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  BellRing,
  CalendarDays,
  Car,
  CircleDollarSign,
  Clock3,
  Download,
  Fuel,
  Gauge,
  LayoutDashboard,
  Plus,
  ReceiptText,
  Settings,
  Target,
  Trash2,
  Upload,
  WalletCards
} from "lucide-react";
import {
  DEFAULT_APPS,
  calculateShift,
  classifyShift,
  dateFormatter,
  formatMoney,
  getGoalCycle,
  getTotals,
  groupDaily,
  groupEfficiency,
  parseDate,
  todayISO
} from "./calculations";
import {
  DEFAULT_SETTINGS,
  deleteShift,
  initStorage,
  loadData,
  replaceAll,
  saveSettings,
  saveShift
} from "./storage";
import "./styles.css";

const COLORS = ["#18a77f", "#327de8", "#f5a524", "#dc4c64", "#7c66d8", "#00a6a6"];
const BACKUP_LAST_EXPORT_KEY = "roda-certa-last-backup-export";
const BACKUP_SNOOZE_KEY = "roda-certa-backup-reminder-snooze";
const BACKUP_REMINDER_DAYS = 7;

function emptyShift() {
  return {
    id: crypto.randomUUID(),
    date: todayISO(),
    startTime: "",
    endTime: "",
    kmStart: "",
    kmEnd: "",
    fuelFilled: false,
    fuelLiters: "",
    fuelCost: "",
    foodCost: "",
    extraCost: "",
    extraDescription: "",
    notes: "",
    apps: DEFAULT_APPS.map((name) => ({ name, amount: "" }))
  };
}

function formatSettings(settings) {
  return {
    fuelPrice: formatNumber(settings.fuelPrice, 2, true),
    targetConsumption: formatNumber(settings.targetConsumption, 1),
    insuranceMonthly: formatNumber(settings.insuranceMonthly, 2, true),
    maintenancePerKm: formatNumber(settings.maintenancePerKm, 2, true),
    cleaningMonthly: formatNumber(settings.cleaningMonthly, 2, true),
    otherMonthly: formatNumber(settings.otherMonthly, 2, true),
    minimumHourlyProfit: formatNumber(settings.minimumHourlyProfit, 2, true),
    goodHourlyProfit: formatNumber(settings.goodHourlyProfit, 2, true),
    monthlyNetGoal: formatNumber(settings.monthlyNetGoal, 2, true),
    goalCycleStart: settings.goalCycleStart || "",
    goalDueDate: settings.goalDueDate || ""
  };
}

function numberValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number.parseFloat(normalized || "0") || 0;
}

function formatNumber(value, decimals = 2, fixedDecimals = false) {
  const number = numberValue(value);
  if (!number) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: fixedDecimals ? decimals : 0,
    maximumFractionDigits: decimals
  }).format(number);
}

function formatNumericInput(value, decimals = 2) {
  const clean = String(value || "").replace(/[^\d,.]/g, "");
  if (!clean) return "";

  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);
  const hasDecimal = decimalIndex >= 0;
  const integerDigits = (hasDecimal ? clean.slice(0, decimalIndex) : clean).replace(/\D/g, "");
  const decimalDigits = hasDecimal ? clean.slice(decimalIndex + 1).replace(/\D/g, "").slice(0, decimals) : "";
  const integer = new Intl.NumberFormat("pt-BR").format(Number(integerDigits || "0"));

  if (hasDecimal && decimals > 0 && /[,.]$/.test(clean)) return `${integer},`;
  if (decimalDigits) return `${integer},${decimalDigits}`;
  return integer;
}

function formatIntegerInput(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("pt-BR").format(Number(digits));
}

function formatCurrencyInput(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(digits) / 100);
}

function readStoredDate(key) {
  const value = localStorage.getItem(key);
  return value ? new Date(value) : null;
}

function daysSince(date) {
  if (!date || Number.isNaN(date.getTime())) return Infinity;
  return (Date.now() - date.getTime()) / 86400000;
}

function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [shifts, setShifts] = useState([]);
  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState(() => formatSettings(DEFAULT_SETTINGS));
  const [draft, setDraft] = useState(emptyShift);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [ready, setReady] = useState(false);
  const [backupReminder, setBackupReminder] = useState(() => ({
    lastExportAt: readStoredDate(BACKUP_LAST_EXPORT_KEY),
    snoozedUntil: readStoredDate(BACKUP_SNOOZE_KEY)
  }));

  const totals = useMemo(() => getTotals(shifts, settings), [shifts, settings]);
  const goalCycle = useMemo(() => getGoalCycle(settings), [settings]);
  const cycleShifts = useMemo(() => shifts.filter((shift) => shift.date >= goalCycle.startDate && shift.date <= goalCycle.dueDate), [shifts, goalCycle]);
  const cycleTotals = useMemo(() => getTotals(cycleShifts, settings), [cycleShifts, settings]);
  const preview = useMemo(() => calculateShift(normalizeShift(draft), settings), [draft, settings]);
  const dailyData = useMemo(() => groupDaily(shifts, settings), [shifts, settings]);
  const efficiencyData = useMemo(() => groupEfficiency(shifts, settings), [shifts, settings]);
  const appData = useMemo(() => Object.entries(totals.apps)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value })), [totals]);
  const costData = useMemo(() => [
    { name: "Combustível", value: totals.fuelCosts },
    { name: "Manutenção", value: totals.maintenance },
    { name: "Fixos", value: totals.fixedCosts },
    { name: "Alimentação", value: totals.foodCosts },
    { name: "Extras", value: totals.extraCosts }
  ].filter((item) => item.value > 0), [totals]);

  useEffect(() => {
    initStorage()
      .then(loadAndApplyData)
      .then((data) => {
        setShifts(data.shifts);
        setSettingsState(data.settings);
        setSettingsDraft(formatSettings(data.settings));
        setReady(true);
      })
      .catch(() => notify("Não foi possível iniciar o banco local."));
  }, []);

  async function loadAndApplyData() {
    const data = await loadData();
    const cycle = getGoalCycle(data.settings);
    const nextSettings = {
      ...data.settings,
      goalCycleStart: cycle.startDate,
      goalDueDate: cycle.dueDate
    };

    if (nextSettings.goalCycleStart !== data.settings.goalCycleStart || nextSettings.goalDueDate !== data.settings.goalDueDate) {
      await saveSettings(nextSettings);
    }

    return { ...data, settings: nextSettings };
  }

  function notify(message) {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(""), 2800);
  }

  function shouldShowBackupReminder() {
    if (!shifts.length) return false;
    if (backupReminder.snoozedUntil && backupReminder.snoozedUntil > new Date()) return false;
    return daysSince(backupReminder.lastExportAt) >= BACKUP_REMINDER_DAYS;
  }

  function snoozeBackupReminder() {
    const tomorrow = new Date(Date.now() + 86400000);
    localStorage.setItem(BACKUP_SNOOZE_KEY, tomorrow.toISOString());
    setBackupReminder((current) => ({ ...current, snoozedUntil: tomorrow }));
    notify("Tudo bem, eu lembro você novamente amanhã.");
  }

  async function refresh() {
    const data = await loadAndApplyData();
    setShifts(data.shifts);
    setSettingsState(data.settings);
    setSettingsDraft(formatSettings(data.settings));
  }

  async function handleSaveShift(event) {
    event.preventDefault();
    const shift = normalizeShift(draft);
    if (!shift.date) return notify("Informe a data do expediente.");
    if (shift.kmEnd <= shift.kmStart) return notify("O KM final precisa ser maior que o KM inicial.");
    if ((shift.startTime && !shift.endTime) || (!shift.startTime && shift.endTime)) return notify("Informe início e fim para calcular as horas.");
    if (!shift.apps.length || shift.apps.every((app) => app.amount <= 0)) return notify("Informe o faturamento de pelo menos um app.");
    if (shift.fuelFilled && (!shift.fuelLiters || !shift.fuelCost)) return notify("Informe os litros e o valor do abastecimento.");

    await saveShift({
      ...shift,
      createdAt: shift.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await refresh();
    setDraft(emptyShift());
    notify("Expediente salvo com sucesso.");
    setActiveView("dashboard");
  }

  async function handleSaveSettings(event) {
    event.preventDefault();
    const nextSettings = {
      fuelPrice: numberValue(settingsDraft.fuelPrice),
      targetConsumption: numberValue(settingsDraft.targetConsumption),
      insuranceMonthly: numberValue(settingsDraft.insuranceMonthly),
      maintenancePerKm: numberValue(settingsDraft.maintenancePerKm),
      cleaningMonthly: numberValue(settingsDraft.cleaningMonthly),
      otherMonthly: numberValue(settingsDraft.otherMonthly),
      minimumHourlyProfit: numberValue(settingsDraft.minimumHourlyProfit),
      goodHourlyProfit: numberValue(settingsDraft.goodHourlyProfit),
      monthlyNetGoal: numberValue(settingsDraft.monthlyNetGoal),
      goalCycleStart: settingsDraft.goalCycleStart || todayISO(),
      goalDueDate: settingsDraft.goalDueDate || settings.goalDueDate
    };
    if (nextSettings.goalDueDate < nextSettings.goalCycleStart) return notify("A data final da meta precisa ser igual ou posterior ao início.");
    await saveSettings(nextSettings);
    await refresh();
    notify("Custos fixos salvos.");
  }

  function updateDraft(field, value) {
    setDraft((current) => {
      if (field === "fuelFilled" && !value) {
        return { ...current, fuelFilled: false, fuelLiters: "", fuelCost: "" };
      }
      return { ...current, [field]: value };
    });
  }

  function updateApp(index, field, value) {
    setDraft((current) => ({
      ...current,
      apps: current.apps.map((app, appIndex) => appIndex === index ? { ...app, [field]: value } : app)
    }));
  }

  function addApp() {
    setDraft((current) => ({ ...current, apps: [...current.apps, { name: "", amount: "" }] }));
  }

  function removeApp(index) {
    setDraft((current) => {
      const apps = current.apps.filter((_, appIndex) => appIndex !== index);
      return { ...current, apps: apps.length ? apps : [{ name: "", amount: "" }] };
    });
  }

  function editShift(shift) {
    setDraft({
      ...shift,
      startTime: shift.startTime || "",
      endTime: shift.endTime || "",
      kmStart: formatNumber(shift.kmStart, 0),
      kmEnd: formatNumber(shift.kmEnd, 0),
      fuelFilled: shift.fuelFilled ?? (Number(shift.fuelLiters || 0) > 0 || Number(shift.fuelCost || 0) > 0),
      fuelLiters: formatNumber(shift.fuelLiters, 2),
      fuelCost: formatNumber(shift.fuelCost, 2, true),
      foodCost: formatNumber(shift.foodCost, 2, true),
      extraCost: formatNumber(shift.extraCost, 2, true),
      apps: shift.apps.map((app) => ({ ...app, amount: formatNumber(app.amount, 2, true) }))
    });
    setActiveView("shift");
    notify("Expediente carregado para edição.");
  }

  async function removeShift(id) {
    const shift = shifts.find((item) => item.id === id);
    if (!shift) return;
    if (!window.confirm(`Excluir o expediente de ${dateFormatter.format(parseDate(shift.date))}?`)) return;
    await deleteShift(id);
    await refresh();
    notify("Expediente excluído.");
  }

  function exportBackup() {
    const backup = {
      app: "Roda Certa",
      version: 2,
      exportedAt: new Date().toISOString(),
      settings,
      shifts
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `roda-certa-backup-${todayISO()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    const now = new Date();
    localStorage.setItem(BACKUP_LAST_EXPORT_KEY, now.toISOString());
    localStorage.removeItem(BACKUP_SNOOZE_KEY);
    setBackupReminder({ lastExportAt: now, snoozedUntil: null });
    notify("Backup exportado. Salve uma cópia no Drive, OneDrive ou pendrive.");
  }

  async function importBackup(file) {
    try {
      const backup = JSON.parse(await file.text());
      if (!backup || !Array.isArray(backup.shifts) || !backup.settings) {
        throw new Error("Arquivo inválido.");
      }
      await replaceAll(backup);
      await refresh();
      notify("Backup importado com sucesso.");
    } catch {
      notify("Não foi possível importar o backup.");
    }
  }

  const months = [...new Set(shifts.map((shift) => shift.date.slice(0, 7)))].sort().reverse();
  const filteredShifts = shifts
    .filter((shift) => !month || shift.date.startsWith(month))
    .filter((shift) => {
      const haystack = [shift.notes, shift.extraDescription, ...(shift.apps || []).map((app) => app.name)].join(" ").toLowerCase();
      return !search || haystack.includes(search.toLowerCase());
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!ready) {
    return <div className="loading-screen">Carregando Roda Certa...</div>;
  }

  return (
    <>
      <header className="app-header">
        <div>
          <p className="eyebrow">Controle local para motoristas</p>
          <h1>Roda Certa</h1>
        </div>
        <div className="header-actions">
          <button className="icon-btn" type="button" onClick={exportBackup} title="Exportar backup" aria-label="Exportar backup">
            <Download size={20} />
          </button>
          <label className="icon-btn" title="Importar backup" aria-label="Importar backup">
            <Upload size={20} />
            <input type="file" accept="application/json" onChange={(event) => event.target.files?.[0] && importBackup(event.target.files[0])} />
          </label>
        </div>
      </header>

      <main className="app-shell">
        <nav className="tabs" aria-label="Áreas do aplicativo">
          <Tab active={activeView === "dashboard"} icon={LayoutDashboard} label="Dashboard" onClick={() => setActiveView("dashboard")} />
          <Tab active={activeView === "shift"} icon={CalendarDays} label="Expediente" onClick={() => setActiveView("shift")} />
          <Tab active={activeView === "history"} icon={ReceiptText} label="Histórico" onClick={() => setActiveView("history")} />
          <Tab active={activeView === "settings"} icon={Settings} label="Custos" onClick={() => setActiveView("settings")} />
        </nav>

        {shouldShowBackupReminder() && (
          <BackupReminder
            lastExportAt={backupReminder.lastExportAt}
            onExport={exportBackup}
            onSnooze={snoozeBackupReminder}
          />
        )}

        {activeView === "dashboard" && (
          <Dashboard
            totals={totals}
            cycleTotals={cycleTotals}
            goalCycle={goalCycle}
            shifts={shifts}
            settings={settings}
            dailyData={dailyData}
            appData={appData}
            costData={costData}
            efficiencyData={efficiencyData}
            onNewShift={() => setActiveView("shift")}
          />
        )}

        {activeView === "shift" && (
          <ShiftForm
            draft={draft}
            settings={settings}
            preview={preview}
            onSubmit={handleSaveShift}
            onChange={updateDraft}
            onAppChange={updateApp}
            onAddApp={addApp}
            onRemoveApp={removeApp}
            onReset={() => setDraft(emptyShift())}
          />
        )}

        {activeView === "history" && (
          <History
            shifts={filteredShifts}
            months={months}
            month={month}
            search={search}
            settings={settings}
            onMonth={setMonth}
            onSearch={setSearch}
            onEdit={editShift}
            onDelete={removeShift}
          />
        )}

        {activeView === "settings" && (
          <SettingsView
            settings={settingsDraft}
            onChange={(field, value) => setSettingsDraft((current) => ({ ...current, [field]: value }))}
            onSubmit={handleSaveSettings}
          />
        )}
      </main>

      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}

function BackupReminder({ lastExportAt, onExport, onSnooze }) {
  const lastBackupText = lastExportAt
    ? `Último backup exportado há ${Math.floor(daysSince(lastExportAt))} dia${Math.floor(daysSince(lastExportAt)) === 1 ? "" : "s"}.`
    : "Você ainda não exportou nenhum backup.";

  return (
    <section className="backup-reminder" aria-label="Lembrete de backup">
      <div className="backup-reminder-icon">
        <BellRing size={22} />
      </div>
      <div>
        <strong>Lembrete de segurança dos dados</strong>
        <p>{lastBackupText} Exporte o arquivo e salve uma cópia no Google Drive, OneDrive, Dropbox ou pendrive.</p>
      </div>
      <div className="backup-reminder-actions">
        <button className="primary-btn" type="button" onClick={onExport}>
          <Download size={17} />
          Exportar backup
        </button>
        <button className="ghost-btn" type="button" onClick={onSnooze}>Lembrar amanhã</button>
      </div>
    </section>
  );
}

function Tab({ active, icon: Icon, label, onClick }) {
  return (
    <button className={`tab ${active ? "active" : ""}`} type="button" onClick={onClick}>
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}

function Dashboard({ totals, cycleTotals, goalCycle, shifts, settings, dailyData, appData, costData, efficiencyData, onNewShift }) {
  const avgConsumption = totals.consumptionLiters > 0 ? totals.consumptionKm / totals.consumptionLiters : 0;
  const margin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  const profitPerHour = totals.hours > 0 ? totals.profit / totals.hours : 0;
  const bestApp = appData[0];
  const dates = shifts.map((shift) => shift.date).sort();
  const period = dates.length
    ? `${dateFormatter.format(parseDate(dates[0]))} a ${dateFormatter.format(parseDate(dates[dates.length - 1]))}`
    : "Sem expedientes lançados";
  const bestDay = shifts.map((shift) => ({ shift, calc: calculateShift(shift, settings) })).sort((a, b) => b.calc.profit - a.calc.profit)[0];
  const worstDay = shifts.map((shift) => ({ shift, calc: calculateShift(shift, settings) })).sort((a, b) => a.calc.profit - b.calc.profit)[0];
  const goalRemaining = Math.max(0, goalCycle.target - cycleTotals.profit);
  const goalProgress = goalCycle.target > 0 ? Math.min(100, (cycleTotals.profit / goalCycle.target) * 100) : 0;
  const dailyGoal = goalCycle.daysLeft > 0 ? goalRemaining / goalCycle.daysLeft : goalRemaining;

  return (
    <section className="dashboard">
      <section className="hero-panel">
        <div>
          <p className="eyebrow dark">Painel financeiro</p>
          <h2>Resultado da operação</h2>
          <p>{period}</p>
        </div>
        <div className="hero-stack">
          <span>Lucro líquido</span>
          <strong>{formatMoney(totals.profit)}</strong>
          <small>{shifts.length} expediente{shifts.length === 1 ? "" : "s"} salvo{shifts.length === 1 ? "" : "s"}</small>
        </div>
        <button className="floating-action" type="button" onClick={onNewShift}>
          <Plus size={20} />
          Novo expediente
        </button>
      </section>

      <section className="metric-grid">
        <Metric icon={CircleDollarSign} label="Faturamento" value={formatMoney(totals.revenue)} hint={bestApp ? `Maior app: ${bestApp.name}` : "Aguardando apps"} />
        <Metric icon={WalletCards} label="Custos totais" value={formatMoney(totals.costs)} hint={totals.revenue ? `Margem líquida ${margin.toFixed(1)}%` : "Sem margem ainda"} />
        <Metric icon={Car} label="Custo por km" value={totals.km ? formatMoney(totals.costs / totals.km) : formatMoney(0)} hint={`${totals.km.toFixed(1)} km rodados`} />
        <Metric icon={Clock3} label="Lucro por hora" value={formatMoney(profitPerHour)} hint={`${totals.hours.toFixed(1)} h trabalhadas`} />
        <Metric icon={Gauge} label="Consumo médio" value={`${avgConsumption.toFixed(1)} km/L`} hint={`${totals.estimatedFuelLiters.toFixed(1)} L estimados`} />
        <Metric icon={Target} label="Meta do ciclo" value={`${goalProgress.toFixed(0)}%`} hint={goalCycle.target > 0 ? `${formatMoney(dailyGoal)} líquidos/dia` : "Configure uma meta"} />
      </section>

      <GoalPanel
        cycle={goalCycle}
        totals={cycleTotals}
        progress={goalProgress}
        remaining={goalRemaining}
        dailyGoal={dailyGoal}
      />

      <section className="chart-grid">
        <ChartCard className="wide" title="Lucro e faturamento por dia" note={dailyData.length ? "Últimos lançamentos" : "Sem dados"}>
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={dailyData}>
              <defs>
                <linearGradient id="profitFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#18a77f" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#18a77f" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e7ecef" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => `R$${value}`} tickLine={false} axisLine={false} width={64} />
              <Tooltip formatter={(value) => formatMoney(value)} />
              <Legend />
              <Bar dataKey="revenue" name="Faturamento" fill="#327de8" radius={[6, 6, 0, 0]} />
              <Area dataKey="profit" name="Lucro" stroke="#18a77f" fill="url(#profitFill)" strokeWidth={3} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Faturamento por app" note={`${appData.length} app${appData.length === 1 ? "" : "s"}`}>
          <ResponsiveContainer width="100%" height={310}>
            <PieChart>
              <Pie data={appData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={112} paddingAngle={3}>
                {appData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value) => formatMoney(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Composição dos custos" note={formatMoney(totals.costs)}>
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={costData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke="#e7ecef" horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => `R$${value}`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={92} />
              <Tooltip formatter={(value) => formatMoney(value)} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {costData.map((entry, index) => <Cell key={entry.name} fill={COLORS[(index + 2) % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard className="wide" title="Consumo e eficiência" note={`Meta ${settings.targetConsumption.toFixed(1)} km/L`}>
          <ResponsiveContainer width="100%" height={290}>
            <AreaChart data={efficiencyData}>
              <CartesianGrid stroke="#e7ecef" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)} km/L`} />
              <Legend />
              <Line dataKey="meta" name="Meta" stroke="#f5a524" strokeDasharray="7 7" strokeWidth={2} dot={false} />
              <Area dataKey="consumo" name="Consumo" stroke="#18a77f" fill="#18a77f22" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="insight-grid">
        <Insight label="Média faturada" value={formatMoney(shifts.length ? totals.revenue / shifts.length : 0)} />
        <Insight label="Média líquida" value={formatMoney(shifts.length ? totals.profit / shifts.length : 0)} />
        <Insight label="Horas trabalhadas" value={`${totals.hours.toFixed(1)} h`} />
        <Insight label="Faturamento por km" value={formatMoney(totals.km ? totals.revenue / totals.km : 0)} />
        <Insight label="Peso do combustível" value={`${(totals.costs ? (totals.fuelCosts / totals.costs) * 100 : 0).toFixed(1)}%`} />
        <Insight label="Abastecido no período" value={`${totals.purchasedFuelLiters.toFixed(1)} L · ${formatMoney(totals.fuelPaidCosts)}`} />
        <Insight label="Melhor expediente" value={bestDay ? `${dateFormatter.format(parseDate(bestDay.shift.date))} · ${formatMoney(bestDay.calc.profit)}` : "Sem dados"} />
        <Insight label="Pior expediente" value={worstDay ? `${dateFormatter.format(parseDate(worstDay.shift.date))} · ${formatMoney(worstDay.calc.profit)}` : "Sem dados"} />
      </section>
    </section>
  );
}

function Metric({ icon: Icon, label, value, hint }) {
  return (
    <article className="metric-card">
      <div className="metric-icon"><Icon size={20} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function GoalPanel({ cycle, totals, progress, remaining, dailyGoal }) {
  const hasGoal = cycle.target > 0;
  const statusText = hasGoal
    ? `${formatMoney(totals.profit)} de ${formatMoney(cycle.target)}`
    : "Defina uma meta líquida em Custos";

  return (
    <section className="panel goal-panel">
      <div className="goal-main">
        <div>
          <p className="eyebrow dark">Meta líquida do ciclo</p>
          <h3>{statusText}</h3>
          <span>{dateFormatter.format(parseDate(cycle.startDate))} a {dateFormatter.format(parseDate(cycle.dueDate))}</span>
        </div>
        <strong>{progress.toFixed(0)}%</strong>
      </div>
      <div className="goal-progress" aria-label="Progresso da meta">
        <div style={{ width: `${progress}%` }} />
      </div>
      <div className="goal-stats">
        <Insight label="Falta para a meta" value={formatMoney(remaining)} />
        <Insight label="Necessário por dia" value={hasGoal ? formatMoney(dailyGoal) : formatMoney(0)} />
        <Insight label="Dias restantes" value={`${cycle.daysLeft} dia${cycle.daysLeft === 1 ? "" : "s"}`} />
      </div>
    </section>
  );
}

function ChartCard({ title, note, children, className = "" }) {
  return (
    <article className={`panel chart-card ${className}`}>
      <div className="panel-head">
        <h3>{title}</h3>
        <span>{note}</span>
      </div>
      {children}
    </article>
  );
}

function Insight({ label, value }) {
  return (
    <article className="insight-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ShiftForm({ draft, settings, preview, onSubmit, onChange, onAppChange, onAddApp, onRemoveApp, onReset }) {
  const dayStatus = classifyShift(preview, settings);

  return (
    <form className="work-grid" onSubmit={onSubmit}>
      <section className="panel form-panel">
        <div className="panel-head">
          <h2>Lançamento do dia</h2>
          <button className="ghost-btn" type="button" onClick={onReset}>Limpar</button>
        </div>

        <div className="form-grid">
          <Field label="Data" type="date" value={draft.date} onChange={(value) => onChange("date", value)} />
          <Field label="Início" type="time" value={draft.startTime || ""} onChange={(value) => onChange("startTime", value)} />
          <Field label="Fim" type="time" value={draft.endTime || ""} onChange={(value) => onChange("endTime", value)} />
          <NumericField label="KM inicial" value={draft.kmStart} mode="integer" suffix="km" onChange={(value) => onChange("kmStart", value)} />
          <NumericField label="KM final" value={draft.kmEnd} mode="integer" suffix="km" onChange={(value) => onChange("kmEnd", value)} />
          <CheckboxField label="Teve abastecimento hoje" checked={Boolean(draft.fuelFilled)} onChange={(value) => onChange("fuelFilled", value)} />
          {draft.fuelFilled && (
            <>
              <NumericField label="Litros abastecidos" value={draft.fuelLiters} mode="decimal" decimals={2} suffix="L" onChange={(value) => onChange("fuelLiters", value)} />
              <NumericField label="Valor pago no abastecimento" value={draft.fuelCost} mode="currency" prefix="R$" onChange={(value) => onChange("fuelCost", value)} />
            </>
          )}
          <NumericField label="Alimentação fora" value={draft.foodCost} mode="currency" prefix="R$" onChange={(value) => onChange("foodCost", value)} />
          <NumericField label="Gasto extra" value={draft.extraCost} mode="currency" prefix="R$" onChange={(value) => onChange("extraCost", value)} />
          <Field label="Descrição do extra" value={draft.extraDescription} onChange={(value) => onChange("extraDescription", value)} placeholder="Pedágio, multa, lavagem..." />
        </div>

        <div className="apps-header">
          <h3>Faturamento por app</h3>
          <button className="ghost-btn" type="button" onClick={onAddApp}><Plus size={16} />Adicionar</button>
        </div>
        <div className="app-rows">
          {draft.apps.map((app, index) => (
            <div className="app-row" key={`app-row-${index}`}>
              <Field label="App" value={app.name} onChange={(value) => onAppChange(index, "name", value)} placeholder="Uber, 99, Lalamove..." />
              <NumericField label="Valor" value={app.amount} mode="currency" prefix="R$" onChange={(value) => onAppChange(index, "amount", value)} />
              <button className="danger-icon" type="button" onClick={() => onRemoveApp(index)} aria-label="Remover app"><Trash2 size={18} /></button>
            </div>
          ))}
        </div>

        <label className="field full">
          <span>Observações</span>
          <textarea value={draft.notes} onChange={(event) => onChange("notes", event.target.value)} rows="3" placeholder="Chuva, promoção, rota ruim, manutenção percebida..." />
        </label>

        <div className="form-actions">
          <button className="primary-btn" type="submit">Salvar expediente</button>
        </div>
      </section>

      <aside className="panel preview-panel">
        <h2>Prévia automática</h2>
        <PreviewLine label="KM rodados" value={`${preview.km.toFixed(1)} km`} />
        <PreviewLine label="Horas trabalhadas" value={`${preview.hours.toFixed(1)} h`} icon={Clock3} />
        <PreviewLine label="Faturamento" value={formatMoney(preview.revenue)} />
        <PreviewLine label="Lucro por hora" value={formatMoney(preview.profitPerHour)} icon={Clock3} />
        <PreviewLine label="Litros estimados" value={`${preview.estimatedFuelLiters.toFixed(2)} L`} icon={Fuel} />
        <PreviewLine label="Combustível consumido" value={formatMoney(preview.fuelCost)} icon={Fuel} />
        {preview.hadFuelPurchase && <PreviewLine label="Abastecimento pago" value={formatMoney(preview.fuelPaidCost)} />}
        <PreviewLine label="Seguro proporcional" value={formatMoney(settings.insuranceMonthly / 30)} />
        <PreviewLine label="Manutenção" value={formatMoney(preview.maintenance)} />
        <PreviewLine label="Outros gastos" value={formatMoney(preview.otherCosts + settings.cleaningMonthly / 30 + settings.otherMonthly / 30)} />
        <div className="preview-total">
          <span>Lucro líquido</span>
          <strong>{formatMoney(preview.profit)}</strong>
        </div>
        <div className={`status-pill ${preview.profit > 0 ? "good" : "warn"}`}>
          {preview.consumption > 0 ? `Média usada: ${preview.consumption.toFixed(1)} km/L · ${formatMoney(preview.fuelUnitPrice)}/L` : "Preencha os dados do dia"}
        </div>
        <div className={`status-pill ${dayStatus.level}`}>
          {dayStatus.label}: {dayStatus.text}
        </div>
      </aside>
    </form>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="checkbox-field">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function NumericField({ label, value, onChange, mode = "decimal", decimals = 2, prefix = "", suffix = "" }) {
  function formatValue(nextValue) {
    if (mode === "currency") return formatCurrencyInput(nextValue);
    if (mode === "integer") return formatIntegerInput(nextValue);
    return formatNumericInput(nextValue, decimals);
  }

  function formatBlurValue(nextValue) {
    if (mode === "currency") return formatCurrencyInput(nextValue);
    if (mode === "integer") return formatIntegerInput(nextValue);
    return formatNumber(nextValue, decimals);
  }

  return (
    <label className="field">
      <span>{label}</span>
      <div className="numeric-input">
        {prefix && <span>{prefix}</span>}
        <input
          type="text"
          inputMode="decimal"
          value={value}
          placeholder="0"
          onChange={(event) => onChange(formatValue(event.target.value))}
          onBlur={(event) => onChange(formatBlurValue(event.target.value))}
          onFocus={(event) => event.target.select()}
        />
        {suffix && <span>{suffix}</span>}
      </div>
    </label>
  );
}

function PreviewLine({ label, value, icon: Icon }) {
  return (
    <div className="preview-line">
      <span>{Icon && <Icon size={15} />} {label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function History({ shifts, months, month, search, settings, onMonth, onSearch, onEdit, onDelete }) {
  return (
    <section className="panel">
      <div className="panel-head history-head">
        <h2>Histórico de expedientes</h2>
        <div className="filters">
          <input type="search" placeholder="Buscar por app ou observação" value={search} onChange={(event) => onSearch(event.target.value)} />
          <select value={month} onChange={(event) => onMonth(event.target.value)}>
            <option value="">Todos os meses</option>
            {months.map((item) => {
              const [year, monthNumber] = item.split("-");
              return <option key={item} value={item}>{monthNumber}/{year}</option>;
            })}
          </select>
        </div>
      </div>
      <div className="history-list">
        {!shifts.length && <div className="empty">Nenhum expediente encontrado.</div>}
        {shifts.map((shift) => {
          const calc = calculateShift(shift, settings);
          const dayStatus = classifyShift(calc, settings);
          return (
            <article className="history-card" key={shift.id}>
              <div>
                <h3>{dateFormatter.format(parseDate(shift.date))}</h3>
                <div className="tags">
                  <span>{calc.km.toFixed(1)} km</span>
                  {calc.hours > 0 && <span>{calc.hours.toFixed(1)} h</span>}
                  {calc.hours > 0 && <span>{formatMoney(calc.profitPerHour)}/h</span>}
                  <span>{dayStatus.label}</span>
                  <span>{formatMoney(calc.revenue)} faturados</span>
                  <span>{formatMoney(calc.totalCosts)} em custos</span>
                  {calc.estimatedFuelLiters > 0 && <span>{calc.estimatedFuelLiters.toFixed(1)} L estimados</span>}
                  {calc.hadFuelPurchase && <span>Abasteceu {calc.purchasedFuelLiters.toFixed(1)} L</span>}
                </div>
                <p>{shift.apps.map((app) => `${app.name}: ${formatMoney(app.amount)}`).join(" | ")}</p>
                {shift.extraDescription && <p>Extra: {shift.extraDescription}</p>}
                {shift.notes && <p>{shift.notes}</p>}
              </div>
              <div className="history-side">
                <span>Lucro líquido</span>
                <strong>{formatMoney(calc.profit)}</strong>
                <div>
                  <button className="ghost-btn" type="button" onClick={() => onEdit(shift)}>Editar</button>
                  <button className="danger-btn" type="button" onClick={() => onDelete(shift.id)}>Excluir</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SettingsView({ settings, onChange, onSubmit }) {
  return (
    <form className="settings-grid" onSubmit={onSubmit}>
      <section className="panel">
        <h2>Parâmetros do veículo</h2>
        <div className="form-grid">
          <NumericField label="Preço médio do combustível" value={settings.fuelPrice} mode="currency" prefix="R$" onChange={(value) => onChange("fuelPrice", value)} />
          <NumericField label="Consumo esperado" value={settings.targetConsumption} mode="decimal" decimals={1} suffix="km/L" onChange={(value) => onChange("targetConsumption", value)} />
          <NumericField label="Seguro mensal" value={settings.insuranceMonthly} mode="currency" prefix="R$" onChange={(value) => onChange("insuranceMonthly", value)} />
          <NumericField label="Manutenção por km" value={settings.maintenancePerKm} mode="currency" prefix="R$" onChange={(value) => onChange("maintenancePerKm", value)} />
          <NumericField label="Lavagem/limpeza mensal" value={settings.cleaningMonthly} mode="currency" prefix="R$" onChange={(value) => onChange("cleaningMonthly", value)} />
          <NumericField label="Outros custos mensais" value={settings.otherMonthly} mode="currency" prefix="R$" onChange={(value) => onChange("otherMonthly", value)} />
          <NumericField label="Mínimo líquido por hora" value={settings.minimumHourlyProfit} mode="currency" prefix="R$" onChange={(value) => onChange("minimumHourlyProfit", value)} />
          <NumericField label="Bom líquido por hora" value={settings.goodHourlyProfit} mode="currency" prefix="R$" onChange={(value) => onChange("goodHourlyProfit", value)} />
          <NumericField label="Meta líquida do ciclo" value={settings.monthlyNetGoal} mode="currency" prefix="R$" onChange={(value) => onChange("monthlyNetGoal", value)} />
          <Field label="Início da meta" type="date" value={settings.goalCycleStart} onChange={(value) => onChange("goalCycleStart", value)} />
          <Field label="Data final da meta" type="date" value={settings.goalDueDate} onChange={(value) => onChange("goalDueDate", value)} />
        </div>
        <div className="form-actions">
          <button className="primary-btn" type="submit">Salvar custos fixos</button>
        </div>
      </section>
      <section className="panel rules-card">
        <h2>Regras de cálculo</h2>
        <p><strong>Combustível:</strong> o lucro usa litros consumidos estimados por KM rodado e consumo esperado. Se houve abastecimento, o valor pago serve para calcular o preço real por litro do dia.</p>
        <p><strong>Fixos:</strong> seguro, limpeza e outros custos mensais são divididos por 30.</p>
        <p><strong>Manutenção:</strong> km rodados multiplicado pelo custo por km configurado.</p>
        <p><strong>Hora trabalhada:</strong> diferença entre início e fim do expediente. Se terminar depois da meia-noite, o sistema considera a virada do dia.</p>
        <p><strong>Qualidade da jornada:</strong> compara lucro líquido por hora com o mínimo e com a meta de dia bom configurados.</p>
        <p><strong>Meta líquida:</strong> acompanha o lucro líquido entre início e data final. Depois que a data final passa, um novo ciclo é aberto com a mesma duração.</p>
        <p><strong>Lucro líquido:</strong> faturamento menos combustível, alimentação, extras, manutenção e custos fixos proporcionais.</p>
      </section>
    </form>
  );
}

function normalizeShift(shift) {
  const fuelFilled = Boolean(shift.fuelFilled);

  return {
    ...shift,
    startTime: shift.startTime || "",
    endTime: shift.endTime || "",
    kmStart: numberValue(shift.kmStart),
    kmEnd: numberValue(shift.kmEnd),
    fuelFilled,
    fuelLiters: fuelFilled ? numberValue(shift.fuelLiters) : 0,
    fuelCost: fuelFilled ? numberValue(shift.fuelCost) : 0,
    foodCost: numberValue(shift.foodCost),
    extraCost: numberValue(shift.extraCost),
    apps: (shift.apps || [])
      .filter((app) => app.name || numberValue(app.amount) > 0)
      .map((app) => ({ name: app.name || "App sem nome", amount: numberValue(app.amount) }))
  };
}

createRoot(document.getElementById("root")).render(<App />);
