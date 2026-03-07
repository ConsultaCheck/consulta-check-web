"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { ReconciliationStatus } from "@/types";
import { format } from "date-fns";
import { formatDateLocal } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GitCompare, Info, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

type SuggestedMatch = {
  id: string;
  patientName: string;
  date: string;
  amount: number;
  liquidationId?: string;
};

type ApiReconciliationItem = {
  id: string;
  patientName: string;
  date: string;
  coverage?: string;
  amount: number;
  status: "PAID" | "UNPAID" | "PAID_NOT_REGISTERED";
  reason?: string;
  liquidationId?: string;
  suggestedMatches?: SuggestedMatch[];
};

const statusConfig: Record<
  ReconciliationStatus,
  { label: string; variant: "success" | "destructive" | "warning" }
> = {
  PAID: { label: "Pagado", variant: "success" },
  UNPAID: { label: "No pagado", variant: "destructive" },
  PAID_NOT_REGISTERED: {
    label: "Pagado no registrado",
    variant: "warning",
  },
};

export default function ReconciliationPage() {
  const router = useRouter();
  const [items, setItems] = useState<ApiReconciliationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<ApiReconciliationItem | null>(null);
  const [linking, setLinking] = useState(false);

  const loadReconciliation = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<ApiReconciliationItem[]>("/reconciliation");
      setItems(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al cargar reconciliación";
      setError(msg);
      if (msg.includes("No autorizado") || msg.includes("Token inválido")) {
        router.push("/?expired=1");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReconciliation();
  }, []);

  const paidItems = items.filter((r) => r.status === "PAID");
  const unpaidItems = items.filter((r) => r.status === "UNPAID");
  const diffItems = items.filter((r) => r.status === "PAID_NOT_REGISTERED");

  const paid = paidItems.length;
  const unpaid = unpaidItems.length;
  const differences = diffItems.length;

  const paidAmount = paidItems.reduce((s, r) => s + r.amount, 0);
  const unpaidAmount = unpaidItems.reduce((s, r) => s + r.amount, 0);
  const diffAmount = diffItems.reduce((s, r) => s + r.amount, 0);
  const totalAmount = paidAmount + unpaidAmount + diffAmount;
  const totalItems = items.length;
  const conciliationRate = totalItems > 0 ? Math.round((paid / totalItems) * 100) : 0;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);

  const handleUseAmount = async (
    current: ApiReconciliationItem,
    suggestion: SuggestedMatch,
    useSuggestionAmount: boolean
  ) => {
    if (!suggestion?.id) return;
    setLinking(true);
    setError(null);
    try {
      const amountToUse = useSuggestionAmount ? suggestion.amount : current.amount;
      if (current.status === "UNPAID") {
        const attId = current.id.replace("att-", "");
        if (useSuggestionAmount) {
          await apiFetch(`/attendances/${attId}`, {
            method: "PUT",
            body: JSON.stringify({ totalAmount: amountToUse }),
          });
        } else {
          const liquidationId = suggestion.liquidationId;
          const itemId = suggestion.id.replace("liqitem-", "");
          if (liquidationId) {
            await apiFetch(`/liquidations/${liquidationId}/items/${itemId}`, {
              method: "PUT",
              body: JSON.stringify({ amountPaid: amountToUse }),
            });
          }
        }
      } else {
        const liquidationId = current.liquidationId;
        const itemId = current.id.replace("liqitem-", "");
        const attId = suggestion.id.replace("att-", "");
        if (useSuggestionAmount) {
          await apiFetch(`/attendances/${attId}`, {
            method: "PUT",
            body: JSON.stringify({ totalAmount: amountToUse }),
          });
        } else if (liquidationId) {
          await apiFetch(`/liquidations/${liquidationId}/items/${itemId}`, {
            method: "PUT",
            body: JSON.stringify({ amountPaid: amountToUse }),
          });
        }
      }
      setModalItem(null);
      await loadReconciliation();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al vincular";
      setError(msg);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reconciliación</h1>
          <p className="text-muted-foreground">
            Comparación de pacientes atendidos vs pagados
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void loadReconciliation()} disabled={loading} className="h-9">
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2.5">
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
      )}

      {/* Resumen conciliación */}
      {!loading && totalItems > 0 && (
        <Card className="overflow-hidden border-emerald-200/50 bg-gradient-to-br from-emerald-50/50 to-transparent dark:border-emerald-900/30 dark:from-emerald-950/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
                <GitCompare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Estado de conciliación</p>
                <p className="text-lg font-bold tabular-nums">
                  {totalItems} atenciones · {formatCurrency(totalAmount)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 rounded-lg bg-background/60 px-4 py-2 dark:bg-background/40">
              <div>
                <p className="text-xs font-medium text-muted-foreground">% conciliado</p>
                <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {conciliationRate}%
                </p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Pendiente de revisar</p>
                <p className="text-lg font-bold tabular-nums">
                  {unpaid + differences} {(unpaid + differences) === 1 ? "ítem" : "ítems"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Widgets por estado */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pagados
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {loading ? "—" : paid}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Asistencias coincidentes con liquidación
            </p>
            {!loading && paid > 0 && (
              <p className="mt-2 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                {formatCurrency(paidAmount)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              No pagados
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {loading ? "—" : unpaid}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Asistencias sin cobro en liquidación
            </p>
            {!loading && unpaid > 0 && (
              <p className="mt-2 text-sm font-semibold tabular-nums text-red-700 dark:text-red-300">
                {formatCurrency(unpaidAmount)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Diferencias
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {loading ? "—" : differences}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pagos en liquidación sin asistencia registrada
            </p>
            {!loading && differences > 0 && (
              <p className="mt-2 text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                {formatCurrency(diffAmount)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 py-3 px-5">
          <CardTitle className="text-base font-medium">Detalle por estado</CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            Haga clic en el ícono de información para resolver diferencias o no pagados.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Paciente</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Fecha</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Cobertura</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Monto</TableHead>
                  <TableHead className="h-9 w-[140px] text-xs font-medium text-muted-foreground">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      No hay datos de reconciliación. Registre asistencias y liquidaciones.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((r) => {
                    const config = statusConfig[r.status as ReconciliationStatus];
                    return (
                      <TableRow key={r.id} className="group">
                        <TableCell className="py-2.5 text-sm font-medium">{r.patientName}</TableCell>
                        <TableCell className="py-2.5 text-sm text-muted-foreground">
                          {formatDateLocal(r.date, "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm">{r.coverage ?? "-"}</TableCell>
                        <TableCell className="py-2.5 text-sm font-medium tabular-nums">{formatCurrency(r.amount)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant={config?.variant ?? "secondary"}>
                              {config?.label ?? r.status}
                            </Badge>
                            {(r.status === "UNPAID" || r.status === "PAID_NOT_REGISTERED") &&
                              (r.reason || (r.suggestedMatches && r.suggestedMatches.length > 0)) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setModalItem(r)}
                                title="Ver motivo y opciones"
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!modalItem} onOpenChange={(open) => !open && setModalItem(null)}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Desajuste en reconciliación</DialogTitle>
            {modalItem && (
              <DialogDescription asChild>
                <div className="space-y-4 pt-1">
                  <div className="rounded-md bg-muted/50 p-3">
                    <p className="text-sm font-medium text-foreground">{modalItem.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateLocal(modalItem.date, "dd MMM yyyy")} — {formatCurrency(modalItem.amount)}
                    </p>
                  </div>
                  <p className="text-sm">{modalItem.reason}</p>
                </div>
              </DialogDescription>
            )}
          </DialogHeader>
          {modalItem?.suggestedMatches && modalItem.suggestedMatches.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Elija el monto correcto:</p>
              <div className="space-y-3">
                {modalItem.suggestedMatches.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border bg-card p-3 shadow-sm"
                  >
                    <p className="mb-3 text-sm font-medium">
                      {s.patientName}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={linking}
                        onClick={() => handleUseAmount(modalItem!, s, true)}
                        className="flex-1"
                      >
                        Usar {formatCurrency(s.amount)}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={linking}
                        onClick={() => handleUseAmount(modalItem!, s, false)}
                        className="flex-1"
                      >
                        Usar {formatCurrency(modalItem!.amount)}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Se actualizará el registro correspondiente para que coincidan.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
