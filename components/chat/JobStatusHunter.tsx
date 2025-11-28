"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusDisplay } from "./StatusDisplay";
import type {
  ChatState,
  SearchType,
  Match,
  FullStatus,
  QueryResponse,
  UI_TEXT,
} from "@/lib/status-hunter/types";
import {
  Search,
  FileText,
  Calculator,
  Truck,
  User,
  Megaphone,
  Package,
  Loader2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

const TEXT = {
  askType: "O que pretende pesquisar?",
  askValue: {
    FO: "Insira o numero da Folha de Obra:",
    ORC: "Insira o numero do Orcamento:",
    GUIA: "Insira o numero da Guia:",
    CLIENTE: "Insira o nome do Cliente:",
    CAMPANHA: "Insira o nome da Campanha:",
    ITEM: "Insira a descricao ou codigo do Item:",
  },
  searchTypeLabels: {
    FO: "Folha de Obra",
    ORC: "Orcamento",
    GUIA: "Guia",
    CLIENTE: "Cliente",
    CAMPANHA: "Campanha",
    ITEM: "Item",
  },
  searching: "A pesquisar...",
  noResults: "Nao foram encontrados resultados.",
  multipleResults: "Encontramos varios resultados. Selecione um:",
};

const SEARCH_TYPE_CONFIG: Array<{
  type: SearchType;
  icon: typeof FileText;
  label: string;
}> = [
  { type: "FO", icon: FileText, label: "Folha de Obra" },
  { type: "ORC", icon: Calculator, label: "Orcamento" },
  { type: "GUIA", icon: Truck, label: "Guia" },
  { type: "CLIENTE", icon: User, label: "Cliente" },
  { type: "CAMPANHA", icon: Megaphone, label: "Campanha" },
  { type: "ITEM", icon: Package, label: "Item" },
];

interface Message {
  id: string;
  type: "system" | "user";
  content: string;
  component?: React.ReactNode;
}

interface JobStatusHunterProps {
  className?: string;
}

export function JobStatusHunter({ className }: JobStatusHunterProps) {
  const [chatState, setChatState] = useState<ChatState>({ state: "ask-type" });
  const [messages, setMessages] = useState<Message[]>(() => [
    // Initialize with first message to avoid duplicate in StrictMode
    { id: "initial-msg", type: "system" as const, content: TEXT.askType },
  ]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate unique ID for messages
  const generateId = () =>
    `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when state changes to ask-value
  useEffect(() => {
    if (chatState.state === "ask-value") {
      inputRef.current?.focus();
    }
  }, [chatState]);

  // Add system message
  const addSystemMessage = useCallback(
    (content: string, component?: React.ReactNode) => {
      setMessages((prev) => [
        ...prev,
        { id: generateId(), type: "system", content, component },
      ]);
    },
    [],
  );

  // Add user message
  const addUserMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: generateId(), type: "user", content },
    ]);
  }, []);

  // Handle search type selection
  const handleTypeSelect = useCallback(
    (type: SearchType) => {
      addUserMessage(TEXT.searchTypeLabels[type]);
      setChatState({ state: "ask-value", searchType: type });
      addSystemMessage(TEXT.askValue[type]);
    },
    [addUserMessage, addSystemMessage],
  );

  // Execute search API call
  const executeSearch = useCallback(
    async (type: SearchType, value: string) => {
      setChatState({ state: "searching", searchType: type, value });
      addSystemMessage(TEXT.searching);

      try {
        const response = await fetch("/api/status-hunter/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, value }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Erro ao executar pesquisa");
        }

        const data: QueryResponse = await response.json();

        if (data.matches.length === 0) {
          setChatState({ state: "error", message: TEXT.noResults });
          addSystemMessage(TEXT.noResults);
        } else if (data.matches.length === 1 && data.fullStatus) {
          setChatState({ state: "show-status", fullStatus: data.fullStatus });
          // Status will be rendered as component, no text message needed
        } else {
          setChatState({ state: "choose-match", matches: data.matches });
          addSystemMessage(TEXT.multipleResults);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro desconhecido";
        setChatState({ state: "error", message });
        addSystemMessage(message);
      }
    },
    [addSystemMessage],
  );

  // Handle value submission
  const handleValueSubmit = useCallback(() => {
    if (!inputValue.trim()) return;
    if (chatState.state !== "ask-value") return;

    const value = inputValue.trim();
    addUserMessage(value);
    setInputValue("");
    executeSearch(chatState.searchType, value);
  }, [inputValue, chatState, addUserMessage, executeSearch]);

  // Handle match selection
  const handleMatchSelect = useCallback(
    async (match: Match) => {
      addUserMessage(match.label);
      setChatState({
        state: "searching",
        searchType: match.type as SearchType,
        value: match.id,
      });
      addSystemMessage(TEXT.searching);

      try {
        const response = await fetch(`/api/status-hunter/query?id=${match.id}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Erro ao obter estado");
        }

        const data: { fullStatus: FullStatus } = await response.json();
        setChatState({ state: "show-status", fullStatus: data.fullStatus });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro desconhecido";
        setChatState({ state: "error", message });
        addSystemMessage(message);
      }
    },
    [addUserMessage, addSystemMessage],
  );

  // Handle new search
  const handleNewSearch = useCallback(() => {
    setMessages([{ id: "initial-msg", type: "system", content: TEXT.askType }]);
    setChatState({ state: "ask-type" });
    setInputValue("");
  }, []);

  // Handle key press
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleValueSubmit();
      }
    },
    [handleValueSubmit],
  );

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "max-w-[85%]",
              msg.type === "user" ? "ml-auto" : "mr-auto",
            )}
          >
            <div
              className={cn(
                "p-3 text-sm",
                msg.type === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-accent-foreground imx-border",
              )}
            >
              {msg.content}
            </div>
            {msg.component}
          </div>
        ))}

        {/* Type Selection Buttons */}
        {chatState.state === "ask-type" && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            {SEARCH_TYPE_CONFIG.map(({ type, icon: Icon, label }) => (
              <Button
                key={type}
                variant="outline"
                className="h-auto py-3 justify-start gap-2"
                onClick={() => handleTypeSelect(type)}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        )}

        {/* Loading State */}
        {chatState.state === "searching" && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{TEXT.searching}</span>
          </div>
        )}

        {/* Match Selection */}
        {chatState.state === "choose-match" && (
          <div className="space-y-2 mt-4">
            {chatState.matches.map((match) => (
              <button
                key={match.id}
                onClick={() => handleMatchSelect(match)}
                className="w-full imx-border bg-card hover:bg-accent p-3 text-left flex items-center justify-between group"
              >
                <div>
                  <div className="font-medium text-sm">{match.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {match.metadata.cliente && (
                      <span>{match.metadata.cliente}</span>
                    )}
                    {match.metadata.campanha && (
                      <span> - {match.metadata.campanha}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* Status Display */}
        {chatState.state === "show-status" && (
          <div className="mt-4">
            <StatusDisplay
              status={chatState.fullStatus}
              onNewSearch={handleNewSearch}
            />
          </div>
        )}

        {/* Error State with Retry */}
        {chatState.state === "error" && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{chatState.message}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleNewSearch}>
              Tentar novamente
            </Button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Only show when asking for value */}
      {chatState.state === "ask-value" && (
        <div className="imx-border-t p-4 bg-background">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite aqui..."
              className="flex-1"
            />
            <Button
              onClick={handleValueSubmit}
              disabled={!inputValue.trim()}
              size="icon"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
