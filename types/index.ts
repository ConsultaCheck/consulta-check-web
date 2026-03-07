/**
 * Tipos del sistema ConsultaCheck - Reconciliación médica
 */

export type CoverageType =
  | "FONASA"
  | "ISAPRE"
  | "FUERZAS_ARMADAS"
  | "PARTICULAR";

export type SexType = "M" | "F" | "OTHER";

export type AttendanceSource = "manual" | "excel";

export type LiquidationStatus = "pending" | "processed" | "error";

export type ReconciliationStatus =
  | "PAID"
  | "UNPAID"
  | "PAID_NOT_REGISTERED";

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  secondLastName: string;
  sex: SexType;
  coverage: CoverageType;
  documentNumber: string;
  age: number;
}

export interface Attendance {
  id: string;
  patientId: string;
  patientName: string;
  coverage: CoverageType;
  dateOfAttendance: string;
  source: AttendanceSource;
  time: string;
  paidAmount: number;
  totalAmount: number;
}

export interface Liquidation {
  id: string;
  month: number;
  year: number;
  uploadDate: string;
  status: LiquidationStatus;
}

export interface ReconciliationItem {
  id: string;
  patientName: string;
  date: string;
  coverage: CoverageType;
  amount: number;
  status: ReconciliationStatus;
}

export interface DashboardStats {
  patientsAttendedThisMonth: number;
  patientsPaid: number;
  patientsUnpaid: number;
  expectedRevenue: number;
  paidRevenue: number;
  difference: number;
}

export interface PatientsPerWeek {
  week: string;
  count: number;
}

export interface PatientsByCoverage {
  name: string;
  value: number;
}
