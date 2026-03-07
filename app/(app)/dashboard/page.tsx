"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  BarChart,
  Bar,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { format, subWeeks } from "date-fns";
import { es } from "date-fns/locale";

const COVERAGE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

type ApiAttendance = {
  _id: string;
  patientName: string;
  dateOfAttendance: string;
  coverage: string;
  totalAmount: number;
};

type ApiReconciliationItem = {
  id: string;
  patientName: string;
  date: string;
  amount: number;
  status: "PAID" | "UNPAID" | "PAID_NOT_REGISTERED";
};

type BillingConfig = { clinicPercentage: number; insurancePercentage: number };

function buildMonthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let y = 2026; y <= now.getFullYear(); y++) {
    const mEnd = y === now.getFullYear() ? now.getMonth() : 11;
    for (let m = 0; m <= mEnd; m++) {
      const d = new Date(y, m, 1);
      opts.push({
        value: format(d, "yyyy-MM"),
        label: format(d, "LLLL yyyy", { locale: es }).replace(/^\w/, (c) => c.toUpperCase()),
      });
    }
    }
  return opts;
}

const MONTH_OPTIONS = buildMonthOptions();

export default function DashboardPage() {
  const router = useRouter();
  const [attendances, setAttendances] = useState<ApiAttendance[]>([]);
  const [reconciliation, setReconciliation] = useState<ApiReconciliationItem[]>([]);
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);
  const [monthFilter, setMonthFilter] = useState(() => format(new Date(), "yyyy-MM"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [attData, recData, cfg] = await Promise.all([
          apiFetch<ApiAttendance[]>("/attendances"),
          apiFetch<ApiReconciliationItem[]>("/reconciliation"),
          apiFetch<BillingConfig>("/billing-config").catch(() => ({ clinicPercentage: 0, insurancePercentage: 0 })),
        ]);
        if (!cancelled) {
          setAttendances(attData);
          setReconciliation(recData);
          setBillingConfig(cfg);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Error al cargar el panel";
          setError(msg);
          if (msg.includes("No autorizado") || msg.includes("Token inválido")) {
            router.push("/?expired=1");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const attendancesThisMonth = useMemo(
    () =>
      attendances.filter((a) => a.dateOfAttendance.slice(0, 7) === monthFilter),
    [attendances, monthFilter],
  );

  const reconciliationThisMonth = useMemo(
    () => reconciliation.filter((r) => r.date.slice(0, 7) === monthFilter),
    [reconciliation, monthFilter],
  );

  const paid = useMemo(
    () => reconciliationThisMonth.filter((r) => r.status === "PAID"),
    [reconciliationThisMonth],
  );
  const unpaid = useMemo(
    () => reconciliationThisMonth.filter((r) => r.status === "UNPAID"),
    [reconciliationThisMonth],
  );
  const expectedRevenue = useMemo(
    () => reconciliationThisMonth.reduce((s, r) => s + r.amount, 0),
    [reconciliationThisMonth],
  );
  const paidRevenue = useMemo(
    () => paid.reduce((s, r) => s + r.amount, 0),
    [paid],
  );
  const difference = expectedRevenue - paidRevenue;

  const clinicPct = billingConfig?.clinicPercentage ?? 0;
  const insurancePct = billingConfig?.insurancePercentage ?? 0;
  const baseRevenue = paidRevenue > 0 ? paidRevenue : expectedRevenue;
  const descuentoClinica = Math.round(baseRevenue * (clinicPct / 100));
  const descuentoSeguro = Math.round(baseRevenue * (insurancePct / 100));
  const liquido = baseRevenue - descuentoClinica - descuentoSeguro;

  const prevMonthFilter = useMemo(() => {
    const [y, m] = monthFilter.split("-").map(Number);
    const d = new Date(y ?? 2026, (m ?? 1) - 2, 1);
    return format(d, "yyyy-MM");
  }, [monthFilter]);

  const attendancesPrevMonth = useMemo(
    () => attendances.filter((a) => a.dateOfAttendance.slice(0, 7) === prevMonthFilter),
    [attendances, prevMonthFilter],
  );
  const reconciliationPrevMonth = useMemo(
    () => reconciliation.filter((r) => r.date.slice(0, 7) === prevMonthFilter),
    [reconciliation, prevMonthFilter],
  );
  const paidPrevMonth = useMemo(
    () => reconciliationPrevMonth.filter((r) => r.status === "PAID"),
    [reconciliationPrevMonth],
  );
  const expectedRevenuePrev = useMemo(
    () => reconciliationPrevMonth.reduce((s, r) => s + r.amount, 0),
    [reconciliationPrevMonth],
  );
  const paidRevenuePrev = useMemo(
    () => paidPrevMonth.reduce((s, r) => s + r.amount, 0),
    [paidPrevMonth],
  );
  const baseRevenuePrev = paidRevenuePrev > 0 ? paidRevenuePrev : expectedRevenuePrev;
  const descuentoClinicaPrev = Math.round(baseRevenuePrev * (clinicPct / 100));
  const descuentoSeguroPrev = Math.round(baseRevenuePrev * (insurancePct / 100));
  const liquidoPrev = baseRevenuePrev - descuentoClinicaPrev - descuentoSeguroPrev;

  const lineData = useMemo(() => {
    const [y, m] = monthFilter.split("-").map(Number);
    const monthStart = new Date(y ?? 2026, (m ?? 1) - 1, 1);
    const daysInMonth = new Date(y ?? 2026, (m ?? 1), 0).getDate();
    const numWeeks = Math.ceil(daysInMonth / 7) || 5;
    return Array.from({ length: numWeeks }, (_, i) => {
      const start = 1 + i * 7;
      const end = Math.min(start + 6, daysInMonth);
      const count = attendancesThisMonth.filter((a) => {
        const dayNum = Number(a.dateOfAttendance.slice(8, 10));
        return dayNum >= start && dayNum <= end;
      }).length;
      return {
        week: `${start}-${end}`,
        count,
      };
    });
  }, [attendancesThisMonth, monthFilter]);

  const pieData = useMemo(() => {
    const all = [
      { name: "FONASA", value: attendancesThisMonth.filter((a) => a.coverage === "FONASA").length },
      { name: "ISAPRE", value: attendancesThisMonth.filter((a) => a.coverage === "ISAPRE").length },
      { name: "FUERZAS_ARMADAS", value: attendancesThisMonth.filter((a) => a.coverage === "FUERZAS_ARMADAS").length },
      { name: "PARTICULAR", value: attendancesThisMonth.filter((a) => a.coverage === "PARTICULAR").length },
    ];
    return all.filter((d) => d.value > 0);
  }, [attendancesThisMonth]);

  const revenueByStatus = useMemo(
    () => [
      {
        label: "Pagado",
        amount: reconciliationThisMonth.filter((r) => r.status === "PAID").reduce((s, r) => s + r.amount, 0),
      },
      {
        label: "No pagado",
        amount: reconciliationThisMonth.filter((r) => r.status === "UNPAID").reduce((s, r) => s + r.amount, 0),
      },
      {
        label: "Pagado no registrado",
        amount: reconciliationThisMonth
          .filter((r) => r.status === "PAID_NOT_REGISTERED")
          .reduce((s, r) => s + r.amount, 0),
      },
    ],
    [reconciliationThisMonth],
  );

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel de control</h1>
          <p className="text-muted-foreground">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel de control</h1>
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  const monthLabel = (() => {
    const [y, m] = monthFilter.split("-").map(Number);
    return format(new Date(y ?? 2026, (m ?? 1) - 1, 1), "LLLL yyyy", { locale: es }).replace(/^\w/, (c) => c.toUpperCase());
  })();

  const prevMonthLabel = (() => {
    const [y, m] = prevMonthFilter.split("-").map(Number);
    return format(new Date(y ?? 2026, (m ?? 1) - 1, 1), "LLLL yyyy", { locale: es }).replace(/^\w/, (c) => c.toUpperCase());
  })();

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Panel de control</h1>
          <p className="text-muted-foreground">
            Resumen del mes: {monthLabel}
          </p>
        </div>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-full min-w-0 sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_OPTIONS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Fila 1: KPIs principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[0.75fr_1fr_1.4fr] lg:items-stretch">
        <Card className="flex flex-col">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-base font-medium">Pacientes este mes</CardTitle>
            <p className="text-xs font-normal text-muted-foreground">Resumen de asistencias</p>
          </CardHeader>
          <CardContent className="flex-1 px-5 pb-4 pt-0">
            <div className="flex flex-col gap-1.5">
              <div className="rounded-lg border border-border/80 bg-muted/40 px-3 py-1.5 text-center">
                <p className="text-base font-bold tabular-nums">{attendancesThisMonth.length}</p>
                <p className="text-xs text-muted-foreground">Atendidos</p>
              </div>
              <div className="rounded-lg border border-emerald-200/60 bg-emerald-500/5 px-3 py-1.5 text-center dark:border-emerald-800/50">
                <p className="text-base font-bold tabular-nums text-emerald-600">{paid.length}</p>
                <p className="text-xs text-muted-foreground">Pagados</p>
              </div>
              <div className="rounded-lg border border-amber-200/60 bg-amber-500/5 px-3 py-1.5 text-center dark:border-amber-800/50">
                <p className="text-base font-bold tabular-nums text-amber-600">{unpaid.length}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-base font-medium">Ingresos</CardTitle>
            <p className="text-xs font-normal text-muted-foreground">Flujo de cobranza del mes</p>
          </CardHeader>
          <CardContent className="flex-1 space-y-3 px-5 pb-4 pt-0">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-sm text-muted-foreground" title="Total facturado">Esperados</span>
              <span className="text-base font-bold text-right">{formatCurrency(expectedRevenue)}</span>
            </div>
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-sm text-muted-foreground" title="Lo que ya te pagaron los seguros">Cobrados</span>
              <span className="text-base font-bold text-emerald-600 text-right">{formatCurrency(paidRevenue)}</span>
            </div>
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-sm text-muted-foreground" title="Lo que aún no cobraste">Pendiente</span>
              <span
                className={`text-base font-bold text-right ${
                  difference >= 0 ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                {formatCurrency(difference)}
              </span>
            </div>
            <div className="pt-3 border-t border-border">
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-sm font-medium text-muted-foreground" title="Tu ganancia neta tras restar % clínica y % seguro">Líquido</span>
                <span className="text-base font-bold text-emerald-600 text-right">{formatCurrency(liquido)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Tu ganancia neta (tras clínica y seguro)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-base font-medium">Variación vs mes anterior</CardTitle>
            <p className="text-xs font-normal text-muted-foreground">
              {monthLabel} comparado con {prevMonthLabel}
            </p>
          </CardHeader>
          <CardContent className="flex-1 overflow-x-auto px-5 pb-4 pt-0">
            <div className="space-y-3 min-w-[260px]">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-muted-foreground font-medium">
                <div>Métrica</div>
                <div className="text-right">Este mes / Anterior</div>
                <div className="text-right">Variación</div>
              </div>
              <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-b border-border pb-3">
                <div className="text-sm min-w-0">Pacientes</div>
                <div className="text-right text-sm tabular-nums">
                  {attendancesThisMonth.length} <span className="text-muted-foreground">/ {attendancesPrevMonth.length}</span>
                </div>
                <div className="text-right">
                  {attendancesThisMonth.length - attendancesPrevMonth.length !== 0 ? (
                    <span
                      className={`inline-flex items-center justify-end gap-0.5 text-sm font-medium tabular-nums ${
                        attendancesThisMonth.length >= attendancesPrevMonth.length ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {attendancesThisMonth.length >= attendancesPrevMonth.length ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {attendancesThisMonth.length >= attendancesPrevMonth.length ? "+" : ""}
                      {attendancesThisMonth.length - attendancesPrevMonth.length}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground tabular-nums">—</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-b border-border pb-3">
                <div className="text-sm min-w-0">Cobrado</div>
                <div className="text-right text-sm tabular-nums">
                  {formatCurrency(paidRevenue)} <span className="text-muted-foreground">/ {formatCurrency(paidRevenuePrev)}</span>
                </div>
                <div className="text-right">
                  {paidRevenue - paidRevenuePrev !== 0 ? (
                    <span
                      className={`inline-flex items-center justify-end gap-0.5 text-sm font-medium tabular-nums ${
                        paidRevenue >= paidRevenuePrev ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {paidRevenue >= paidRevenuePrev ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {paidRevenue >= paidRevenuePrev ? "+" : ""}
                      {formatCurrency(paidRevenue - paidRevenuePrev)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground tabular-nums">—</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <div className="text-sm min-w-0">Líquido</div>
                <div className="text-right text-sm tabular-nums">
                  {formatCurrency(liquido)} <span className="text-muted-foreground">/ {formatCurrency(liquidoPrev)}</span>
                </div>
                <div className="text-right">
                  {liquido - liquidoPrev !== 0 ? (
                    <span
                      className={`inline-flex items-center justify-end gap-0.5 text-sm font-medium tabular-nums ${
                        liquido >= liquidoPrev ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {liquido >= liquidoPrev ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {liquido >= liquidoPrev ? "+" : ""}
                      {formatCurrency(liquido - liquidoPrev)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground tabular-nums">—</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fila 2: Tendencia principal */}
      <Card>
        <CardHeader>
          <CardTitle>Pacientes por semana</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Atendidos por rango de días del mes (1-7, 8-14, etc.)
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="week" className="text-xs" tickLine={false} />
                <YAxis className="text-xs" tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px" }}
                  formatter={(value: number) => [value, "Pacientes"]}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Pacientes"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Fila 3: Gráficos de análisis */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pacientes por cobertura</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mx-auto h-[260px] w-full max-w-sm">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={pieData.length > 1 ? 2 : 0}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={COVERAGE_COLORS[i % COVERAGE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [value, "Pacientes"]}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    iconSize={6}
                    wrapperStyle={{ fontSize: "11px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingresos por estado de conciliación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByStatus}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => [
                      formatCurrency(value),
                      "Ingresos",
                    ]}
                  />
                  <Bar
                    dataKey="amount"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
