'use client'
import React, { useRef, memo } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { useAccessibilityFixes } from '@/utils/accessibility'

interface Holiday {
  id: string
  holiday_date: string
  description?: string
}

interface FullYearCalendarProps {
  holidays?: Holiday[]
  year?: number
  selectedDate?: Date
  onDateSelect?: (date: Date | undefined) => void
}

const FullYearCalendarInternal: React.FC<FullYearCalendarProps> = ({
  holidays = [],
  year = new Date().getFullYear(),
  selectedDate,
  onDateSelect,
}) => {
  useAccessibilityFixes()

  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()

  const months = [
    new Date(currentMonth === 0 ? currentYear - 1 : currentYear, (currentMonth - 1 + 12) % 12, 1),
    new Date(currentYear, currentMonth, 1),
    new Date(currentMonth === 11 ? currentYear + 1 : currentYear, (currentMonth + 1) % 12, 1),
  ]

  const calendarContainerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={calendarContainerRef}
      className="flex flex-wrap justify-center gap-8"
      data-no-aria-hidden="true"
    >
      {months.map((monthDate) => (
        <div
          key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
          className="rounded-none p-2 flex justify-center flex-shrink-0 w-full md:w-[calc((100%-2rem)/2)] lg:w-[calc((100%-2rem)/3)]"
          data-no-aria-hidden="true"
        >
          <Calendar
            month={monthDate}
            holidays={holidays}
            showOutsideDays={false}
            mode="single"
            selected={selectedDate}
            onSelect={onDateSelect}
            classNames={{
              month_caption: 'text-lg font-semibold uppercase text-center mb-2',
            }}
          />
        </div>
      ))}
    </div>
  )
}

export const FullYearCalendar = memo(FullYearCalendarInternal)
