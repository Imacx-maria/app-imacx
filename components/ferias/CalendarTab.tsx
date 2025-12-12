"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RotateCw, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import {
  useCalendarData,
  useHolidays,
  useDepartamentos,
  useRHEmployees,
} from "@/hooks/useFerias";
import type { CalendarFilters, CalendarDayData } from "@/types/ferias";
import { formatDateDisplay } from "@/utils/ferias/vacationHelpers";
import { Calendar } from "@/components/ui/calendar";
import { useAccessibilityFixes } from "@/utils/accessibility";

// Situation type CSS classes (using CSS variables)
const getSituationClass = (code: string): string => {
  const classes: Record<string, string> = {
    H: "bg-green-500/80",
    H1: "bg-green-400/60",
    H2: "bg-green-400/60",
    F: "bg-red-500/80",
    F1: "bg-red-400/60",
    F2: "bg-red-400/60",
    E: "bg-red-400/60", // Deprecated - kept for legacy data fallback
    S: "bg-orange-500/80",
    M: "bg-purple-500/80",
    L: "bg-gray-500/80",
    W: "bg-blue-500/80",
    B: "bg-yellow-500/80",
    C: "bg-cyan-500/80",
    N: "bg-pink-500/80",
  };
  return classes[code] || "bg-gray-400/60";
};

