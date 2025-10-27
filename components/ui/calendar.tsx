'use client'

import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { parse } from 'date-fns'
import { pt } from 'date-fns/locale'
import 'react-day-picker/style.css'

import { cn } from '@/utils/tailwind'

export interface CalendarProps extends React.ComponentProps<typeof DayPicker> {
  holidays?: { holiday_date: string }[]
}

function Calendar({
  className,
  holidays = [],
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

  return (
    <div className="calendar-wrapper">
      <DayPicker
        locale={pt}
        modifiers={modifiers}
        formatters={formatters}
        modifiersStyles={{
          weekend: { backgroundColor: 'var(--input)' },
          holiday: { fontWeight: '700', color: 'oklch(0.63 0.23 25)' },
        }}
        className={cn('rdp', className)}
        {...props}
      />
    </div>
  )
}

export { Calendar }
