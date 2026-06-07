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

export function parseDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatMoney(value) {
  return money.format(Number.isFinite(value) ? value : 0);
}

export function fixedDailyCost(settings) {
  return (settings.insuranceMonthly + settings.cleaningMonthly + settings.otherMonthly) / 30;
}

export function calculateShift(shift, settings) {
  const km = Math.max(0, Number(shift.kmEnd || 0) - Number(shift.kmStart || 0));
  const revenue = (shift.apps || []).reduce((total, app) => total + Number(app.amount || 0), 0);
  const estimatedFuel = settings.targetConsumption > 0
    ? (km / settings.targetConsumption) * settings.fuelPrice
    : 0;
  const fuelCost = Number(shift.fuelCost || 0) > 0 ? Number(shift.fuelCost) : estimatedFuel;
  const maintenance = km * Number(settings.maintenancePerKm || 0);
  const dailyFixed = fixedDailyCost(settings);
  const foodCost = Number(shift.foodCost || 0);
  const extraCost = Number(shift.extraCost || 0);
  const otherCosts = foodCost + extraCost;
  const totalCosts = fuelCost + maintenance + dailyFixed + otherCosts;
  const profit = revenue - totalCosts;
  const consumption = Number(shift.fuelLiters || 0) > 0 ? km / Number(shift.fuelLiters) : 0;

  return {
    km,
    revenue,
    fuelCost,
    maintenance,
    dailyFixed,
    foodCost,
    extraCost,
    otherCosts,
    totalCosts,
    profit,
    consumption
  };
}

export function getTotals(shifts, settings) {
  return shifts.reduce((acc, shift) => {
    const calc = calculateShift(shift, settings);
    acc.revenue += calc.revenue;
    acc.costs += calc.totalCosts;
    acc.profit += calc.profit;
    acc.km += calc.km;
    acc.fuelCosts += calc.fuelCost;
    acc.maintenance += calc.maintenance;
    acc.fixedCosts += calc.dailyFixed;
    acc.foodCosts += calc.foodCost;
    acc.extraCosts += calc.extraCost;

    if (calc.consumption > 0) {
      acc.consumptionKm += calc.km;
      acc.consumptionLiters += Number(shift.fuelLiters || 0);
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
    fuelCosts: 0,
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
