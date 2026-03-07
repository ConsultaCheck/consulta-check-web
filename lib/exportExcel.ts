import * as XLSX from "xlsx-js-style";

/** Convierte fecha ISO (YYYY-MM-DD) a número serial de Excel */
function toExcelSerial(isoDate: string): number {
  const d = new Date(isoDate);
  const t = d.getTime();
  return t / 86400000 + 25569;
}

/** Detecta si un valor de fecha es ISO (YYYY-MM-DD) */
function isIsoDateString(v: unknown): v is string {
  if (typeof v !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}/.test(v);
}

/**
 * Genera un archivo Excel: cabeceras en negrita, columna nombre ancha,
 * fechas y montos con formato.
 */
export function downloadExcel(
  data: Record<string, string | number | undefined>[],
  filename: string,
  sheetName = "Datos",
): void {
  const ws = XLSX.utils.json_to_sheet(data);
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[ref] as XLSX.CellObject | undefined;
    headers[c] = cell && typeof cell.v === "string" ? cell.v : "";
  }

  const headerCount = range.e.c - range.s.c + 1;
  ws["!cols"] = Array.from({ length: headerCount }, (_, i) => ({
    wch: i === 0 ? 42 : i === headerCount - 1 ? 14 : 18,
  }));

  for (let c = 0; c <= range.e.c; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[ref] as XLSX.CellObject | undefined;
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: "000000" } },
        alignment: { horizontal: "left" },
      };
    }
  }

  for (let r = 1; r <= range.e.r; r++) {
    for (let c = 0; c <= range.e.c; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      const cell = ws[ref] as XLSX.CellObject | undefined;
      const header = headers[c];
      if (!cell) continue;
      if (header === "Fecha" && isIsoDateString(cell.v)) {
        cell.v = toExcelSerial(cell.v.slice(0, 10));
        cell.t = "n";
        cell.s = { ...(cell.s as object), numFmt: "dd/mm/yyyy" };
      } else if (header === "Monto" && typeof cell.v === "number") {
        cell.s = { ...(cell.s as object), numFmt: '"$"#,##0' };
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
