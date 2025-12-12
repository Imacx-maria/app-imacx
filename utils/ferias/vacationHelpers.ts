// Vacation and Absence System - Utility Functions

import { CONTRACT_TYPE_VACATION_DAYS } from "@/types/ferias";

/**
 * Calculate annual vacation entitlement based on contract type
 */
export function getAnnualVacationDays(
  contractType: "contract" | "freelancer",
): number {
  return CONTRACT_TYPE_VACATION_DAYS[contractType] || 22;
}

/**
 * Calculate pro-rated vacation for mid-year hires
 * Portuguese law: year of admission = 2 days per full worked month (max 20); following years = full entitlement.
 */
export function calculateProratedVacation(
  admissionDate: Date,
  annualDays: number,
  year: number,
  contractType: "contract" | "freelancer" = "contract",
): number {
  const baseContractDays = 22;
  const baseFreelancerDays = 11;
  const normalizedType =
    contractType === "freelancer" ? "freelancer" : "contract";
  const yearEnd = new Date(year, 11, 31);

  if (year < admissionDate.getFullYear()) {
    return 0;
  }

  if (normalizedType === "freelancer") {
    return annualDays || baseFreelancerDays;
  }

  // Admission year accrual: 2 days per full month worked, capped at 20
  if (year === admissionDate.getFullYear()) {
    const firstFullMonth =
      admissionDate.getDate() === 1
        ? new Date(admissionDate.getFullYear(), admissionDate.getMonth(), 1)
        : new Date(
            admissionDate.getFullYear(),
            admissionDate.getMonth() + 1,
            1,
          );

    if (firstFullMonth > yearEnd) {
      return 0;
    }

    const monthsWorked =
      (yearEnd.getFullYear() - firstFullMonth.getFullYear()) * 12 +
      (yearEnd.getMonth() - firstFullMonth.getMonth()) +
      1;

    return Math.min(monthsWorked * 2, 20);
  }

  // Subsequent years: fixed entitlement (default 22)
  return annualDays || baseContractDays;
}

/**
 * Calculate business days between two dates (client-side approximation)
 * Note: For accurate calculation with holidays, use the database function
 */
export function calculateBusinessDaysApprox(
  startDate: Date,
  endDate: Date,
  holidays: Date[] = [],
): number {
  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidays.some(
      (h) => h.toDateString() === current.toDateString(),
    );

    if (!isWeekend && !isHoliday) {
      count++;
    }

    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Calculate carry-over days (capped at Portuguese law limit of 20 days)
 */
export function calculateCarryOver(
  previousBalance: number,
  currentYearTotal: number,
  currentYearUsed: number,
): number {
  const remaining = previousBalance + currentYearTotal - currentYearUsed;
  const MAX_CARRY_OVER = 20; // Portuguese law limit

  return Math.min(Math.max(remaining, 0), MAX_CARRY_OVER);
}

/**
 * Calculate remaining vacation days
 */
export function calculateRemainingDays(
  previousBalance: number,
  currentYearTotal: number,
  currentYearUsed: number,
): number {
  return previousBalance + currentYearTotal - currentYearUsed;
}

/**
 * Format vacation balance for display
 */
export function formatVacationBalance(days: number): string {
  if (days === Math.floor(days)) {
    return `${days}`;
  }
  return days.toFixed(1);
}

/**
 * Get vacation status based on remaining days
 */
export function getVacationStatus(
  remaining: number,
  total: number,
): "critical" | "warning" | "good" {
  const percentage = (remaining / total) * 100;

  if (percentage <= 10 || remaining <= 2) {
    return "critical";
  }
  if (percentage <= 30 || remaining <= 5) {
    return "warning";
  }
  return "good";
}

/**
 * Check if a date range overlaps with existing situations
 */
export function checkDateOverlap(
  startDate: Date,
  endDate: Date,
  existingSituations: { start_date: string; end_date: string }[],
): boolean {
  return existingSituations.some((situation) => {
    const existingStart = new Date(situation.start_date);
    const existingEnd = new Date(situation.end_date);

    return startDate <= existingEnd && endDate >= existingStart;
  });
}

/**
 * Generate an array of dates between start and end
 */
export function getDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Check if a date is a weekend
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Get the first day of the month
 */
export function getFirstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

/**
 * Get the last day of the month
 */
export function getLastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

/**
 * Get all days in a month
 */
export function getDaysInMonth(year: number, month: number): Date[] {
  const firstDay = getFirstDayOfMonth(year, month);
  const lastDay = getLastDayOfMonth(year, month);
  return getDateRange(firstDay, lastDay);
}

/**
 * Format date for display (DD/MM/YYYY)
 */
export function formatDateDisplay(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format date for database (YYYY-MM-DD)
 */
export function formatDateDB(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Parse date from database format
 */
export function parseDateDB(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

/**
 * Get month name in Portuguese
 */
export function getMonthNamePT(month: number): string {
  const months = [
    "Janeiro",
    "Fevereiro",
    "Marco",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return months[month];
}

/**
 * Get short month name in Portuguese
 */
export function getShortMonthNamePT(month: number): string {
  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return months[month];
}

/**
 * Get weekday name in Portuguese
 */
export function getWeekdayNamePT(dayIndex: number): string {
  const days = [
    "Domingo",
    "Segunda",
    "Terca",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sabado",
  ];
  return days[dayIndex];
}

/**
 * Get short weekday name in Portuguese
 */
export function getShortWeekdayNamePT(dayIndex: number): string {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  return days[dayIndex];
}
