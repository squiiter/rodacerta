export const DEFAULT_APPS = ["Uber", "99", "Lalamove"];

export const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

export function parseDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date, days) {
  const nextDate = parseDate(date);
  nextDate.setDate(nextDate.getDate() + days);
  return toISODate(nextDate);
}

export function firstDayOfMonth(date = todayISO()) {
  const baseDate = parseDate(date);
  return toISODate(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
}

export function lastDayOfMonth(date = todayISO()) {
  const baseDate = parseDate(date);
  return toISODate(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0));
}

export function daysBetween(startDate, endDate) {
  return Math.round((parseDate(endDate) - parseDate(startDate)) / 86400000);
}

export function daysUntil(date, fromDate = todayISO()) {
  return Math.max(0, daysBetween(fromDate, date));
}

export function formatMoney(value) {
  return money.format(Number.isFinite(value) ? value : 0);
}

export function fixedDailyCost(settings) {
  return (settings.insuranceMonthly + settings.cleaningMonthly + settings.otherMonthly) / 30;
}

export function calculateHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;

  const start = (startHour * 60) + startMinute;
  let end = (endHour * 60) + endMinute;
  if (end <= start) end += 24 * 60;
  return (end - start) / 60;
}

export function calculateShift(shift, settings) {
  const km = Math.max(0, Number(shift.kmEnd || 0) - Number(shift.kmStart || 0));
  const hours = calculateHours(shift.startTime, shift.endTime);
  const revenue = (shift.apps || []).reduce((total, app) => total + Number(app.amount || 0), 0);
  const purchasedFuelLiters = Number(shift.fuelLiters || 0);
  const fuelPaidCost = Number(shift.fuelCost || 0);
  const isLegacyFuelEntry = shift.fuelFilled === undefined;
  const hadFuelPurchase = shift.fuelFilled === true || (isLegacyFuelEntry && (purchasedFuelLiters > 0 || fuelPaidCost > 0));
  const fuelUnitPrice = purchasedFuelLiters > 0 && fuelPaidCost > 0
    ? fuelPaidCost / purchasedFuelLiters
    : Number(settings.fuelPrice || 0);
  const estimatedFuelLiters = Number(settings.targetConsumption || 0) > 0
    ? km / Number(settings.targetConsumption)
    : 0;
  const estimatedFuelCost = estimatedFuelLiters * fuelUnitPrice;
  const legacyFuelCost = fuelPaidCost > 0 ? fuelPaidCost : estimatedFuelCost;
  const fuelCost = isLegacyFuelEntry ? legacyFuelCost : estimatedFuelCost;
  const maintenance = km * Number(settings.maintenancePerKm || 0);
  const dailyFixed = fixedDailyCost(settings);
  const foodCost = Number(shift.foodCost || 0);
  const extraCost = Number(shift.extraCost || 0);
  const otherCosts = foodCost + extraCost;
  const totalCosts = fuelCost + maintenance + dailyFixed + otherCosts;
  const profit = revenue - totalCosts;
  const revenuePerHour = hours > 0 ? revenue / hours : 0;
  const profitPerHour = hours > 0 ? profit / hours : 0;
  const consumption = isLegacyFuelEntry && purchasedFuelLiters > 0
    ? km / purchasedFuelLiters
    : (estimatedFuelLiters > 0 ? km / estimatedFuelLiters : 0);

  return {
    km,
    hours,
    revenue,
    estimatedFuelLiters,
    estimatedFuelCost,
    fuelUnitPrice,
    fuelPaidCost: hadFuelPurchase ? fuelPaidCost : 0,
    purchasedFuelLiters: hadFuelPurchase ? purchasedFuelLiters : 0,
    hadFuelPurchase,
    fuelCost,
    maintenance,
    dailyFixed,
    foodCost,
    extraCost,
    otherCosts,
    totalCosts,
    profit,
    revenuePerHour,
    profitPerHour,
    consumption
  };
}

