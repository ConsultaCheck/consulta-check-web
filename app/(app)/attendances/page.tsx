"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { formatDateLocal } from "@/lib/utils";
import { es } from "date-fns/locale";
import { apiFetch } from "@/lib/api";
import type { CoverageType } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, FileDown } from "lucide-react";
import { downloadExcel } from "@/lib/exportExcel";

const COVERAGES: CoverageType[] = [
  "FONASA",
  "ISAPRE",
  "FUERZAS_ARMADAS",
  "PARTICULAR",
];

function buildMonthOptions(maxDate: Date): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const endYear = maxDate.getFullYear();
  const endMonth = maxDate.getMonth();
  if (endYear < 2026) return opts;
  for (let y = 2026; y <= endYear; y++) {
    const mEnd = y === endYear ? endMonth : 11;
    for (let m = 0; m <= mEnd; m++) {
      const d = new Date(y, m, 1);
      const value = format(d, "yyyy-MM");
      const label = format(d, "LLLL yyyy", { locale: es });
      opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
  }
  return opts;
}

const registerSchema = z.object({
  patientName: z.string().min(1, "Ingrese el nombre del paciente"),
  patientDocument: z.string().min(1, "Ingrese el RUT o pasaporte"),
  coverage: z.enum(["FONASA", "ISAPRE", "FUERZAS_ARMADAS", "PARTICULAR"]),
  date: z.string().min(1, "Requerido"),
  totalAmount: z.coerce.number().min(0, "Monto mayor o igual a 0"),
  reconciliationStatus: z.enum(["PAID", "UNPAID"]).nullish(),
});

type RegisterForm = z.infer<typeof registerSchema>;

type ReconciliationStatus = "PAID" | "UNPAID" | null;

type ApiAttendance = {
  _id: string;
  patientName: string;
  patientDocument: string;
  coverage: CoverageType;
  dateOfAttendance: string;
  totalAmount: number;
  source: "manual" | "excel";
  reconciliationStatus?: ReconciliationStatus;
};

type AttendanceRow = {
  id: string;
  patientName: string;
  patientDocument: string;
  coverage: CoverageType;
  dateOfAttendance: string;
  totalAmount: number;
  reconciliationStatus?: ReconciliationStatus;
};

type ReconItem = { id: string; status: "PAID" | "UNPAID" | "PAID_NOT_REGISTERED"; patientName: string; date: string; amount: number };

/**
 * Asistencias: tabla con filtros y formulario para registrar una nueva asistencia.
 */
