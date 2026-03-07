import * as XLSX from "xlsx";

export type ParsedLiquidationRow = {
  dateOfService: string; // ISO date string
  patientName: string;
  amountPaid: number;
  patientDocument?: string;
  coverage?: string;
};

const EXPECTED_HEADERS = [
  "fecha atencion",
  "nombre del paciente",
  "monto",
] as const;

function normalizeHeader(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Parsea monto chileno: "$ 14.870" -> 14870 */
function parseAmount(val: unknown): number {
  if (typeof val === "number" && !Number.isNaN(val)) return Math.round(val);
  const str = String(val ?? "").replace(/\s/g, "").replace(/\$/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(str);
  return Number.isNaN(n) ? 0 : Math.round(n);
}

/** Parsea fecha: Excel serial (número), DD-MM-YYYY o Date de xlsx a ISO (formato Chile) */
function parseDate(val: unknown): string {
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}T12:00:00.000Z`;
  }
  // Excel serial (días desde 1899-12-30) - usar Date.UTC para evitar desplazamiento por zona horaria
  if (typeof val === "number" && val > 1000 && val < 1000000) {
    const utcMs = (val - 25569) * 86400 * 1000;
    const jsDate = new Date(utcMs);
    if (Number.isNaN(jsDate.getTime())) return "";
    const y = jsDate.getUTCFullYear();
    const m = String(jsDate.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jsDate.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}T12:00:00.000Z`;
  }
  const str = String(val ?? "").trim();
  // DD-MM-YYYY o DD/MM/YYYY (formato Chile)
  const match = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    const month = parseInt(m!, 10);
    if (month < 1 || month > 12) return ""; // formato Chile: DD-MM-YYYY
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}T12:00:00.000Z`;
  }
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}T12:00:00.000Z`;
}

/**
 * Parsea un Excel de liquidación con cabecera:
 * Fecha atencion | Nombre del Paciente | Monto
 */
export function parseLiquidationExcel(file: File): Promise<ParsedLiquidationRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("No se pudo leer el archivo"));
          return;
        }
        const workbook = XLSX.read(data, {
          type: "binary",
          cellDates: true,
        });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) {
          reject(new Error("No se encontró ninguna hoja"));
          return;
        }
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

        if (rows.length < 2) {
          resolve([]);
          return;
        }

        const headerRow = (rows[0] as string[]).map(normalizeHeader);
        const colFecha = headerRow.findIndex(
          (h) => (h.includes("fecha") && h.includes("atencion")) || h === "fecha atencion",
        );
        const colNombre = headerRow.findIndex(
          (h) => (h.includes("nombre") && h.includes("paciente")) || h === "nombre del paciente",
        );
        const colMonto = headerRow.findIndex((h) => h.includes("monto"));

        if (colFecha < 0 || colNombre < 0 || colMonto < 0) {
          reject(
            new Error(
              'Cabecera esperada: "Fecha atencion", "Nombre del Paciente", "Monto"',
            ),
          );
          return;
        }

        const result: ParsedLiquidationRow[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as string[] | Record<string, unknown>;
          const arr = Array.isArray(row) ? row : Object.values(row);
          const fecha = parseDate(arr[colFecha]);
          const nombre = String(arr[colNombre] ?? "").trim();
          const monto = parseAmount(arr[colMonto]);

          if (!nombre || monto <= 0) continue;

          result.push({
            dateOfService: fecha,
            patientName: nombre,
            amountPaid: monto,
          });
        }
        resolve(result);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Error al parsear Excel"));
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsBinaryString(file);
  });
}
