"use client";

import React, { useState } from "react";
import {
  Search,
  FileText,
  Loader2,
  Sparkles,
  Zap,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Brain,
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

type SearchMode = "standard" | "ai-simple" | "ai-guess" | "ai-semantic";

// Available AI models for testing - ordered by speed (fastest first)
const AI_MODELS = [
  // FASTEST MODELS (optimized for speed)
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    cost: "$0.10/$0.40 per 1M",
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    cost: "$0.15/$0.60 per 1M",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    cost: "$0.10/$0.25 per 1M",
  },
  {
    id: "meta-llama/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B (Fast)",
    cost: "$0.02/$0.05 per 1M",
  },
  // BALANCED MODELS (good quality + reasonable speed)
  {
    id: "qwen/qwen3-235b-a22b-instruct",
    name: "Qwen3 235B",
    cost: "$0.20/$0.60 per 1M",
  },
  // QUALITY MODELS (slower but higher quality)
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    cost: "$3/$15 per 1M",
  },
] as const;

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

interface AIAnalysis {
  priceEstimate: {
    min: number;
    max: number;
    typical: number;
    currency: string;
    confidence: "high" | "medium" | "low";
    perUnit?: {
      min: number;
      max: number;
      typicalQty: number;
    };
  };
  reasoning: string;
  keyFactors?: string[];
  recommendations?: string[];
  warnings?: string[];
  filteredOutReasons?: string[];
}

interface AIResponse {
  success: boolean;
  query: string;
  mode: string;
  analysis: AIAnalysis;
  similarQuotes: SearchResult[];
  totalCandidates?: number;
  filteredCount?: number;
  usage?: { prompt_tokens: number; completion_tokens: number };
  searchTime: number;
  model?: string;
}

interface PriceEstimate {
  qty: number;
  unit_price: number;
  total_price: number;
  confidence: "alta" | "media" | "baixa";
}

interface EstimateData {
  produto: string;
  estimativas: PriceEstimate[];
  matches_found: number;
  date_range: string;
  assumptions: string[];
  notes?: string;
}

interface EstimateResponse {
  success: boolean;
  query: string;
  estimate: EstimateData;
  similarQuotes: SearchResult[];
  usage?: { prompt_tokens: number; completion_tokens: number };
  model: string;
  searchTime: number;
}