export default function AttendancesPage() {
  const router = useRouter();
  const [attendances, setAttendances] = useState<AttendanceRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState("");
  const [coverageFilter, setCoverageFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [nameFilter, setNameFilter] = useState("");
  const [rutFilter, setRutFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; patientName: string } | null>(null);
  const [computedStatusMap, setComputedStatusMap] = useState<Record<string, "PAID" | "UNPAID">>({});
  const [exportLoading, setExportLoading] = useState<string | null>(null);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      patientName: "",
      patientDocument: "",
      coverage: "FONASA",
      date: format(new Date(), "yyyy-MM-dd"),
      totalAmount: 15130,
      reconciliationStatus: null as ReconciliationStatus,
    },
  });

  const loadAttendances = async () => {
    try {
      setLoading(true);
      setError(null);
      await apiFetch("/reconciliation/sync-ruts", { method: "POST" }).catch(() => {});
      const [data, recon] = await Promise.all([
        apiFetch<ApiAttendance[]>("/attendances"),
        apiFetch<ReconItem[]>("/reconciliation"),
      ]);
      const mapped: AttendanceRow[] = data.map((a) => ({
        id: a._id,
        patientName: a.patientName,
        patientDocument: a.patientDocument,
        coverage: a.coverage,
        dateOfAttendance: a.dateOfAttendance,
        totalAmount: a.totalAmount,
        reconciliationStatus: a.reconciliationStatus ?? null,
      }));
      setAttendances(mapped);
      const map: Record<string, "PAID" | "UNPAID"> = {};
      for (const r of recon) {
        if ((r.status === "PAID" || r.status === "UNPAID") && r.id.startsWith("att-")) {
          map[r.id.replace("att-", "")] = r.status;
        }
      }
      setComputedStatusMap(map);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Error al cargar asistencias";
      setError(message);
      if (
        message.includes("No autorizado") ||
        message.includes("Token inválido")
      ) {
        router.push("/?expired=1");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAttendances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthOptions = useMemo(() => {
    let maxDate = new Date();
    for (const a of attendances) {
      const d = new Date(a.dateOfAttendance);
      if (d > maxDate) maxDate = d;
    }
    return buildMonthOptions(maxDate);
  }, [attendances]);

  const normalizeRut = (s: string) => s.replace(/[^\da-z]/gi, "");

  const formatRut = (value: string) => {
    const clean = value.replace(/[^0-9kK]/g, "").toUpperCase();
    if (!clean) return "";

    const cuerpo = clean.slice(0, -1);
    const dv = clean.slice(-1);

    if (!cuerpo) return dv;

    let cuerpoFormateado = "";
    let i = cuerpo.length;
    let contador = 0;

    while (i-- > 0) {
      cuerpoFormateado = cuerpo.charAt(i) + cuerpoFormateado;
      contador++;
      if (contador === 3 && i > 0) {
        cuerpoFormateado = "." + cuerpoFormateado;
        contador = 0;
      }
    }

    return `${cuerpoFormateado}-${dv}`;
  };

  const filtered = useMemo(() => {
    const name = nameFilter.trim().toLowerCase();
    const rut = normalizeRut(rutFilter.trim());

    return attendances.filter((a) => {
      const attDate = a.dateOfAttendance.slice(0, 10); // YYYY-MM-DD
      if (monthFilter && attDate.slice(0, 7) !== monthFilter) return false;
      if (coverageFilter !== "all" && a.coverage !== coverageFilter) return false;
      if (statusFilter !== "all") {
        const status = a.reconciliationStatus ?? computedStatusMap[a.id];
        if (status !== statusFilter) return false;
      }
      if (name && !a.patientName.toLowerCase().includes(name)) return false;
      if (rut) {
        const doc = normalizeRut(a.patientDocument ?? "");
        if (!doc || !doc.includes(rut)) return false;
      }
      return true;
    });
  }, [attendances, monthFilter, coverageFilter, statusFilter, nameFilter, rutFilter, computedStatusMap]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(n);

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError(null);

      if (editingId) {
        const payload: Record<string, unknown> = {
          patientName: data.patientName,
          patientDocument: data.patientDocument,
          coverage: data.coverage,
          dateOfAttendance: data.date,
          totalAmount: data.totalAmount,
        };
        if (data.reconciliationStatus !== undefined) {
          payload.reconciliationStatus = data.reconciliationStatus;
        }
        const updated = await apiFetch<ApiAttendance>(`/attendances/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        const mapped: AttendanceRow = {
          id: updated._id,
          patientName: updated.patientName,
          patientDocument: updated.patientDocument,
          coverage: updated.coverage,
          dateOfAttendance: updated.dateOfAttendance,
          totalAmount: updated.totalAmount,
          reconciliationStatus: updated.reconciliationStatus ?? null,
        };

        setAttendances((prev) =>
          prev.map((a) => (a.id === editingId ? mapped : a)),
        );
      } else {
        const created = await apiFetch<ApiAttendance>("/attendances", {
          method: "POST",
          body: JSON.stringify({
            patientName: data.patientName,
            patientDocument: data.patientDocument,
            coverage: data.coverage,
            dateOfAttendance: data.date,
            totalAmount: data.totalAmount,
            source: "manual",
          }),
        });

        const mapped: AttendanceRow = {
          id: created._id,
          patientName: created.patientName,
          patientDocument: created.patientDocument,
          coverage: created.coverage,
          dateOfAttendance: created.dateOfAttendance,
          totalAmount: created.totalAmount,
          reconciliationStatus: created.reconciliationStatus ?? null,
        };

        setAttendances((prev) => [mapped, ...prev]);
      }

      form.reset({
        patientName: "",
        patientDocument: "",
        coverage: "FONASA",
        date: format(new Date(), "yyyy-MM-dd"),
        totalAmount: 14870,
        reconciliationStatus: null,
      });
      setEditingId(null);
      setOpen(false);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Error al guardar la asistencia";
      setError(message);
      if (
        message.includes("No autorizado") ||
        message.includes("Token inválido")
      ) {
        router.push("/?expired=1");
      }
    }
  };

  const exportAttendances = () => {
    setExportLoading("attendances");
    setError(null);
    try {
      const rows = filtered.map((r) => ({
        "Nombre del paciente": r.patientName,
        "RUT / Pasaporte": r.patientDocument,
        Previsión: r.coverage,
        Fecha: r.dateOfAttendance.slice(0, 10),
        Monto: r.totalAmount,
      }));
      const suffix = monthFilter || format(new Date(), "yyyy-MM-dd");
      downloadExcel(rows, `asistencias-${suffix}.xlsx`, "Asistencias");
      setExportLoading(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al exportar");
      if ((e instanceof Error ? e.message : "").includes("No autorizado")) router.push("/?expired=1");
      setExportLoading(null);
    }
  };

  const exportUnpaid = async () => {
    setExportLoading("unpaid");
    setError(null);
    try {
      const data = await apiFetch<ReconItem[]>("/reconciliation");
      const unpaid = data.filter((r) => r.status === "UNPAID" && r.id.startsWith("att-"));
      const rows = unpaid.map((r) => ({
        "Nombre del paciente": r.patientName,
        Fecha: r.date.slice(0, 10),
        Monto: r.amount,
      }));
      downloadExcel(rows, `no-pagados-${format(new Date(), "yyyy-MM-dd")}.xlsx`, "No pagados");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al exportar");
      if ((e instanceof Error ? e.message : "").includes("No autorizado")) router.push("/?expired=1");
    } finally {
      setExportLoading(null);
    }
  };

  const handleDeleteClick = (id: string, patientName: string) => {
    setConfirmDelete({ id, patientName });
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const { id, patientName } = confirmDelete;
    setDeletingId(id);
    setError(null);
    setConfirmDelete(null);
    try {
      await apiFetch(`/attendances/${id}`, { method: "DELETE" });
      setAttendances((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
      if ((e instanceof Error ? e.message : "").includes("No autorizado")) {
        router.push("/?expired=1");
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Asistencias</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Registro de pacientes atendidos. Registre manualmente o cargue desde Cargas.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => {
              setEditingId(null);
              form.reset({
                patientName: "",
                patientDocument: "",
                coverage: "FONASA",
                date: format(new Date(), "yyyy-MM-dd"),
                totalAmount: 15130,
                reconciliationStatus: null,
              });
              setOpen(true);
            }}
            className="h-9"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nueva asistencia
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2.5">
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
      )}

      {/* Filtros */}
      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium">Filtros</CardTitle>
          <p className="text-xs text-muted-foreground font-normal leading-tight">
            Búsqueda parcial por nombre o RUT.
          </p>
        </CardHeader>
        <CardContent className="py-3 px-4 pt-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="grid gap-1">
              <Label className="text-xs font-medium text-muted-foreground">Paciente</Label>
              <Input
                placeholder="Buscar por nombre..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                className="h-9 w-full text-sm"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs font-medium text-muted-foreground">RUT / Pasaporte</Label>
              <Input
                placeholder="Buscar por RUT..."
                value={rutFilter}
                onChange={(e) => setRutFilter(e.target.value)}
                className="h-9 w-full text-sm"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs font-medium text-muted-foreground">Previsión</Label>
              <Select value={coverageFilter} onValueChange={setCoverageFilter}>
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {COVERAGES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs font-medium text-muted-foreground">Mes</Label>
              <Select value={monthFilter || "all"} onValueChange={(v) => setMonthFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue placeholder="Todos los meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs font-medium text-muted-foreground">Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PAID">Pagado</SelectItem>
                  <SelectItem value="UNPAID">No pagado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 py-3 px-4 border-b border-border/60">
          <div className="flex items-baseline gap-2">
            <CardTitle className="text-sm font-medium">Registro</CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
            </span>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => exportAttendances()}
              disabled={!!exportLoading}
              className="h-8 px-2.5 text-xs"
            >
              <FileDown className="mr-1 h-3 w-3" />
              {exportLoading === "attendances" ? "…" : "Exportar"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void exportUnpaid()}
              disabled={!!exportLoading}
              className="h-8 px-2.5 text-xs"
            >
              <FileDown className="mr-1 h-3 w-3" />
              {exportLoading === "unpaid" ? "…" : "No pagados"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/60">
                  <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground">Paciente</TableHead>
                  <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground">RUT</TableHead>
                  <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground">Previsión</TableHead>
                  <TableHead className="h-10 px-4 text-right text-xs font-medium text-muted-foreground">Total</TableHead>
                  <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground">Fecha</TableHead>
                  <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground">Estado</TableHead>
                  <TableHead className="h-10 w-[90px] px-4 text-right text-xs font-medium text-muted-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      Sin registros con los filtros actuales.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((a, idx) => (
                    <TableRow
                      key={a.id}
                      className={`border-b border-border/40 last:border-0 ${idx % 2 === 1 ? "bg-muted/20" : ""}`}
                    >
                      <TableCell className="px-4 py-2.5 text-sm font-medium">
                        {a.patientName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-2.5 text-sm text-muted-foreground tabular-nums">
                        {a.patientDocument || "—"}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-sm">{a.coverage}</TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium tabular-nums">
                        {formatCurrency(a.totalAmount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-2.5 text-sm text-muted-foreground">
                        {formatDateLocal(a.dateOfAttendance, "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        {(() => {
                          const status = a.reconciliationStatus ?? computedStatusMap[a.id];
                          return (
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                                status === "PAID"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                  : status === "UNPAID"
                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                    : "bg-muted/80 text-muted-foreground"
                              }`}
                            >
                              {status === "PAID"
                                ? "Pagado"
                                : status === "UNPAID"
                                  ? "No pagado"
                                  : "—"}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingId(a.id);
                              form.reset({
                                patientName: a.patientName,
                                patientDocument: a.patientDocument ?? "",
                                coverage: a.coverage,
                                date: a.dateOfAttendance.slice(0, 10),
                                totalAmount: a.totalAmount,
                                reconciliationStatus: a.reconciliationStatus ?? null,
                              });
                              setOpen(true);
                            }}
                            title="Editar asistencia"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDeleteClick(a.id, a.patientName)}
                            disabled={deletingId === a.id}
                            title="Eliminar asistencia"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            setEditingId(null);
            form.reset({
              patientName: "",
              patientDocument: "",
              coverage: "FONASA",
              date: format(new Date(), "yyyy-MM-dd"),
              totalAmount: 15130,
              reconciliationStatus: null,
            });
          }
          setOpen(v);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar asistencia" : "Registrar asistencia"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="patientName">Nombre del paciente</Label>
              <Input
                id="patientName"
                placeholder="Nombre completo"
                {...form.register("patientName")}
              />
              {form.formState.errors.patientName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.patientName.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="patientDocument">RUT / Pasaporte</Label>
              <Input
                id="patientDocument"
                placeholder="Ej: 20.008.931-6"
                value={form.watch("patientDocument")}
                onChange={(e) =>
                  form.setValue("patientDocument", formatRut(e.target.value), {
                    shouldValidate: true,
                  })
                }
              />
              {form.formState.errors.patientDocument && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.patientDocument.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Previsión</Label>
              <Select
                value={form.watch("coverage")}
                onValueChange={(v) => form.setValue("coverage", v as CoverageType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COVERAGES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Fecha de asistencia</Label>
              <Input type="date" {...form.register("date")} />
              {form.formState.errors.date && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.date.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Total (CLP)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                {...form.register("totalAmount")}
              />
              {form.formState.errors.totalAmount && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.totalAmount.message}
                </p>
              )}
            </div>
            {editingId && (
              <div className="grid gap-2">
                <Label>Estado de reconciliación</Label>
                <Select
                  value={form.watch("reconciliationStatus") ?? "auto"}
                  onValueChange={(v) =>
                    form.setValue(
                      "reconciliationStatus",
                      v === "auto" ? null : (v as "PAID" | "UNPAID"),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (computado por reconciliación)</SelectItem>
                    <SelectItem value="PAID">Pagado</SelectItem>
                    <SelectItem value="UNPAID">No pagado</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Puede fijar manualmente el estado para actualizar los gráficos del dashboard.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingId ? "Actualizar" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar asistencia</DialogTitle>
            <p className="text-sm text-muted-foreground">
              ¿Eliminar la asistencia de <strong>{confirmDelete?.patientName}</strong>? Esta acción no se puede deshacer.
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteConfirm()}
              disabled={!!deletingId}
            >
              {deletingId ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

