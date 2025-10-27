'use client'
import React, { useRef } from 'react'
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
  onSelect?: (date: Date | undefined) => void
}

export const FullYearCalendar: React.FC<FullYearCalendarProps> = ({
  holidays = [],
  year = new Date().getFullYear(),
  onSelect,
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
    <>
      <style>{`
        .rdp-nav_button {
          display: none !important;
        }
      `}</style>
      <div
        ref={calendarContainerRef}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full"
        data-no-aria-hidden="true"
      >
        {months.map((monthDate) => (
          <div
            key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
            className="rounded-none p-2 w-full"
            data-no-aria-hidden="true"
          >
            <Calendar
              mode="single"
              month={monthDate}
              selected={undefined}
              holidays={holidays}
              showOutsideDays={false}
              onSelect={onSelect}
              classNames={{
                day: 'size-8 p-0 font-normal border-none outline-none focus:outline-none focus:ring-0 cursor-pointer text-center',
                caption_label: 'text-lg font-semibold uppercase',
                nav: 'hidden',
              }}
            />
          </div>
        ))}
      </div>
    </>
  )
}
