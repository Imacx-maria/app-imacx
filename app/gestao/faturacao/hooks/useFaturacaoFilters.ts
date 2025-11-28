import { useState, useMemo, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";

export function useFaturacaoFilters() {
    const [filters, setFilters] = useState({
        fo: "",
        orc: "",
        campanha: "",
        cliente: "",
    });

    const debouncedFo = useDebounce(filters.fo, 300);
    const debouncedOrc = useDebounce(filters.orc, 300);
    const debouncedCampanha = useDebounce(filters.campanha, 300);
    const debouncedCliente = useDebounce(filters.cliente, 300);

    // Memoize to prevent new object reference on every render
    const debouncedFilters = useMemo(() => ({
        fo: debouncedFo,
        orc: debouncedOrc,
        campanha: debouncedCampanha,
        cliente: debouncedCliente,
    }), [debouncedFo, debouncedOrc, debouncedCampanha, debouncedCliente]);

    const setFilter = useCallback((key: string, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }, []);

    const clearFilters = useCallback(() => {
        setFilters({
            fo: "",
            orc: "",
            campanha: "",
            cliente: "",
        });
    }, []);

    return {
        filters,
        debouncedFilters,
        setFilter,
        clearFilters,
    };
}