export function classifyShift(calc, settings) {
  if (!calc.hours) return { level: "neutral", label: "Sem horário", text: "Informe início e fim" };
  if (calc.profitPerHour >= Number(settings.goodHourlyProfit || 0)) {
    return { level: "good", label: "Dia bom", text: "Acima da meta por hora" };
  }
  if (calc.profitPerHour >= Number(settings.minimumHourlyProfit || 0)) {
    return { level: "medium", label: "Dia médio", text: "Dentro do aceitável" };
  }
  return { level: "bad", label: "Jornada ruim", text: "Abaixo do mínimo por hora" };
}

export function getGoalCycle(settings, date = todayISO()) {
  const target = Number(settings.monthlyNetGoal || 0);
  let startDate = settings.goalCycleStart || firstDayOfMonth(date);
  let dueDate = settings.goalDueDate || lastDayOfMonth(date);

  if (dueDate < startDate) {
    dueDate = addDays(startDate, 29);
  }

  const cycleLength = Math.max(1, daysBetween(startDate, dueDate) + 1);
  while (date > dueDate) {
    startDate = addDays(dueDate, 1);
    dueDate = addDays(startDate, cycleLength - 1);
  }

  return {
    target,
    startDate,
    dueDate,
    daysLeft: daysUntil(dueDate, date) + 1,
    cycleLength
  };
}

export function getTotals(shifts, settings) {
  return shifts.reduce((acc, shift) => {
    const calc = calculateShift(shift, settings);
    acc.revenue += calc.revenue;
    acc.costs += calc.totalCosts;
    acc.profit += calc.profit;
    acc.km += calc.km;
    acc.hours += calc.hours;
    acc.fuelCosts += calc.fuelCost;
    acc.estimatedFuelLiters += calc.estimatedFuelLiters;
    acc.fuelPaidCosts += calc.fuelPaidCost;
    acc.purchasedFuelLiters += calc.purchasedFuelLiters;
    acc.maintenance += calc.maintenance;
    acc.fixedCosts += calc.dailyFixed;
    acc.foodCosts += calc.foodCost;
    acc.extraCosts += calc.extraCost;

    if (calc.consumption > 0 && calc.estimatedFuelLiters > 0) {
      acc.consumptionKm += calc.km;
      acc.consumptionLiters += calc.estimatedFuelLiters;
    }

    (shift.apps || []).forEach((app) => {
      acc.apps[app.name] = (acc.apps[app.name] || 0) + Number(app.amount || 0);
    });

    return acc;
  }, {
    revenue: 0,
    costs: 0,
    profit: 0,
    km: 0,
    hours: 0,
    fuelCosts: 0,
    estimatedFuelLiters: 0,
    fuelPaidCosts: 0,
    purchasedFuelLiters: 0,
    maintenance: 0,
    fixedCosts: 0,
    foodCosts: 0,
    extraCosts: 0,
    consumptionKm: 0,
    consumptionLiters: 0,
    apps: {}
  });
}

export function groupDaily(shifts, settings) {
  const grouped = new Map();
  shifts.forEach((shift) => {
    if (!grouped.has(shift.date)) {
      grouped.set(shift.date, { date: shift.date, label: shift.date.slice(5).split("-").reverse().join("/"), revenue: 0, profit: 0, costs: 0 });
    }
    const item = grouped.get(shift.date);
    const calc = calculateShift(shift, settings);
    item.revenue += calc.revenue;
    item.profit += calc.profit;
    item.costs += calc.totalCosts;
  });
  return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
}

export function groupEfficiency(shifts, settings) {
  return shifts
    .map((shift) => ({ ...shift, calc: calculateShift(shift, settings) }))
    .filter((shift) => shift.calc.consumption > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)
    .map((shift) => ({
      date: shift.date,
      label: shift.date.slice(5).split("-").reverse().join("/"),
      consumo: Number(shift.calc.consumption.toFixed(2)),
      meta: settings.targetConsumption
    }));
}
