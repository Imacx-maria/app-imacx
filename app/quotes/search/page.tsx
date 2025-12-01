"use client";

import React, { useState } from "react";
import {
  Search,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Brain,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SearchMode = "standard" | "ai-semantic";

interface QtyLine {
  qty: number;
  total: number;
  unit_price: number;
  description: string;
}

interface SearchResult {
  document_number: string;
  document_date: string;
  total_value: number;
  description_preview?: string;
  qty_lines: QtyLine[];
  keyword_matches?: number;
  similarity: number;
}

interface SemanticPriceStats {
  min: number;
  max: number;
  typical: number;
  count: number;
}

interface QtyBandAverage {
  label: string;
  avgUnitPrice: number;
  count: number;
}

interface SemanticResponse {
  success: boolean;
  query: string;
  method: string;
  results: SearchResult[];
  priceStats: SemanticPriceStats | null;
  count: number;
  searchTime: number;
}

export default function QuoteSearchPage() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("standard");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<number>(0);
  const [sortField, setSortField] = useState<string>("document_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [semanticPriceStats, setSemanticPriceStats] =
    useState<SemanticPriceStats | null>(null);
  const [semanticLimit, setSemanticLimit] = useState<number>(30);
  const [semanticThreshold, setSemanticThreshold] = useState<number>(0.5);
  const [priceFilterMin, setPriceFilterMin] = useState<number | null>(null);
  const [priceFilterMax, setPriceFilterMax] = useState<number | null>(null);
  const [dateFilterStart, setDateFilterStart] = useState<string | null>(null);
  const [dateFilterEnd, setDateFilterEnd] = useState<string | null>(null);

  // Extract quantity from query (e.g., "crowner extensível quantidade 100" -> { product: "crowner extensível", qty: 100 })
  const parseQueryForQuantity = (
    input: string,
  ): { product: string; qty: number | null } => {
    const qtyPatterns = [
      /\b(?:quantidade|qt|qts|qtd|qty)\s*[:.]?\s*(\d+)\b/i,
      /\b(\d+)\s*(?:un|uns|unidades?)\b/i,
    ];

    let qty: number | null = null;
    let cleanQuery = input;

    for (const pattern of qtyPatterns) {
      const match = input.match(pattern);
      if (match) {
        qty = parseInt(match[1], 10);
        cleanQuery = input.replace(pattern, "").trim();
        break;
      }
    }

    // Also remove trailing numbers that look like quantities
    cleanQuery = cleanQuery.replace(/\s+\d+\s*$/, "").trim();

    return { product: cleanQuery, qty };
  };

  const handleSearch = async () => {
    if (!query.trim() || query.trim().length < 3) {
      setError("Digite pelo menos 3 caracteres para pesquisar");
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setSemanticPriceStats(null);
    setPriceFilterMin(null);
    setPriceFilterMax(null);
    setDateFilterStart(null);
    setDateFilterEnd(null);

    // Parse query to extract clean product terms
    const { product: cleanProduct } = parseQueryForQuantity(query.trim());

    try {
      if (mode === "standard") {
        // Standard search - use cleaned query without quantity
        const response = await fetch("/api/quotes/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: cleanProduct, limit: 100 }),
        });

        if (!response.ok) throw new Error("Erro na pesquisa");

        const data = await response.json();
        setResults(data.results);
        setSearchTime(0);
      } else if (mode === "ai-semantic") {
        // AI SEMANTIC - Vector embedding search
        const safeLimit = Math.max(
          1,
          Math.min(
            100,
            Number.isFinite(semanticLimit) ? Math.floor(semanticLimit) : 30,
          ),
        );
        const safeThreshold = Math.min(
          1,
          Math.max(
            0,
            Number.isFinite(semanticThreshold)
              ? Number.parseFloat(semanticThreshold.toString())
              : 0.3,
          ),
        );
        const response = await fetch("/api/quotes/semantic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: query.trim(),
            limit: safeLimit,
            threshold: safeThreshold,
          }),
        });

        if (!response.ok) throw new Error("Erro na pesquisa semantica");

        const data: SemanticResponse = await response.json();

        if (!data.success) {
          setError("Nenhum orcamento similar encontrado");
          setResults([]);
          return;
        }

        setResults(data.results || []);
        setSemanticPriceStats(data.priceStats);
        setSearchTime(data.searchTime);
      }
    } catch (err) {
      setError("Erro ao pesquisar. Tente novamente.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-PT");
  };

  const formatCurrency = (value: number) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("pt-PT").format(value);
  };

  const toggleExpand = (docNum: string) => {
    setExpandedQuote(expandedQuote === docNum ? null : docNum);
  };

  // Get primary qty line for display in results table
  const getPrimaryQtyLine = (qtyLines: QtyLine[]) => {
    if (!qtyLines || qtyLines.length === 0) return null;
    // Return the first line with qty > 0
    return qtyLines.find((l) => l.qty > 0) || qtyLines[0];
  };

  // Calculate average unit prices by quantity bands
  const calculateQtyBandAverages = (
    searchResults: SearchResult[],
  ): QtyBandAverage[] => {
    const bands = [
      { label: "QTD < 50", min: 0, max: 50 },
      { label: "QTD 51-150", min: 51, max: 150 },
      { label: "QTD 151-300", min: 151, max: 300 },
      { label: "TODOS", min: 0, max: Infinity },
    ];

    return bands.map((band) => {
      const matchingLines: number[] = [];

      searchResults.forEach((result) => {
        const primaryLine = getPrimaryQtyLine(result.qty_lines);
        if (primaryLine && primaryLine.unit_price > 0) {
          const qty = primaryLine.qty;
          if (band.label === "TODOS" || (qty >= band.min && qty <= band.max)) {
            matchingLines.push(primaryLine.unit_price);
          }
        }
      });

      const avgUnitPrice =
        matchingLines.length > 0
          ? matchingLines.reduce((sum, price) => sum + price, 0) /
            matchingLines.length
          : 0;

      return {
        label: band.label,
        avgUnitPrice,
        count: matchingLines.length,
      };
    });
  };

  const qtyBandAverages =
    results.length > 0 && mode === "ai-semantic"
      ? calculateQtyBandAverages(results)
      : [];

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Sort results
  const sortedResults = [...results].sort((a, b) => {
    const primaryLineA = getPrimaryQtyLine(a.qty_lines);
    const primaryLineB = getPrimaryQtyLine(b.qty_lines);

    let valA: number | string = 0;
    let valB: number | string = 0;

    switch (sortField) {
      case "document_number":
        valA = parseInt(a.document_number) || 0;
        valB = parseInt(b.document_number) || 0;
        break;
      case "document_date":
        valA = new Date(a.document_date).getTime();
        valB = new Date(b.document_date).getTime();
        break;
      case "qty":
        valA = primaryLineA?.qty || 0;
        valB = primaryLineB?.qty || 0;
        break;
      case "unit_price":
        valA = primaryLineA?.unit_price || 0;
        valB = primaryLineB?.unit_price || 0;
        break;
      case "keyword_matches":
        valA = a.keyword_matches || 0;
        valB = b.keyword_matches || 0;
        break;
      case "similarity":
        valA = a.similarity || 0;
        valB = b.similarity || 0;
        break;
      default:
        return 0;
    }

    if (sortDirection === "asc") {
      return valA > valB ? 1 : -1;
    }
    return valA < valB ? 1 : -1;
  });

  // Filter results by unit price and date
  const filteredResults = sortedResults.filter((result) => {
    const primaryLine = getPrimaryQtyLine(result.qty_lines);
    const unitPrice = primaryLine?.unit_price || 0;

    // Price filter
    if (priceFilterMin !== null && unitPrice < priceFilterMin) return false;
    if (priceFilterMax !== null && unitPrice > priceFilterMax) return false;

    // Date filter
    if (dateFilterStart || dateFilterEnd) {
      const resultDate = new Date(result.document_date);
      if (dateFilterStart) {
        const startDate = new Date(dateFilterStart);
        if (resultDate < startDate) return false;
      }
      if (dateFilterEnd) {
        const endDate = new Date(dateFilterEnd);
        endDate.setHours(23, 59, 59, 999); // Include the entire end day
        if (resultDate > endDate) return false;
      }
    }

    return true;
  });

  const hasActiveFilters =
    priceFilterMin !== null ||
    priceFilterMax !== null ||
    dateFilterStart !== null ||
    dateFilterEnd !== null;

  const clearAllFilters = () => {
    setPriceFilterMin(null);
    setPriceFilterMax(null);
    setDateFilterStart(null);
    setDateFilterEnd(null);
  };

  // Sortable header component
  const SortableHeader = ({
    field,
    children,
    className = "",
  }: {
    field: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead
      className={`cursor-pointer hover:bg-accent/50 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-normal mb-2">PESQUISA DE ORCAMENTOS</h1>
        <p className="text-sm text-muted-foreground">
          Encontre orcamentos semelhantes para referencia de precos
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="mb-4 flex gap-1">
        <Button
          variant={mode === "standard" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("standard")}
          className="gap-2"
        >
          <Search className="h-4 w-4" />
          STANDARD
        </Button>
        <Button
          variant={mode === "ai-semantic" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("ai-semantic")}
          className="gap-2"
        >
          <Brain className="h-4 w-4" />
          AI SEMANTIC
        </Button>
      </div>

      {/* Mode Description */}
      <div className="mb-4 text-xs text-muted-foreground">
        {mode === "standard" && "Pesquisa por palavras-chave (gratuito)"}
        {mode === "ai-semantic" &&
          "Pesquisa por significado - descreva o que precisa em linguagem natural"}
      </div>

      {/* Search Box */}
      <div className="mb-8 p-6 imx-border bg-card">
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Ex: expositor cartao 3mm prateleiras, vinil chao floorgraphic..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full"
            />
          </div>
          <Button onClick={handleSearch} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : mode === "standard" ? (
              <Search className="h-4 w-4 mr-2" />
            ) : (
              <Brain className="h-4 w-4 mr-2" />
            )}
            {isLoading
              ? mode === "ai-semantic"
                ? "A PROCURAR..."
                : "A PESQUISAR..."
              : "PESQUISAR"}
          </Button>
        </div>

        {mode === "ai-semantic" && (
          <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
            <label className="flex items-center gap-2">
              <span>RESULTADOS</span>
              <input
                type="number"
                min={1}
                max={100}
                value={semanticLimit}
                onChange={(e) => setSemanticLimit(Number(e.target.value) || 0)}
                className="w-20 bg-background imx-border px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>LIMIAR</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={semanticThreshold}
                onChange={(e) =>
                  setSemanticThreshold(Number.parseFloat(e.target.value) || 0)
                }
                className="w-20 bg-background imx-border px-2 py-1"
              />
            </label>
          </div>
        )}

        {/* Search Tips */}
        <div className="mt-4 text-xs text-muted-foreground">
          <span className="font-medium">DICAS:</span> Use palavras-chave como{" "}
          <code className="bg-accent px-1">expositor</code>,{" "}
          <code className="bg-accent px-1">cartao</code>,{" "}
          <code className="bg-accent px-1">vinil</code>,{" "}
          <code className="bg-accent px-1">crowner</code>,{" "}
          <code className="bg-accent px-1">prateleiras</code>,{" "}
          <code className="bg-accent px-1">floorgraphic</code>,{" "}
          <code className="bg-accent px-1">ilha</code>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 imx-border bg-destructive/10 text-destructive">
          {error}
        </div>
      )}

      {/* AI SEMANTIC Results Card */}
      {hasSearched &&
        !isLoading &&
        mode === "ai-semantic" &&
        semanticPriceStats && (
          <div className="mb-6 imx-border bg-card">
            <div className="p-4 imx-border-b bg-accent/50">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <span className="font-medium">PESQUISA SEMANTICA</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {results.length} resultados similares
                </span>
              </div>
            </div>

            <div className="p-4">
              {/* Price Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-4 bg-accent">
                  <div className="text-xs text-muted-foreground mb-1">
                    PRECO MINIMO
                  </div>
                  <div className="text-xl font-medium">
                    {formatCurrency(semanticPriceStats.min)}
                  </div>
                </div>
                <div className="p-4 bg-primary/30">
                  <div className="text-xs text-muted-foreground mb-1">
                    PRECO TIPICO
                  </div>
                  <div className="text-2xl font-medium">
                    {formatCurrency(semanticPriceStats.typical)}
                  </div>
                </div>
                <div className="p-4 bg-accent">
                  <div className="text-xs text-muted-foreground mb-1">
                    PRECO MAXIMO
                  </div>
                  <div className="text-xl font-medium">
                    {formatCurrency(semanticPriceStats.max)}
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground mb-2">
                PRECO UNITARIO MEDIO POR FAIXA DE QUANTIDADE
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {qtyBandAverages.map((band) => (
                  <span
                    key={band.label}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 imx-border ${band.label === "TODOS" ? "bg-primary/20" : "bg-accent/40"}`}
                  >
                    <span className="text-muted-foreground text-xs">
                      {band.label}
                    </span>
                    <span className="font-medium">
                      {band.count > 0 ? formatCurrency(band.avgUnitPrice) : "-"}
                    </span>
                    {band.count > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({band.count})
                      </span>
                    )}
                  </span>
                ))}
              </div>

              <div className="text-xs text-muted-foreground">
                Baseado em {semanticPriceStats.count} produtos principais dos
                orcamentos encontrados
              </div>

              {/* Filters */}
              <div className="mt-4 pt-4 imx-border-t">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    FILTROS
                  </span>
                  {hasActiveFilters && (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                      onClick={clearAllFilters}
                    >
                      Limpar todos
                    </button>
                  )}
                </div>

                {/* Price Filter */}
                <div className="mb-3">
                  <div className="text-xs text-muted-foreground mb-2">
                    PRECO UNITARIO
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">MIN:</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder="0"
                        value={priceFilterMin ?? ""}
                        onChange={(e) =>
                          setPriceFilterMin(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                        className="w-24 bg-background imx-border px-2 py-1"
                      />
                      <span className="text-muted-foreground">€</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">MAX:</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder="∞"
                        value={priceFilterMax ?? ""}
                        onChange={(e) =>
                          setPriceFilterMax(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                        className="w-24 bg-background imx-border px-2 py-1"
                      />
                      <span className="text-muted-foreground">€</span>
                    </label>
                  </div>
                </div>

                {/* Date Filter */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    DATA DO ORCAMENTO
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">DE:</span>
                      <input
                        type="date"
                        value={dateFilterStart ?? ""}
                        onChange={(e) =>
                          setDateFilterStart(e.target.value || null)
                        }
                        className="bg-background imx-border px-2 py-1"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">ATE:</span>
                      <input
                        type="date"
                        value={dateFilterEnd ?? ""}
                        onChange={(e) =>
                          setDateFilterEnd(e.target.value || null)
                        }
                        className="bg-background imx-border px-2 py-1"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Stats */}
            {searchTime > 0 && (
              <div className="px-4 py-2 imx-border-t bg-accent/30 text-xs text-muted-foreground flex flex-wrap gap-4">
                <span className="font-medium">
                  Modelo: OpenRouter text-embedding-3-small
                </span>
                <span>Tempo: {searchTime}ms</span>
              </div>
            )}
          </div>
        )}

      {/* Results */}
      {hasSearched &&
        !isLoading &&
        (mode === "standard" || mode === "ai-semantic") && (
          <div className="imx-border">
            <div className="p-4 imx-border-b bg-accent">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {filteredResults.length} ORCAMENTOS{" "}
                  {mode === "standard" ? "ENCONTRADOS" : "RELEVANTES"}
                  {hasActiveFilters &&
                    filteredResults.length !== results.length && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        (filtrado de {results.length})
                      </span>
                    )}
                </span>
                {results.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Clique numa linha para ver detalhes
                  </span>
                )}
              </div>
            </div>

            {results.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum orcamento encontrado para esta pesquisa.</p>
                <p className="text-sm mt-2">
                  Tente usar outras palavras-chave.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="document_number" className="w-20">
                      ORC #
                    </SortableHeader>
                    <SortableHeader field="document_date" className="w-24">
                      DATA
                    </SortableHeader>
                    <SortableHeader field="qty" className="w-24 text-right">
                      QTD
                    </SortableHeader>
                    <SortableHeader
                      field="unit_price"
                      className="w-28 text-right"
                    >
                      PRECO/UN
                    </SortableHeader>
                    {mode === "standard" && (
                      <SortableHeader
                        field="keyword_matches"
                        className="w-16 text-center"
                      >
                        MATCH
                      </SortableHeader>
                    )}
                    {mode === "ai-semantic" && (
                      <SortableHeader
                        field="similarity"
                        className="w-20 text-center"
                      >
                        SIMILAR
                      </SortableHeader>
                    )}
                    <TableHead>DESCRICAO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.map((result) => {
                    const primaryLine = getPrimaryQtyLine(result.qty_lines);
                    return (
                      <React.Fragment key={result.document_number}>
                        <TableRow
                          className="cursor-pointer hover:bg-accent/50"
                          onClick={() => toggleExpand(result.document_number)}
                        >
                          <TableCell className="font-medium">
                            {result.document_number}
                          </TableCell>
                          <TableCell>
                            {formatDate(result.document_date)}
                          </TableCell>
                          <TableCell className="text-right">
                            {primaryLine ? formatNumber(primaryLine.qty) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {primaryLine && primaryLine.unit_price
                              ? formatCurrency(primaryLine.unit_price)
                              : "-"}
                          </TableCell>
                          {mode === "standard" && (
                            <TableCell className="text-center">
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground text-xs">
                                {result.keyword_matches}
                              </span>
                            </TableCell>
                          )}
                          {mode === "ai-semantic" && (
                            <TableCell className="text-center">
                              <span className="inline-flex items-center justify-center px-2 py-0.5 bg-accent text-foreground text-xs">
                                {Math.round((result.similarity || 0) * 100)}%
                              </span>
                            </TableCell>
                          )}
                          <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                            {result.description_preview?.substring(0, 80) ||
                              primaryLine?.description?.substring(0, 80) ||
                              "-"}
                            ...
                          </TableCell>
                        </TableRow>

                        {/* Expanded Details */}
                        {expandedQuote === result.document_number && (
                          <TableRow>
                            <TableCell
                              colSpan={
                                mode === "standard" || mode === "ai-semantic"
                                  ? 6
                                  : 5
                              }
                              className="bg-accent/30 p-0"
                            >
                              <div className="p-4">
                                {/* Description Preview */}
                                {result.description_preview && (
                                  <div className="mb-4 specifications-container">
                                    <h4 className="text-xs font-medium mb-2 text-muted-foreground">
                                      ESPECIFICACOES
                                    </h4>
                                    <div className="text-xs text-foreground bg-background p-3 imx-border max-h-48 overflow-y-auto whitespace-pre-wrap">
                                      {result.description_preview
                                        .replace(/\\n/g, "\n")
                                        .split("\n")
                                        .map((line, idx) => (
                                          <div key={idx} className="py-0.5 text-foreground">
                                            {line || <span>&nbsp;</span>}
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}

                                {/* Price Lines - show all lines, display "-" for zero values */}
                                {result.qty_lines &&
                                  result.qty_lines.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium mb-2 text-muted-foreground">
                                        LINHAS DE PRECO (
                                        {result.qty_lines.length} linhas)
                                      </h4>
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="w-24">
                                              QTD
                                            </TableHead>
                                            <TableHead className="w-32 text-right">
                                              PRECO UNIT.
                                            </TableHead>
                                            <TableHead className="w-32 text-right">
                                              TOTAL
                                            </TableHead>
                                            <TableHead>DESCRICAO</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {result.qty_lines.map((line, idx) => (
                                            <TableRow
                                              key={idx}
                                              className="hover:bg-transparent"
                                            >
                                              <TableCell className="font-medium">
                                                {line.qty > 0
                                                  ? formatNumber(line.qty)
                                                  : "-"}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {line.unit_price &&
                                                line.unit_price > 0
                                                  ? formatCurrency(
                                                      line.unit_price,
                                                    )
                                                  : "-"}
                                              </TableCell>
                                              <TableCell className="text-right font-medium">
                                                {line.total > 0
                                                  ? formatCurrency(line.total)
                                                  : "-"}
                                              </TableCell>
                                              <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
                                                {line.description}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}

      {/* Initial State */}
      {!hasSearched && (
        <div className="imx-border p-12 text-center">
          <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">
            Digite palavras-chave para encontrar orcamentos semelhantes
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              "expositor cartao",
              "vinil chao",
              "crowner topo",
              "floorgraphic",
              "ilha forra",
              "prateleiras 3mm",
            ].map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery(suggestion);
                }}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-6 text-xs text-muted-foreground text-center">
        <p>
          BASE DE DADOS: 2.219 orcamentos (MAM) | JAN 2025 - DEZ 2025 |{" "}
          {mode === "standard"
            ? "Pesquisa por palavras-chave"
            : mode === "ai-semantic"
              ? "Pesquisa semantica via OpenRouter Embeddings"
              : "Analise AI via OpenRouter"}
        </p>
      </div>
    </div>
  );
}
