# ConsultaCheck Web

Frontend del sistema de reconciliación médica **ConsultaCheck**: registro de pacientes atendidos y comparación con liquidaciones mensuales de clínicas.

## Stack

- **Next.js 14** (App Router)
- **React** + **TypeScript**
- **TailwindCSS**
- **shadcn/ui** (Radix UI + Tailwind)
- **React Hook Form** + Zod
- **Recharts**
- **date-fns**

## Requisitos

- Node.js 18+
- npm

## Instalación y ejecución

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La raíz redirige a `/dashboard`.

## Estructura

```
/app
  /dashboard     - Resumen, KPIs y gráficos
  /attendances   - Asistencias (carga desde Excel o registro manual)
  /liquidations - Liquidaciones (Excel histórico o PDF clínica)
  /reconciliation - Atendidos vs pagados
  /reports       - Exportación
/components     - UI y layout
/lib            - utilidades y parseo Excel
/types          - tipos TypeScript
```

## Diseño

- **Desktop / tablet / laptop**: sidebar fija, contenido adaptable.
- **Tablet/móvil**: sidebar colapsable con menú hamburguesa.
- Estilo SaaS médico: azul primario, fondos grises claros, cards blancas con bordes suaves.

## Datos mock

- 30 pacientes
- 50 asistencias
- 2 liquidaciones
- Reconciliación derivada de asistencias

No hay backend real; todas las acciones (agregar paciente, subir liquidación, exportar) son simuladas (alertas o estado local).
