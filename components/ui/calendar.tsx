'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { format, parse, isSameDay } from 'date-fns'
import { pt } from 'date-fns/locale'

import { cn } from '@/utils/tailwind'
import { buttonVariants } from '@/components/ui/button'

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  holidays = [],
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  holidays?: { holiday_date: string }[]
}) {
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

  const modifiersStyles = React.useMemo(
    () => ({
      weekend: { backgroundColor: 'var(--secondary-background)' },
      today: { backgroundColor: 'var(--orange)', color: 'var(--color-accent-foreground)' },
    }),
    []
  )

  const modifiersClassNames = React.useMemo(
    () => ({
      holiday: 'rdp-day_holiday',
    }),
    []
  )

  const rootRef = React.useRef<HTMLDivElement>(null)

  const handleFocusIn = React.useCallback((e: FocusEvent) => {
    const parent = rootRef.current?.closest('[aria-hidden="true"]')
    if (parent) {
      parent.removeAttribute('aria-hidden')
    }
  }, [])

  React.useEffect(() => {
    const root = rootRef.current
    if (!root) return

    root.addEventListener('focusin', handleFocusIn)

    return () => {
      root.removeEventListener('focusin', handleFocusIn)
    }
  }, [handleFocusIn])

  return (
    <div ref={rootRef} className="calendar-wrapper" data-no-aria-hidden="true">
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn('p-3 calendar-custom', className)}
        locale={pt}
        modifiers={modifiers}
        modifiersStyles={modifiersStyles}
        modifiersClassNames={modifiersClassNames}
        classNames={{
          months: 'flex flex-col sm:flex-row gap-2',
          month: 'flex flex-col gap-4',
          caption: 'flex justify-center pt-1 relative items-center w-full',
          caption_label: 'text-sm font-medium',
          nav: 'flex items-center gap-1',
          nav_button: cn(
            buttonVariants({ variant: 'outline' }),
            'size-7 bg-transparent p-0 opacity-50 hover:opacity-100'
          ),
          nav_button_previous: 'absolute left-1',
          nav_button_next: 'absolute right-1',
          table: 'w-full border-collapse space-x-1',
          head_row: 'flex',
          head_cell: 'text-muted-foreground rounded-md w-8 font-bold text-[0.8rem]',
          row: 'flex w-full mt-2',
          cell: 'relative p-0 text-center text-sm',
          day: cn(
            buttonVariants({ variant: 'outline' }),
            'size-8 p-0 font-normal aria-selected:opacity-100 border-none outline-none'
          ),
          day_range_start:
            'day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground',
          day_range_end:
            'day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground',
          day_selected:
            'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
          day_today: 'bg-accent text-accent-foreground',
          day_outside: 'day-outside text-muted-foreground aria-selected:text-muted-foreground',
          day_disabled: 'text-muted-foreground opacity-50',
          day_range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
          day_hidden: 'invisible',
          ...classNames,
        }}
        components={{
          IconLeft: ({ className, ...props }) => (
            <ChevronLeft className={cn('size-4', className)} {...props} />
          ),
          IconRight: ({ className, ...props }) => (
            <ChevronRight className={cn('size-4', className)} {...props} />
          ),
        }}
        {...props}
      />
    </div>
  )
}

export { Calendar }
