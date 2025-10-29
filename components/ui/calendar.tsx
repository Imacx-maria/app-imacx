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
      ...props.modifiers,
      weekend: (date: Date) => date.getDay() === 0 || date.getDay() === 6,
      holiday: (date: Date) => {
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        return !!holidayMap[dateKey]
      },
    }),
    [props.modifiers, holidayMap]
  )

  const formatters = React.useMemo(() => ({
    formatWeekdayName: (date: Date) => {
      const day = date.getDay()
      const weekdayLabels = ['D', '2ª', '3ª', '4ª', '5ª', '6ª', 'S']
      return weekdayLabels[day]
    }
  }), [])

  const mergedClassNames = React.useMemo(
    () => ({
      ...props.classNames,
      day: cn(
        'focus-visible:outline-none text-[var(--foreground)]',
        props.classNames?.day,
      ),
      day_selected: cn(
        'bg-[var(--orange)] text-[var(--primary-foreground)] hover:bg-[var(--orange)] focus:bg-[var(--orange)] focus-visible:bg-[var(--orange)] focus-visible:outline-none focus-visible:ring-0 border border-transparent',
        props.classNames?.day_selected,
      ),
      head_row: cn(
        'bg-[var(--primary)] text-[var(--primary-foreground)]',
        props.classNames?.head_row,
      ),
      head_cell: cn('text-[var(--foreground)]', props.classNames?.head_cell),
      caption: cn('px-4 pt-3 pb-2 text-[var(--foreground)]', props.classNames?.caption),
      month: cn('bg-background', props.classNames?.month),
    }),
    [props.classNames],
  )

  return (
    <div className="calendar-wrapper">
      <DayPicker
        // Default locale; can be overridden by props
        locale={pt}
        mode={onDayClick ? 'single' : props.mode}
        modifiers={modifiers}
        formatters={formatters}
        modifiersStyles={{
          weekend: { backgroundColor: 'var(--input)' },
          holiday: { fontWeight: '700', color: 'oklch(0.63 0.23 25)' },
        }}
        className={cn('rdp', className)}
        // Spread incoming props first so we can override selectively
        {...props}
        // Our merged class names come last so they are applied
        classNames={mergedClassNames}
        // Map legacy onDayClick to DayPicker onSelect if not provided
        onSelect={
          props.onSelect ??
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
