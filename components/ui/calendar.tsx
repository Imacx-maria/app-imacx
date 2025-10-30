'use client'

import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { parse } from 'date-fns'
import { pt } from 'date-fns/locale'
import 'react-day-picker/style.css'

import { cn } from '@/utils/tailwind'

export interface CalendarProps {
  holidays?: { holiday_date: string }[]
  // Ensure compatibility with usages in the app and different DayPicker versions
  month?: Date
  onDayClick?: (date: Date) => void
  showOutsideDays?: boolean
  // Compatibility shims for projects passing these props explicitly
  mode?: any
  initialFocus?: boolean
  selected?: any
  onSelect?: any
  classNames?: any
  modifiers?: any
  [key: string]: any
}

function Calendar({
  className,
  holidays = [],
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
  } = props
  const holidayDates = React.useMemo(() => {
    if (!holidays || !Array.isArray(holidays) || holidays.length === 0) {
      return []
    }

    return holidays
      .map(h => {
        if (!h || !h.holiday_date) {
          return null
        }

        try {
          return parse(h.holiday_date, 'yyyy-MM-dd', new Date())
        } catch (error) {
          console.error('Error parsing holiday date:', h.holiday_date, error)
          return null
        }
      })
      .filter(Boolean) as Date[]
  }, [holidays])

  const holidayMap = React.useMemo(() => {
    const map: Record<string, boolean> = {}
    holidayDates.forEach(date => {
      if (date) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        map[key] = true
      }
    })
    return map
  }, [holidayDates])

  const modifiers = React.useMemo(
    () => ({
      ...propModifiers,
      weekend: (date: Date) => date.getDay() === 0 || date.getDay() === 6,
      holiday: (date: Date) => {
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        return !!holidayMap[dateKey]
      },
    }),
    [propModifiers, holidayMap]
  )

  const formatters = React.useMemo(() => ({
    formatWeekdayName: (date: Date) => {
      const day = date.getDay()
      const weekdayLabels = ['D', '2ª', '3ª', '4ª', '5ª', '6ª', 'S']
      return weekdayLabels[day]
    }
  }), [])

  const mergedModifiersStyles = React.useMemo(
    () => ({
      ...propModifiersStyles,
      // Use global CSS for weekend/holiday/today to ensure consistent override order
      weekend: { ...(propModifiersStyles?.weekend || {}) },
      holiday: { ...(propModifiersStyles?.holiday || {}) },
      today: { ...(propModifiersStyles?.today || {}) },
    }),
    [propModifiersStyles],
  )

  const mergedClassNames = React.useMemo(() => ({
    ...propClassNames,
    day: cn('rdp-day focus-visible:outline-none', propClassNames?.day),
    day_selected: cn(
      'rdp-day_selected bg-[var(--orange)] text-black hover:bg-[var(--orange)] focus:bg-[var(--orange)]',
      propClassNames?.day_selected,
    ),
    day_today: cn('rdp-day_today text-foreground', propClassNames?.day_today),
    head_row: cn('rdp-head_row bg-primary text-black', propClassNames?.head_row),
    head_cell: cn('text-black font-semibold', propClassNames?.head_cell),
    caption: cn('px-4 pt-3 pb-2 text-black', propClassNames?.caption),
    month: cn('bg-background', propClassNames?.month),
  }), [propClassNames])

  const mergedModifierClassNames = React.useMemo(() => ({
    ...propModifiersClassNames,
    weekend: cn('rdp-weekend', propModifiersClassNames?.weekend),
    holiday: cn('rdp-holiday', propModifiersClassNames?.holiday),
  }), [propModifiersClassNames])

  // Force week to start on Monday via locale override
  const mondayLocale = React.useMemo(() => ({
    ...pt,
    options: { ...(pt as any).options, weekStartsOn: 1 },
  }), [])

  return (
    <div className="calendar-wrapper">
      <DayPicker
        // Default locale overridden to Monday start; can be overridden by props
        locale={props.locale ?? mondayLocale}
        mode={onDayClick ? 'single' : propMode}
        modifiers={modifiers}
        formatters={formatters}
        modifiersStyles={mergedModifiersStyles}
        className={cn('rdp', className)}
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
                if (!date) return
                onDayClick(date as Date)
              }
            : undefined)
        }
      />
    </div>
  )
}

export { Calendar }
