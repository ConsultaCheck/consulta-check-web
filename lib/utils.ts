import { type ClassValue, clsx } from "clsx";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

/** Combina clases de Tailwind evitando conflictos */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea YYYY-MM-DD sin cambio por zona horaria (evita que 27 feb se muestre como 26 feb) */
export function formatDateLocal(isoDate: string, pattern = "dd MMM yyyy"): string {
  const s = isoDate.slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  return format(new Date(y!, m! - 1, d!), pattern, { locale: es });
}