export default function CalendarTab() {
  const currentYear = new Date().getFullYear();

  // State
  const [year, setYear] = useState(currentYear);
  const [departamentoFilter, setDepartamentoFilter] = useState<string>("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedDay, setSelectedDay] = useState<{
    date: Date;
    data: CalendarDayData[];
  } | null>(null);

  // Debounced search for employee
  const debouncedEmployeeSearch = useDebounce(employeeSearch, 300);

  // Build filters (employee search is handled client-side)
  const filters: CalendarFilters = useMemo(
    () => ({
      year,
      departamento_id: departamentoFilter
        ? parseInt(departamentoFilter)
        : undefined,
    }),
    [year, departamentoFilter],
  );

  // Hooks
  const showNextQuarter = year === currentYear;
  const { dataByDate, loading, error, refresh } = useCalendarData(filters, {
    includeNextQuarter: showNextQuarter,
  });
  const { holidays, isHoliday, getHolidayName } = useHolidays(year, {
    includeNextQuarter: showNextQuarter,
  });
  const { departamentos } = useDepartamentos();
  const { employees } = useRHEmployees({ is_active: true });

  const departamentosWithPeople = useMemo(() => {
    if (!employees.length) return departamentos;
    const deptIds = new Set(
      employees
        .map((e) => e.departamento_id)
        .filter((id): id is number => typeof id === "number"),
    );
    return departamentos.filter((d) => deptIds.has(d.id));
  }, [departamentos, employees]);

  // Generate year options
  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  // Filter calendar data by employee search (client-side)
  const filteredDataByDate = useMemo(() => {
    if (!debouncedEmployeeSearch.trim()) return dataByDate;
    const search = debouncedEmployeeSearch.toLowerCase();
    const filtered: Record<string, CalendarDayData[]> = {};
    for (const [date, data] of Object.entries(dataByDate)) {
      const matchingData = data.filter(
        (d) =>
          d.employee_name.toLowerCase().includes(search) ||
          d.employee_sigla.toLowerCase().includes(search),
      );
      if (matchingData.length > 0) {
        filtered[date] = matchingData;
      }
    }
    return filtered;
  }, [dataByDate, debouncedEmployeeSearch]);

  // Clear filters
  const handleClearFilters = () => {
    setDepartamentoFilter("");
    setEmployeeSearch("");
  };

  // Handle day click - always show full data for the day (respecting department filter)
  // When in heat map mode, we show all people on vacation
  // When searching an employee, we still show all people (context is useful)
  const handleDayClick = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    // Use dataByDate (not filteredDataByDate) to show everyone on that day
    const dayData = dataByDate[dateStr] || [];
    setSelectedDay({ date, data: dayData });
  };

  // Use accessibility fixes for calendar
  useAccessibilityFixes();

  // Convert holidays to format expected by Calendar component
  const calendarHolidays = useMemo(() => {
    return holidays.map((h) => ({
      id: h.id,
      holiday_date: h.holiday_date,
      description: h.description || "",
    }));
  }, [holidays]);

  // Convert filtered absence data to format expected by Calendar component
  // Only show absence highlights when an employee is specifically searched
  const absenceDatesForCalendar = useMemo(() => {
    // Don't highlight if no employee search is active
    if (!debouncedEmployeeSearch.trim()) {
      return [];
    }

    const dates: { date: string; code: string }[] = [];
    for (const [date, data] of Object.entries(filteredDataByDate)) {
      if (data.length > 0) {
        // Use the first absence type code for coloring
        dates.push({ date, code: data[0].situation_type_code });
      }
    }
    return dates;
  }, [filteredDataByDate, debouncedEmployeeSearch]);

  // Heat map data: count vacation (H, H1, H2) per day when department filter is active
  // This shows intensity of holidays regardless of employee search
  const { heatMapData, heatMapMax } = useMemo(() => {
    // Only show heat map when department filter is active (or "all" departments)
    // and no specific employee is searched
    if (debouncedEmployeeSearch.trim()) {
      return { heatMapData: {}, heatMapMax: 0 };
    }

    const vacationCodes = ["H", "H1", "H2"];
    const countByDate: Record<string, number> = {};
    let maxCount = 0;

    for (const [date, data] of Object.entries(dataByDate)) {
      // Count only vacation types
      const vacationCount = data.filter((d) =>
        vacationCodes.includes(d.situation_type_code),
      ).length;
      if (vacationCount > 0) {
        countByDate[date] = vacationCount;
        if (vacationCount > maxCount) {
          maxCount = vacationCount;
        }
      }
    }

    return { heatMapData: countByDate, heatMapMax: maxCount };
  }, [dataByDate, debouncedEmployeeSearch]);

  // Generate all 12 months for the year (plus Jan–Mar of next year when viewing current year)
  const months = useMemo(() => {
    const monthCount = 12 + (showNextQuarter ? 3 : 0);
    return Array.from({ length: monthCount }, (_, i) => new Date(year, i, 1));
  }, [year, showNextQuarter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Calendario Anual</h2>
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => refresh()}>
                  <RotateCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Atualizar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(parseInt(v))}
          >
            <SelectTrigger className="h-10 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Input
          placeholder="Pesquisar colaborador..."
          value={employeeSearch}
          onChange={(e) => setEmployeeSearch(e.target.value)}
          className="h-10 w-96"
        />
        <Select
          value={departamentoFilter || "all"}
          onValueChange={(value) =>
            setDepartamentoFilter(value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="h-10 w-40">
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {departamentosWithPeople.map((dept) => (
              <SelectItem key={dept.id} value={String(dept.id)}>
                {dept.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={handleClearFilters}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Limpar filtros</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {/* Heat map legend - shown when no employee search is active */}
        {!debouncedEmployeeSearch.trim() && (
          <>
            <div className="flex items-center gap-1 mr-2">
              <span className="text-muted-foreground">Ferias:</span>
            </div>
            <div className="flex items-center gap-0.5">
              <div className="w-3 h-3 bg-orange-200" title="1 pessoa" />
              <div className="w-3 h-3 bg-orange-300" title="2 pessoas" />
              <div className="w-3 h-3 bg-orange-400" title="3 pessoas" />
              <div className="w-3 h-3 bg-orange-500" title="4 pessoas" />
              <div className="w-3 h-3 bg-orange-600" title="5+ pessoas" />
              <span className="ml-1">menos → mais</span>
            </div>
            <div className="w-px h-4 bg-border mx-2" />
          </>
        )}
        {/* Standard legend for employee search */}
        {debouncedEmployeeSearch.trim() && (
          <>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500/80" />
              <span>Ferias</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500/80" />
              <span>Falta</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-orange-500/80" />
              <span>Baixa</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-purple-500/80" />
              <span>Licenca</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500/80" />
              <span>Remoto</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500/80" />
              <span>Formacao</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-cyan-500/80" />
              <span>Compensacao</span>
            </div>
          </>
        )}
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-muted" />
          <span>Fim-de-semana</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-calendar-holiday-bg" />
          <span>Feriado</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Calendar grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div
          className={[
            // Auto-wrap based on available width so calendars never "touch".
            // 4 columns will only happen when there is enough space:
            // threshold ≈ 4*322 + 3*32 = 1384px (close to the requested ~1383px).
            "grid",
            "grid-cols-[repeat(auto-fit,minmax(322px,1fr))]",
            "gap-x-8 gap-y-10",
            "justify-items-center",
          ].join(" ")}
        >
          {months.map((monthDate) => {
            const month = monthDate.getMonth();
            const monthYear = monthDate.getFullYear();
            return (
              <div
                key={`${monthYear}-${month}`}
                className="w-full p-2 flex justify-center"
              >
                <Calendar
                  month={monthDate}
                  holidays={calendarHolidays}
                  absenceDates={absenceDatesForCalendar}
                  heatMapData={heatMapData}
                  heatMapMax={heatMapMax}
                  showOutsideDays={false}
                  mode="single"
                  onDayClick={handleDayClick}
                  classNames={{
                    month_caption:
                      "text-sm font-semibold uppercase text-center mb-2",
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Day Detail Sheet */}
      <Sheet open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {selectedDay && formatDateDisplay(selectedDay.date)}
            </SheetTitle>
            <SheetDescription>
              {selectedDay && isHoliday(selectedDay.date) && (
                <span className="text-pink-500">
                  {getHolidayName(selectedDay.date)}
                </span>
              )}
            </SheetDescription>
          </SheetHeader>
          {selectedDay && (
            <div className="mt-6 space-y-4">
              {selectedDay.data.filter((d) =>
                ["H", "H1", "H2"].includes(d.situation_type_code),
              ).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Sem férias neste dia.
                </p>
              ) : (
                <>
                  {/* Summary counts */}
                  <div className="flex flex-wrap gap-2 text-xs pb-2 imx-border-b">
                    {(() => {
                      const vacationCount = selectedDay.data.filter((d) =>
                        ["H", "H1", "H2"].includes(d.situation_type_code),
                      ).length;
                      return (
                        <>
                          <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 rounded">
                            {vacationCount} em férias
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  {/* List of people */}
                  <div className="space-y-2" role="list">
                    {[...selectedDay.data]
                      .filter((d) =>
                        ["H", "H1", "H2"].includes(d.situation_type_code),
                      )
                      .sort((a, b) =>
                        a.employee_name.localeCompare(b.employee_name),
                      )
                      .map((item, idx) => (
                        <div
                          key={idx}
                          role="listitem"
                          aria-label={`${item.situation_type_code} - ${item.employee_sigla} - ${item.employee_name}`}
                          className="flex items-center gap-3 p-3 imx-border"
                        >
                          <div
                            className={`w-3 h-3 rounded-full ${getSituationClass(
                              item.situation_type_code,
                            )}`}
                          />
                          <div className="flex-1">
                            <p className="text-sm">
                              <span className="font-medium">
                                {item.employee_sigla}
                              </span>{" "}
                              - {item.employee_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.situation_type_code} -{" "}
                              {item.situation_type_name}
                              {item.is_half_day && " (meio dia)"}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
