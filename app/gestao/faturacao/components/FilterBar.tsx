import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { XSquare, RotateCw } from "lucide-react";

interface FilterBarProps {
    filters: {
        fo: string;
        orc: string;
        campanha: string;
        cliente: string;
    };
    onFilterChange: (key: string, value: string) => void;
    onClear: () => void;
    onRefresh: () => void;
    isRefreshing: boolean;
}

export function FilterBar({
    filters,
    onFilterChange,
    onClear,
    onRefresh,
    isRefreshing,
}: FilterBarProps) {
    const hasActiveFilters =
        filters.fo || filters.orc || filters.campanha || filters.cliente;

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1">
                    <Input
                        placeholder="Filtrar por FO..."
                        value={filters.fo}
                        onChange={(e) => onFilterChange("fo", e.target.value)}
                        className="h-10 pr-10"
                    />
                    {filters.fo && (
                        <Button
                            variant="default"
                            size="icon"
                            className="absolute right-0 top-0 h-10 w-10"
                            onClick={() => onFilterChange("fo", "")}
                        >
                            <XSquare className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                <div className="relative flex-1">
                    <Input
                        placeholder="Filtrar por ORC..."
                        value={filters.orc}
                        onChange={(e) => onFilterChange("orc", e.target.value)}
                        className="h-10 pr-10"
                    />
                    {filters.orc && (
                        <Button
                            variant="default"
                            size="icon"
                            className="absolute right-0 top-0 h-10 w-10"
                            onClick={() => onFilterChange("orc", "")}
                        >
                            <XSquare className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                <div className="relative flex-1">
                    <Input
                        placeholder="Filtrar por campanha..."
                        value={filters.campanha}
                        onChange={(e) => onFilterChange("campanha", e.target.value)}
                        className="h-10 pr-10"
                    />
                    {filters.campanha && (
                        <Button
                            variant="default"
                            size="icon"
                            className="absolute right-0 top-0 h-10 w-10"
                            onClick={() => onFilterChange("campanha", "")}
                        >
                            <XSquare className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                <div className="relative flex-1">
                    <Input
                        placeholder="Filtrar por cliente..."
                        value={filters.cliente}
                        onChange={(e) => onFilterChange("cliente", e.target.value)}
                        className="h-10 pr-10"
                    />
                    {filters.cliente && (
                        <Button
                            variant="default"
                            size="icon"
                            className="absolute right-0 top-0 h-10 w-10"
                            onClick={() => onFilterChange("cliente", "")}
                        >
                            <XSquare className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={onClear}
                                disabled={!hasActiveFilters}
                            >
                                <XSquare className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Limpar Filtros</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={onRefresh}
                                disabled={isRefreshing}
                            >
                                <RotateCw
                                    className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                                />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {isRefreshing
                                ? "A atualizar PHC e verificar faturas..."
                                : "Atualizar e verificar faturas"}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    );
}
