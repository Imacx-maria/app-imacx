"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { parse } from "date-fns";
import { pt } from "date-fns/locale";
import "react-day-picker/style.css";

import { cn } from "@/utils/tailwind";

export interface CalendarProps {
  holidays?: { holiday_date: string }[];
  // Absence dates with their situation type codes for coloring
  absenceDates?: { date: string; code: string }[];
  // Heat map data: date -> count of people absent (for department view)
  heatMapData?: Record<string, number>;
  // Max count for heat map intensity calculation
  heatMapMax?: number;
  // Ensure compatibility with usages in the app and different DayPicker versions
  month?: Date;
  onDayClick?: (date: Date) => void;
  showOutsideDays?: boolean;
  // Compatibility shims for projects passing these props explicitly
  mode?: any;
  initialFocus?: boolean;
  selected?: any;
  onSelect?: any;
  classNames?: any;
  modifiers?: any;
  [key: string]: any;
}

function Calendar({
  className,
  holidays = [],
  absenceDates = [],
  heatMapData = {},
  heatMapMax = 5,
  onDayClick,
  ...props
}: CalendarProps) {
  const {
    classNames: propClassNames,
    modifiers: propModifiers,
    modifiersStyles: propModifiersStyles,
    modifiersClassNames: propModifiersClassNames,
    mode: propMode,
    ...restProps
  } = props;
  const holidayDates = React.useMemo(() => {
    if (!holidays || !Array.isArray(holidays) || holidays.length === 0) {
      return [];
    }

    return holidays
      .map((h) => {
        if (!h || !h.holiday_date) {
          return null;
        }

        try {
          return parse(h.holiday_date, "yyyy-MM-dd", new Date());
        } catch (error) {
          console.error("Error parsing holiday date:", h.holiday_date, error);
          return null;
        }
      })
      .filter(Boolean) as Date[];
  }, [holidays]);

  const holidayMap = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    holidayDates.forEach((date) => {
      if (date) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        map[key] = true;
      }
    });
    return map;
  }, [holidayDates]);

  // Create a map of absence dates with their codes
  const absenceMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    absenceDates.forEach((item) => {
      if (item && item.date) {
        map[item.date] = item.code;
      }
    });
    return map;
  }, [absenceDates]);

  // Helper to check if date has a specific absence type
  const hasAbsenceType = React.useCallback(
    (date: Date, codes: string[]) => {
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const code = absenceMap[dateKey];
      return code ? codes.includes(code) : false;
    },
    [absenceMap],
  );

  // Helper to get heat map level (1-5) based on count
  const getHeatMapLevel = React.useCallback(
    (date: Date): number => {
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const count = heatMapData[dateKey] || 0;
      if (count === 0) return 0;
      // Calculate level 1-5 based on count relative to max
      const ratio = count / Math.max(heatMapMax, 1);
      if (ratio <= 0.2) return 1;
      if (ratio <= 0.4) return 2;
      if (ratio <= 0.6) return 3;
      if (ratio <= 0.8) return 4;
      return 5;
    },
    [heatMapData, heatMapMax],
  );

  // Check if heat map mode is active (has any data)
  const isHeatMapActive = Object.keys(heatMapData).length > 0;

  const modifiers = React.useMemo(
    () => ({
      ...propModifiers,
      weekend: (date: Date) => date.getDay() === 0 || date.getDay() === 6,
      holiday: (date: Date) => {
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        return !!holidayMap[dateKey];
      },
      // General absence (fallback)
      absence: (date: Date) => {
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        return !!absenceMap[dateKey];
      },
      // Specific absence types for coloring
      absenceFerias: (date: Date) => hasAbsenceType(date, ["H", "H1", "H2"]),
      absenceFalta: (date: Date) => hasAbsenceType(date, ["F", "F1", "F2"]),
      absenceBaixa: (date: Date) => hasAbsenceType(date, ["S"]),
      absenceLicenca: (date: Date) => hasAbsenceType(date, ["M"]),
      absenceRemoto: (date: Date) => hasAbsenceType(date, ["W"]),
      absenceFormacao: (date: Date) => hasAbsenceType(date, ["B"]),
      absenceCompensacao: (date: Date) => hasAbsenceType(date, ["C", "L"]),
      absenceOutro: (date: Date) => hasAbsenceType(date, ["N"]),
      // Heat map levels (1-5)
      heatMap1: (date: Date) => isHeatMapActive && getHeatMapLevel(date) === 1,
      heatMap2: (date: Date) => isHeatMapActive && getHeatMapLevel(date) === 2,
      heatMap3: (date: Date) => isHeatMapActive && getHeatMapLevel(date) === 3,
      heatMap4: (date: Date) => isHeatMapActive && getHeatMapLevel(date) === 4,
      heatMap5: (date: Date) => isHeatMapActive && getHeatMapLevel(date) === 5,
    }),
    [
      propModifiers,
      holidayMap,
      absenceMap,
      hasAbsenceType,
      isHeatMapActive,
      getHeatMapLevel,
    ],
  );

  const formatters = React.useMemo(
    () => ({
      formatWeekdayName: (date: Date) => {
        const day = date.getDay();
        const weekdayLabels = ["D", "2ª", "3ª", "4ª", "5ª", "6ª", "S"];
        return weekdayLabels[day];
      },
    }),
    [],
  );

  const mergedModifiersStyles = React.useMemo(
    () => ({
      ...propModifiersStyles,
      // Use global CSS for weekend/holiday/today to ensure consistent override order
      weekend: { ...(propModifiersStyles?.weekend || {}) },
      holiday: { ...(propModifiersStyles?.holiday || {}) },
      today: { ...(propModifiersStyles?.today || {}) },
    }),
    [propModifiersStyles],
  );

  const mergedClassNames = React.useMemo(
    () => ({
      ...propClassNames,
      day: cn("rdp-day focus-visible:outline-none", propClassNames?.day),
      day_selected: cn(
        "rdp-day_selected bg-primary text-primary-foreground hover:bg-primary focus:bg-primary",
        propClassNames?.day_selected,
      ),
      day_today: cn("rdp-day_today text-foreground", propClassNames?.day_today),
      head_row: cn(
        "rdp-head_row bg-primary text-black",
        propClassNames?.head_row,
      ),
      head_cell: cn("text-black font-semibold", propClassNames?.head_cell),
      caption: cn("px-4 pt-3 pb-2 text-black", propClassNames?.caption),
      month: cn("bg-background", propClassNames?.month),
    }),
    [propClassNames],
  );

  const mergedModifierClassNames = React.useMemo(
    () => ({
      ...propModifiersClassNames,
      weekend: cn("rdp-weekend", propModifiersClassNames?.weekend),
      holiday: cn("rdp-holiday", propModifiersClassNames?.holiday),
      absence: cn("rdp-absence", propModifiersClassNames?.absence),
      // Specific absence type classes
      absenceFerias: cn(
        "rdp-absence-ferias",
        propModifiersClassNames?.absenceFerias,
      ),
      absenceFalta: cn(
        "rdp-absence-falta",
        propModifiersClassNames?.absenceFalta,
      ),
      absenceBaixa: cn(
        "rdp-absence-baixa",
        propModifiersClassNames?.absenceBaixa,
      ),
      absenceLicenca: cn(
        "rdp-absence-licenca",
        propModifiersClassNames?.absenceLicenca,
      ),
      absenceRemoto: cn(
        "rdp-absence-remoto",
        propModifiersClassNames?.absenceRemoto,
      ),
      absenceFormacao: cn(
        "rdp-absence-formacao",
        propModifiersClassNames?.absenceFormacao,
      ),
      absenceCompensacao: cn(
        "rdp-absence-compensacao",
        propModifiersClassNames?.absenceCompensacao,
      ),
      absenceOutro: cn(
        "rdp-absence-outro",
        propModifiersClassNames?.absenceOutro,
      ),
      // Heat map levels
      heatMap1: cn("rdp-heatmap-1", propModifiersClassNames?.heatMap1),
      heatMap2: cn("rdp-heatmap-2", propModifiersClassNames?.heatMap2),
      heatMap3: cn("rdp-heatmap-3", propModifiersClassNames?.heatMap3),
      heatMap4: cn("rdp-heatmap-4", propModifiersClassNames?.heatMap4),
      heatMap5: cn("rdp-heatmap-5", propModifiersClassNames?.heatMap5),
    }),
    [propModifiersClassNames],
  );

  // Force week to start on Monday via locale override
  const mondayLocale = React.useMemo(
    () => ({
      ...pt,
      options: { ...(pt as any).options, weekStartsOn: 1 },
    }),
    [],
  );

  return (
    <div className="calendar-wrapper">
      <DayPicker
        // Default locale overridden to Monday start; can be overridden by props
        locale={props.locale ?? mondayLocale}
        mode={onDayClick ? "single" : propMode}
        modifiers={modifiers}
        formatters={formatters}
        modifiersStyles={mergedModifiersStyles}
        className={cn("rdp", className)}
        // Spread incoming props first so we can override selectively
        {...restProps}
        // Our merged class names come last so they are applied
        classNames={mergedClassNames}
        modifiersClassNames={mergedModifierClassNames}
        // Map legacy onDayClick to DayPicker onSelect if not provided
        onSelect={
          restProps.onSelect ??
          (onDayClick
            ? (date: any) => {
                if (!date) return;
                onDayClick(date as Date);
              }
            : undefined)
        }
      />
    </div>
  );
}

export { Calendar };
