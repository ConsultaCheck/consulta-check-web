"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calculator, Save, Sparkles, TrendingUp, Wallet } from "lucide-react";

type BillingConfig = { clinicPercentage: number; insurancePercentage: number };

type ReconItem = {
  id: string;
  patientName: string;
  date: string;
  amount: number;
  status: "PAID" | "UNPAID" | "PAID_NOT_REGISTERED";
};

function buildMonthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth();
  for (let y = 2026; y <= endYear; y++) {
    const mEnd = y === endYear ? endMonth : 11;
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

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);

export default function RentabilidadPage() {
  const router = useRouter();
  const [config, setConfig] = useState<BillingConfig>({ clinicPercentage: 0, insurancePercentage: 0 });
  const [clinicPct, setClinicPct] = useState("");
  const [insurancePct, setInsurancePct] = useState("");
  const [monthFilter, setMonthFilter] = useState(format(new Date(), "yyyy-MM"));
  const [reconciliation, setReconciliation] = useState<ReconItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Para calcular porcentajes desde una liquidación
  const [brutoLiquidacion, setBrutoLiquidacion] = useState("");
  const [descuentoParticipacion, setDescuentoParticipacion] = useState("");
  const [descuentoSeguroLiq, setDescuentoSeguroLiq] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [cfg, recon] = await Promise.all([
        apiFetch<BillingConfig>("/billing-config"),
        apiFetch<ReconItem[]>("/reconciliation"),
      ]);
      setConfig(cfg);
      setClinicPct(String(cfg.clinicPercentage));
      setInsurancePct(String(cfg.insurancePercentage));
      setReconciliation(recon);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al cargar";
      setError(msg);
      if (msg.includes("No autorizado") || msg.includes("Token inválido")) {
        router.push("/?expired=1");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const paidFiltered = useMemo(() => {
    const paid = reconciliation.filter((r) => r.status === "PAID" && r.id.startsWith("att-"));
    return monthFilter ? paid.filter((r) => r.date.slice(0, 7) === monthFilter) : paid;
  }, [reconciliation, monthFilter]);

  const bruto = useMemo(() => paidFiltered.reduce((s, r) => s + r.amount, 0), [paidFiltered]);

  const clinicPctNum = parseFloat(clinicPct) || 0;
  const insurancePctNum = parseFloat(insurancePct) || 0;
  const descuentoClinica = Math.round(bruto * (clinicPctNum / 100));
  const descuentoSeguro = Math.round(bruto * (insurancePctNum / 100));
  const liquido = bruto - descuentoClinica - descuentoSeguro;

  // Calcular % desde liquidación
  const brutoNum = parseFloat(brutoLiquidacion.replace(/[.\s]/g, "")) || 0;
  const participacionNum = parseFloat(descuentoParticipacion.replace(/[.\s]/g, "")) || 0;
  const seguroNum = parseFloat(descuentoSeguroLiq.replace(/[.\s]/g, "")) || 0;
  const pctClinicCalc = brutoNum > 0 ? (participacionNum / brutoNum) * 100 : 0;
  const pctSeguroCalc = brutoNum > 0 ? (seguroNum / brutoNum) * 100 : 0;

  const usarPorcentajesCalculados = () => {
    setClinicPct(pctClinicCalc.toFixed(2));
    setInsurancePct(pctSeguroCalc.toFixed(2));
  };

  const handleSave = async () => {
    const cp = parseFloat(clinicPct);
    const ip = parseFloat(insurancePct);
    if (isNaN(cp) || cp < 0 || cp > 100 || isNaN(ip) || ip < 0 || ip > 100) {
      setError("Los porcentajes deben estar entre 0 y 100");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/billing-config", {
        method: "PUT",
        body: JSON.stringify({ clinicPercentage: cp, insurancePercentage: ip }),
      });
      setConfig({ clinicPercentage: cp, insurancePercentage: ip });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 min-w-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rentabilidad</h1>
        <p className="text-muted-foreground">
          Calcule cuánto le queda después de los descuentos de clínica y seguro.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Descubrir porcentajes desde liquidación */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <CardTitle className="text-lg">¿Cuánto es el % de la clínica y del seguro?</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Pegue los montos de su liquidación para calcular los porcentajes automáticamente.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Bruto (Pacientes Ambulatorio)</Label>
              <Input
                placeholder="Ej: 1995038"
                value={brutoLiquidacion}
                onChange={(e) => setBrutoLiquidacion(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Descuento Participación (clínica)</Label>
              <Input
                placeholder="Ej: 598513"
                value={descuentoParticipacion}
                onChange={(e) => setDescuentoParticipacion(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Descuento seguro</Label>
              <Input
                placeholder="Ej: 15011"
                value={descuentoSeguroLiq}
                onChange={(e) => setDescuentoSeguroLiq(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          {brutoNum > 0 && (
            <div className="flex flex-wrap items-center gap-4 rounded-lg bg-background/80 p-4">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-muted-foreground">Clínica:</span>
                <span className="font-semibold text-primary">{pctClinicCalc.toFixed(1)}%</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-muted-foreground">Seguro:</span>
                <span className="font-semibold text-primary">{pctSeguroCalc.toFixed(1)}%</span>
              </div>
              <Button variant="outline" size="sm" onClick={usarPorcentajesCalculados}>
                Usar estos porcentajes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuración guardada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4" />
            Porcentajes para el cálculo
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Edite manualmente o use los calculados arriba. Se guardan para futuros cálculos.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">% Participación clínica</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                placeholder="0"
                value={clinicPct}
                onChange={(e) => setClinicPct(e.target.value)}
                className="w-24"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">% Seguro</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                placeholder="0"
                value={insurancePct}
                onChange={(e) => setInsurancePct(e.target.value)}
                className="w-24"
              />
            </div>
            <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Proyección de ingreso líquido */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4" />
                Su ingreso líquido
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Basado en atenciones pagadas del mes seleccionado.
              </p>
            </div>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-44">
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
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/40 p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bruto</span>
                  <span className="font-medium">{formatCurrency(bruto)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">− Participación clínica ({clinicPctNum}%)</span>
                  <span>−{formatCurrency(descuentoClinica)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">− Seguro ({insurancePctNum}%)</span>
                  <span>−{formatCurrency(descuentoSeguro)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                    <TrendingUp className="h-4 w-4" />
                    Líquido
                  </span>
                  <span className="text-lg font-bold text-emerald-600">{formatCurrency(liquido)}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {paidFiltered.length} atenciones pagadas en este periodo.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
