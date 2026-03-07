"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatDateLocal } from "@/lib/utils";
import { apiFetch, getApiUrl, getStoredToken } from "@/lib/api";
import { parseLiquidationExcel } from "@/lib/parseLiquidationExcel";
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
import { Upload, FileText, FileSpreadsheet, Pencil } from "lucide-react";

const COVERAGES: CoverageType[] = [
  "FONASA",
  "ISAPRE",
  "FUERZAS_ARMADAS",
  "PARTICULAR",
];

const uploadSchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2030),
});

type UploadForm = z.infer<typeof uploadSchema>;

type ApiLiquidation = {
  _id: string;
  month: number;
  year: number;
  uploadDate: string;
};

type ApiLiquidationItem = {
  _id: string;
  patientName?: string;
  patientDocument?: string;
  coverage?: string;
  dateOfService?: string;
  amountPaid: number;
};

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function LiquidationsPage() {
  const router = useRouter();
  const [liquidations, setLiquidations] = useState<ApiLiquidation[]>([]);
  const [open, setOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState<string | null>(null);
  const [items, setItems] = useState<ApiLiquidationItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    patientDocument: string;
    coverage: string;
  }>({ patientDocument: "", coverage: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadType, setLoadType] = useState<"liquidation" | "patients">("liquidation");
  const [patientsPreview, setPatientsPreview] = useState<{ dateOfService: string; patientName: string; amountPaid: number }[] | null>(null);
  const [patientsUploading, setPatientsUploading] = useState(false);

  const form = useForm<UploadForm>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    },
  });

  const loadLiquidations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<ApiLiquidation[]>("/liquidations");
      setLiquidations(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al cargar liquidaciones";
      setError(msg);
      if (msg.includes("No autorizado") || msg.includes("Token inválido")) {
        router.push("/?expired=1");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLiquidations();
  }, []);

  const openItems = async (id: string) => {
    setItemsOpen(id);
    setItemsLoading(true);
    try {
      const data = await apiFetch<ApiLiquidationItem[]>(`/liquidations/${id}/items`);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar ítems");
    } finally {
      setItemsLoading(false);
    }
  };

  const saveItemEdit = async () => {
    if (!itemsOpen || !editItemId) return;
    try {
      await apiFetch(`/liquidations/${itemsOpen}/items/${editItemId}`, {
        method: "PUT",
        body: JSON.stringify({
          patientDocument: editForm.patientDocument || undefined,
          coverage: editForm.coverage || undefined,
        }),
      });
      const data = await apiFetch<ApiLiquidationItem[]>(`/liquidations/${itemsOpen}/items`);
      setItems(data);
      setEditItemId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

  const handlePatientsExcelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPatientsPreview(null);
    try {
      const parsed = await parseLiquidationExcel(file);
      setPatientsPreview(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al leer Excel");
    }
  };

  const submitPatientsUpload = async () => {
    if (!patientsPreview?.length) return;
    setPatientsUploading(true);
    setError(null);
    try {
      for (const row of patientsPreview) {
        await apiFetch("/attendances", {
          method: "POST",
          body: JSON.stringify({
            patientName: row.patientName,
            patientDocument: "-",
            coverage: "FONASA",
            dateOfAttendance: row.dateOfService,
            totalAmount: row.amountPaid,
            source: "excel",
          }),
        });
      }
      setPatientsPreview(null);
      setError(null);
      router.push("/attendances");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar pacientes");
    } finally {
      setPatientsUploading(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Cargas</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Importe liquidaciones desde PDF o pacientes desde Excel.
          </p>
        </div>
        <div className="flex shrink-0 rounded-lg border border-border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setLoadType("liquidation")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              loadType === "liquidation"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Liquidación
          </button>
          <button
            type="button"
            onClick={() => setLoadType("patients")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              loadType === "patients"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pacientes
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2.5">
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
      )}

      {loadType === "patients" ? (
        <Card className="overflow-hidden">
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-base font-medium">Cargar pacientes desde Excel</CardTitle>
            <p className="text-xs text-muted-foreground font-normal leading-relaxed">
              Cabecera: Fecha atencion, Nombre del Paciente, Monto. RUT y previsión quedarán en blanco; edítelos en Asistencias después.
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            <label
              htmlFor="patients-excel-input"
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/80 bg-muted/20 px-6 py-10 transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">Suelte el archivo o haga clic</p>
              <p className="mt-1 text-xs text-muted-foreground">Excel (.xlsx, .xls)</p>
              <Input
                id="patients-excel-input"
                type="file"
                accept=".xlsx,.xls"
                className="mt-3 max-w-[200px] sr-only"
                onChange={handlePatientsExcelChange}
              />
              {patientsPreview && (
                <div className="mt-5 flex flex-col items-center gap-3 rounded-lg border border-emerald-200/60 bg-emerald-500/5 px-4 py-3 dark:border-emerald-800/50">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    {patientsPreview.length} filas listas para cargar
                  </p>
                  <Button type="button" size="sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); submitPatientsUpload(); }} disabled={patientsUploading}>
                    {patientsUploading ? "Cargando…" : "Cargar pacientes"}
                  </Button>
                </div>
              )}
            </label>
          </CardContent>
        </Card>
      ) : (
        <>
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setOpen(true)}
          className="h-9"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Subir liquidación
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border/60">
          <CardTitle className="text-sm font-medium">Liquidaciones cargadas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Mes</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Año</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Fecha de carga</TableHead>
                  <TableHead className="h-9 w-[120px] text-xs font-medium text-muted-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-16 text-center text-sm text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : liquidations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-16 text-center text-sm text-muted-foreground">
                      No hay liquidaciones cargadas.
                    </TableCell>
                  </TableRow>
                ) : (
                  liquidations.map((l) => (
                    <TableRow key={l._id} className="group">
                      <TableCell className="py-3 text-sm font-medium">
                        {MONTH_NAMES[l.month - 1]}
                      </TableCell>
                      <TableCell className="py-3 text-sm">{l.year}</TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {formatDateLocal(l.uploadDate, "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="py-3">
                        <Button variant="outline" size="sm" className="h-8" onClick={() => openItems(l._id)}>
                          Ver ítems
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

        </>
      )}

      {/* Dialog: Subir liquidación */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg gap-4">
          <DialogHeader className="gap-1">
            <DialogTitle className="text-base">Subir liquidación</DialogTitle>
            <p className="text-xs text-muted-foreground font-normal">PDF de liquidación médica</p>
          </DialogHeader>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Mes</Label>
                <Input type="number" min={1} max={12} className="h-9 text-sm" {...form.register("month")} />
                {form.formState.errors.month && (
                  <p className="text-xs text-destructive">{form.formState.errors.month.message}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Año</Label>
                <Input type="number" min={2020} max={2030} className="h-9 text-sm" {...form.register("year")} />
                {form.formState.errors.year && (
                  <p className="text-xs text-destructive">{form.formState.errors.year.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">PDF (clínica)</Label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                PDF de liquidación (ej. CEM LIRCAY). Se extraen fecha, paciente, RUT y monto.
              </p>
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/80 bg-muted/20 px-4 py-6 transition-colors hover:border-primary/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <p className="mt-2 text-xs font-medium text-foreground">PDF</p>
                <Input
                  type="file"
                  accept=".pdf"
                  className="mt-2 max-w-[200px]"
                  id="pdf-file"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setError(null);
                    try {
                      const formData = new FormData();
                      formData.append("file", file);
                      formData.append("month", String(form.watch("month")));
                      formData.append("year", String(form.watch("year")));
                      const token = getStoredToken();
                      const res = await fetch(`${getApiUrl()}/liquidations/upload-pdf`, {
                        method: "POST",
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                        body: formData,
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error((data as { message?: string }).message ?? "Error al subir PDF");
                      await loadLiquidations();
                      setOpen(false);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Error al subir PDF");
                    }
                  }}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Ítems de liquidación (editable) */}
      <Dialog open={!!itemsOpen} onOpenChange={(v) => { if (!v) { setItemsOpen(null); setEditItemId(null); } }}>
        <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col overflow-hidden gap-0">
          <DialogHeader className="gap-1 pb-3">
            <DialogTitle className="text-base">Ítems de liquidación</DialogTitle>
            <p className="text-xs text-muted-foreground font-normal">
              Edite RUT y previsión para mejorar la reconciliación con asistencias.
            </p>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            {itemsLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9 text-xs font-medium text-muted-foreground">Fecha</TableHead>
                    <TableHead className="h-9 text-xs font-medium text-muted-foreground">Paciente</TableHead>
                    <TableHead className="h-9 text-xs font-medium text-muted-foreground">RUT</TableHead>
                    <TableHead className="h-9 text-xs font-medium text-muted-foreground">Previsión</TableHead>
                    <TableHead className="h-9 text-xs font-medium text-muted-foreground">Monto</TableHead>
                    <TableHead className="h-9 w-[90px] text-xs font-medium text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it._id} className="group">
                      <TableCell className="whitespace-nowrap py-2.5 text-sm">
                        {it.dateOfService
                          ? formatDateLocal(it.dateOfService, "dd/MM/yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell className="py-2.5 text-sm">{it.patientName ?? "-"}</TableCell>
                      <TableCell className="py-2.5">
                        {editItemId === it._id ? (
                          <Input
                            placeholder="RUT"
                            value={editForm.patientDocument}
                            onChange={(e) => setEditForm((f) => ({ ...f, patientDocument: e.target.value }))}
                            className="h-8 w-36 text-sm"
                          />
                        ) : (
                          it.patientDocument ?? <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5">
                        {editItemId === it._id ? (
                          <Select
                            value={editForm.coverage || ""}
                            onValueChange={(v) => setEditForm((f) => ({ ...f, coverage: v }))}
                          >
                            <SelectTrigger className="h-8 w-36">
                              <SelectValue placeholder="Previsión" />
                            </SelectTrigger>
                            <SelectContent>
                              {COVERAGES.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          it.coverage ?? <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 text-sm font-medium">{formatCurrency(it.amountPaid)}</TableCell>
                      <TableCell className="py-2.5">
                        {editItemId === it._id ? (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={saveItemEdit}>Guardar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditItemId(null)}>Cancelar</Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditItemId(it._id);
                              setEditForm({
                                patientDocument: it.patientDocument ?? "",
                                coverage: it.coverage ?? "",
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