interface SemanticPriceStats {
  min: number;
  max: number;
  typical: number;
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
  const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS[0].id);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<number>(0);
  const [apiUsage, setApiUsage] = useState<{
    prompt_tokens: number;
    completion_tokens: number;
  } | null>(null);
  const [filterStats, setFilterStats] = useState<{
    totalCandidates: number;
    filteredCount: number;
  } | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const [sortField, setSortField] = useState<string>("document_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [estimateData, setEstimateData] = useState<EstimateData | null>(null);
  const [showSimilarQuotes, setShowSimilarQuotes] = useState(false);
  const [semanticPriceStats, setSemanticPriceStats] =
    useState<SemanticPriceStats | null>(null);
  const [semanticLimit, setSemanticLimit] = useState<number>(30);
  const [semanticThreshold, setSemanticThreshold] = useState<number>(0.5);

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
    setAiAnalysis(null);
    setApiUsage(null);
    setFilterStats(null);
    setUsedModel(null);
    setEstimateData(null);
    setShowSimilarQuotes(false);
    setSemanticPriceStats(null);

    // Parse query to extract quantity (for AI Guess) and clean product terms
    const { product: cleanProduct, qty: extractedQty } = parseQueryForQuantity(
      query.trim(),
    );

    // For standard and AI simple, use clean product without quantity
    const searchQuery = mode === "ai-guess" ? query.trim() : cleanProduct;

    try {
      if (mode === "standard") {
        // Standard search - use cleaned query without quantity
        const response = await fetch("/api/quotes/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery, limit: 100 }),
        });

        if (!response.ok) throw new Error("Erro na pesquisa");

        const data = await response.json();
        setResults(data.results);
        setSearchTime(0);
      } else if (mode === "ai-simple") {
        // AI simple search - use cleaned query without quantity
        const response = await fetch("/api/quotes/advisor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: searchQuery,
            mode: "simple",
            model: selectedModel,
          }),
        });

        if (!response.ok) throw new Error("Erro na analise AI");

        const data: AIResponse = await response.json();
        setResults(data.similarQuotes);
        setAiAnalysis(data.analysis);
        setSearchTime(data.searchTime);
        setApiUsage(data.usage || null);
        setUsedModel(data.model || selectedModel);
        if (data.totalCandidates && data.filteredCount !== undefined) {
          setFilterStats({
            totalCandidates: data.totalCandidates,
            filteredCount: data.filteredCount,
          });
        }
      } else if (mode === "ai-guess") {
        // AI GUESS - Price estimation
        const response = await fetch("/api/quotes/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: query.trim(),
            model: selectedModel,
          }),
        });

        if (!response.ok) throw new Error("Erro na estimativa AI");

        const data: EstimateResponse = await response.json();

        if (!data.success) {
          setError(
            data.estimate?.notes || "Nenhum orçamento similar encontrado",
          );
          setResults([]);
          return;
        }

        setEstimateData(data.estimate);
        setResults(data.similarQuotes || []);
        setSearchTime(data.searchTime);
        setApiUsage(data.usage || null);
        setUsedModel(data.model || selectedModel);
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

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "text-green-600 bg-green-100";
      case "medium":
        return "text-yellow-600 bg-yellow-100";
      case "low":
        return "text-red-600 bg-red-100";
      default:
        return "text-muted-foreground bg-accent";
    }
  };

  const getConfidenceLabel = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "ALTA";
      case "medium":
        return "MEDIA";
      case "low":
        return "BAIXA";
      default:
        return confidence;
    }
  };

  // Get primary qty line for display in results table
  const getPrimaryQtyLine = (qtyLines: QtyLine[]) => {
    if (!qtyLines || qtyLines.length === 0) return null;
    // Return the first line with qty > 0
    return qtyLines.find((l) => l.qty > 0) || qtyLines[0];
  };

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
      default:
        return 0;
    }

    if (sortDirection === "asc") {
      return valA > valB ? 1 : -1;
    }
    return valA < valB ? 1 : -1;
  });

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
          variant={mode === "ai-simple" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("ai-simple")}
          className="gap-2"
        >
          <Zap className="h-4 w-4" />
          AI SIMPLES
        </Button>
        <Button
          variant={mode === "ai-guess" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("ai-guess")}
          className="gap-2"
        >
          <TrendingUp className="h-4 w-4" />
          AI GUESS
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

      {/* Model Selector (only for AI modes that use OpenRouter) */}
      {(mode === "ai-simple" || mode === "ai-guess") && (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">MODELO:</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="text-xs bg-background imx-border px-2 py-1 rounded"
          >
            {AI_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.cost})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Mode Description */}
      <div className="mb-4 text-xs text-muted-foreground">
        {mode === "standard" && "Pesquisa por palavras-chave (gratuito)"}
        {mode === "ai-simple" && "Pesquisa com filtro AI (remove irrelevantes)"}
        {mode === "ai-guess" &&
          "Estimativa de precos por quantidade (1, 30, 50, 100, 250, 350+ un)"}
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
            ) : mode === "ai-guess" ? (
              <TrendingUp className="h-4 w-4 mr-2" />
            ) : mode === "ai-semantic" ? (
              <Brain className="h-4 w-4 mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {isLoading
              ? mode === "ai-guess"
                ? "A ESTIMAR..."
                : mode === "ai-simple"
                  ? "AI A ANALISAR..."
                  : mode === "ai-semantic"
                    ? "A PROCURAR..."
                    : "A PESQUISAR..."
              : mode === "ai-guess"
                ? "ESTIMAR PRECO"
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

      {/* AI GUESS Results Card */}
      {hasSearched && !isLoading && estimateData && mode === "ai-guess" && (
        <div className="mb-6 imx-border bg-card">
          <div className="p-4 imx-border-b bg-primary/10">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-medium">ESTIMATIVA DE PRECO</span>
            </div>
          </div>

          <div className="p-4">
            {/* Product interpretation */}
            <div className="mb-4 p-3 bg-accent">
              <span className="text-xs text-muted-foreground">PRODUTO:</span>
              <p className="font-medium">{estimateData.produto}</p>
            </div>

            {/* Price table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">QUANTIDADE</TableHead>
                  <TableHead className="w-32 text-right">PRECO UNIT.</TableHead>
                  <TableHead className="w-32 text-right">PRECO TOTAL</TableHead>
                  <TableHead className="w-24 text-center">CONFIANCA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimateData.estimativas.map((est) => (
                  <TableRow key={est.qty}>
                    <TableCell className="font-medium">
                      {est.qty === 350 ? "350+" : est.qty} un
                    </TableCell>
                    <TableCell className="text-right">
                      ~{formatCurrency(est.unit_price)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {est.qty === 350 && est.confidence === "baixa"
                        ? "Consultar"
                        : `~${formatCurrency(est.total_price)}`}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs ${
                          est.confidence === "alta"
                            ? "bg-green-100 text-green-700"
                            : est.confidence === "media"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {est.confidence === "alta"
                          ? "Alta"
                          : est.confidence === "media"
                            ? "Media"
                            : "Baixa"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Assumptions */}
            {estimateData.assumptions &&
              estimateData.assumptions.length > 0 && (
                <div className="mt-4 p-3 bg-accent/50 text-xs">
                  <span className="font-medium">MATERIAIS ASSUMIDOS: </span>
                  <span className="text-muted-foreground">
                    {estimateData.assumptions.join(", ")}
                  </span>
                </div>
              )}

            {/* Notes */}
            {estimateData.notes && (
              <div className="mt-3 text-xs text-muted-foreground">
                <span className="font-medium">NOTAS: </span>
                {estimateData.notes}
              </div>
            )}

            {/* Source info */}
            <div className="mt-4 pt-3 imx-border-t text-xs text-muted-foreground">
              Baseado em: {estimateData.matches_found} orcamentos similares (
              {estimateData.date_range})
            </div>

            {/* Toggle similar quotes */}
            {results.length > 0 && (
              <div className="mt-4">
                <button
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSimilarQuotes(!showSimilarQuotes)}
                >
                  {showSimilarQuotes ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {showSimilarQuotes ? "OCULTAR" : "VER"} ORCAMENTOS SIMILARES (
                  {results.length})
                </button>

                {showSimilarQuotes && (
                  <div className="mt-3">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">ORC #</TableHead>
                          <TableHead className="w-24">DATA</TableHead>
                          <TableHead className="w-24 text-right">QTD</TableHead>
                          <TableHead className="w-28 text-right">
                            PRECO/UN
                          </TableHead>
                          <TableHead>DESCRICAO</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((result) => {
                          const primaryLine = getPrimaryQtyLine(
                            result.qty_lines,
                          );
                          return (
                            <TableRow key={result.document_number}>
                              <TableCell className="font-medium">
                                {result.document_number}
                              </TableCell>
                              <TableCell>
                                {formatDate(result.document_date)}
                              </TableCell>
                              <TableCell className="text-right">
                                {primaryLine
                                  ? formatNumber(primaryLine.qty)
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                {primaryLine && primaryLine.unit_price
                                  ? formatCurrency(primaryLine.unit_price)
                                  : "-"}
                              </TableCell>
                              <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                                {result.description_preview?.substring(0, 60) ||
                                  "-"}
                                ...
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* API Stats */}
          {(searchTime > 0 || apiUsage || usedModel) && (
            <div className="px-4 py-2 imx-border-t bg-accent/30 text-xs text-muted-foreground flex flex-wrap gap-4">
              {usedModel && (
                <span className="font-medium">
                  Modelo:{" "}
                  {AI_MODELS.find((m) => m.id === usedModel)?.name || usedModel}
                </span>
              )}
              {searchTime > 0 && <span>Tempo: {searchTime}ms</span>}
              {apiUsage && (
                <span>
                  Tokens: {apiUsage.prompt_tokens} +{" "}
                  {apiUsage.completion_tokens} ={" "}
                  {apiUsage.prompt_tokens + apiUsage.completion_tokens}
                </span>
              )}
            </div>
          )}
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
                Ancoras em torno do preco tipico
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  {
                    label: "TIPICO -50",
                    value: semanticPriceStats.typical - 50,
                  },
                  {
                    label: "TIPICO -150",
                    value: semanticPriceStats.typical - 150,
                  },
                  {
                    label: "TIPICO -300",
                    value: semanticPriceStats.typical - 300,
                  },
                  {
                    label: "TIPICO +300",
                    value: semanticPriceStats.typical + 300,
                  },
                ].map((band) => (
                  <span
                    key={band.label}
                    className="inline-flex items-center gap-2 px-2 py-1 imx-border bg-accent/40"
                  >
                    <span className="text-muted-foreground">{band.label}</span>
                    <span className="font-medium">
                      {formatCurrency(Math.max(0, band.value))}
                    </span>
                  </span>
                ))}
              </div>

              <div className="text-xs text-muted-foreground">
                Baseado em {semanticPriceStats.count} produtos principais dos
                orcamentos encontrados
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

      {/* AI Analysis Card */}
      {hasSearched && !isLoading && aiAnalysis && (
        <div className="mb-6 imx-border bg-card">
          <div className="p-4 imx-border-b bg-primary/10">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-medium">ANALISE AI</span>
              <span
                className={`ml-auto px-2 py-0.5 text-xs ${getConfidenceColor(aiAnalysis.priceEstimate.confidence)}`}
              >
                CONFIANCA{" "}
                {getConfidenceLabel(aiAnalysis.priceEstimate.confidence)}
              </span>
            </div>
          </div>

          <div className="p-4">
            {/* Price Estimate */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 bg-accent">
                <div className="text-xs text-muted-foreground mb-1">
                  PRECO MINIMO
                </div>
                <div className="text-xl font-medium">
                  {formatCurrency(aiAnalysis.priceEstimate.min)}
                </div>
              </div>
              <div className="p-4 bg-primary/20">
                <div className="text-xs text-muted-foreground mb-1">
                  PRECO TIPICO
                </div>
                <div className="text-2xl font-medium">
                  {formatCurrency(aiAnalysis.priceEstimate.typical)}
                </div>
              </div>
              <div className="p-4 bg-accent">
                <div className="text-xs text-muted-foreground mb-1">
                  PRECO MAXIMO
                </div>
                <div className="text-xl font-medium">
                  {formatCurrency(aiAnalysis.priceEstimate.max)}
                </div>
              </div>
            </div>

            {/* Per Unit (if available) */}
            {aiAnalysis.priceEstimate.perUnit && (
              <div className="mb-4 p-3 bg-accent/50 text-sm">
                <span className="font-medium">PRECO POR UNIDADE:</span>{" "}
                {formatCurrency(aiAnalysis.priceEstimate.perUnit.min)} -{" "}
                {formatCurrency(aiAnalysis.priceEstimate.perUnit.max)}
                {aiAnalysis.priceEstimate.perUnit.typicalQty > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    (para ~
                    {formatNumber(
                      aiAnalysis.priceEstimate.perUnit.typicalQty,
                    )}{" "}
                    unidades)
                  </span>
                )}
              </div>
            )}

            {/* Reasoning */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">RACIOCINIO</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {aiAnalysis.reasoning}
              </p>
            </div>

            {/* Key Factors (extended mode) */}
            {aiAnalysis.keyFactors && aiAnalysis.keyFactors.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">FATORES CHAVE</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {aiAnalysis.keyFactors.map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations (extended mode) */}
            {aiAnalysis.recommendations &&
              aiAnalysis.recommendations.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">RECOMENDACOES</span>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {aiAnalysis.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-600">✓</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Warnings (if any) */}
            {aiAnalysis.warnings && aiAnalysis.warnings.length > 0 && (
              <div className="p-3 bg-yellow-50 imx-border">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">
                    ALERTAS
                  </span>
                </div>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {aiAnalysis.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Filtered Out Quotes - Collapsible */}
            {aiAnalysis.filteredOutReasons &&
              aiAnalysis.filteredOutReasons.length > 0 && (
                <div className="bg-accent/50 imx-border">
                  <button
                    className="w-full p-3 flex items-center gap-2 hover:bg-accent/70 transition-colors"
                    onClick={() => setShowExcluded(!showExcluded)}
                  >
                    {showExcluded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      EXCLUIDOS PELA AI ({aiAnalysis.filteredOutReasons.length})
                    </span>
                  </button>
                  {showExcluded && (
                    <ul className="px-3 pb-3 text-xs text-muted-foreground space-y-1">
                      {aiAnalysis.filteredOutReasons.map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-destructive">✗</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
          </div>

          {/* API Stats */}
          {(searchTime > 0 || apiUsage || usedModel) && (
            <div className="px-4 py-2 imx-border-t bg-accent/30 text-xs text-muted-foreground flex flex-wrap gap-4">
              {usedModel && (
                <span className="font-medium">
                  Modelo:{" "}
                  {AI_MODELS.find((m) => m.id === usedModel)?.name || usedModel}
                </span>
              )}
              {searchTime > 0 && <span>Tempo: {searchTime}ms</span>}
              {apiUsage && (
                <span>
                  Tokens: {apiUsage.prompt_tokens} input +{" "}
                  {apiUsage.completion_tokens} output ={" "}
                  {apiUsage.prompt_tokens + apiUsage.completion_tokens} total
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {hasSearched &&
        !isLoading &&
        (mode === "standard" ||
          mode === "ai-simple" ||
          mode === "ai-semantic") && (
          <div className="imx-border">
            <div className="p-4 imx-border-b bg-accent">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {results.length} ORCAMENTOS{" "}
                  {mode === "standard" ? "ENCONTRADOS" : "RELEVANTES"}
                  {filterStats && mode !== "standard" && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      (de {filterStats.totalCandidates} candidatos)
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
                      <TableHead className="w-20 text-center">
                        SIMILAR
                      </TableHead>
                    )}
                    <TableHead>DESCRICAO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedResults.map((result) => {
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
                                  <div className="mb-4">
                                    <h4 className="text-xs font-medium mb-2 text-muted-foreground">
                                      ESPECIFICACOES
                                    </h4>
                                    <div className="text-xs bg-background p-3 imx-border max-h-48 overflow-y-auto">
                                      {result.description_preview
                                        .split("\n")
                                        .map((line, idx) => (
                                          <div key={idx} className="py-0.5">
                                            {line || <span>&nbsp;</span>}
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}

                                {/* Price Lines */}
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
                                            <TableRow key={idx}>
                                              <TableCell className="font-medium">
                                                {formatNumber(line.qty)}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {line.unit_price
                                                  ? formatCurrency(
                                                      line.unit_price,
                                                    )
                                                  : "-"}
                                              </TableCell>
                                              <TableCell className="text-right font-medium">
                                                {formatCurrency(line.total)}
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
