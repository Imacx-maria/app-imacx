"use client"

import { useCallback, useEffect, useState } from "react"
import CreatableDesignerCombobox from "@/components/forms/CreatableDesignerCombobox"

interface DesignerSelectorProps {
  jobId: string
  supabase: any
}

export const DesignerSelector = ({ jobId, supabase }: DesignerSelectorProps) => {
  const [designerId, setDesignerId] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDesigner = async () => {
      try {
        const { data, error } = await supabase
          .from("designer_items")
          .select("designer, items_base!inner(folha_obra_id)")
          .eq("items_base.folha_obra_id", jobId)
          .limit(1)

        if (!error && data && data.length > 0 && data[0]?.designer) {
          setDesignerId(data[0].designer)
        }
      } catch (error) {
        console.warn("Designer lookup failed", error)
      } finally {
        setLoading(false)
      }
    }

    fetchDesigner()
  }, [jobId, supabase])

  const handleChange = useCallback(
    async (newDesignerId: string) => {
      setDesignerId(newDesignerId)

      try {
        const { data: itemsData } = await supabase
          .from("designer_items")
          .select("id, items_base!inner(folha_obra_id)")
          .eq("items_base.folha_obra_id", jobId)

        if (itemsData && itemsData.length > 0) {
          const updates = itemsData.map((item: any) =>
            supabase
              .from("designer_items")
              .update({ designer: newDesignerId || null })
              .eq("id", item.id),
          )

          await Promise.all(updates)
        }
      } catch (error) {
        console.error("Error updating designer:", error)
      }
    },
    [jobId, supabase],
  )

  if (loading) {
    return <div className="text-xs text-muted-foreground">Loading...</div>
  }

  return (
    <CreatableDesignerCombobox
      value={designerId}
      onChange={handleChange}
      placeholder="Select designer..."
      className="w-full max-w-[144px]"
      showLabel={false}
    />
  )
}
