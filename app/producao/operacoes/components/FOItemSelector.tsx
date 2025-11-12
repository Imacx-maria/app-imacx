import React, { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createBrowserClient } from "@/utils/supabase";

interface FolhaObra {
  id: string;
  numero_fo?: string;
  nome_campanha?: string;
  cliente?: string;
  concluido?: boolean;
  data_saida?: string;
  items_base?: ItemBase[];
}

interface ItemBase {
  id: string;
  descricao?: string;
  codigo?: string;
  quantidade?: number;
  concluido?: boolean;
}

interface FOItemSelectorProps {
  folhaObraId?: string;
  itemId?: string;
  onFolhaObraChange: (folhaObraId: string) => void;
  onItemChange: (itemId: string) => void;
  disabled?: boolean;
  className?: string;
}

export const FOItemSelector: React.FC<FOItemSelectorProps> = ({
  folhaObraId,
  itemId,
  onFolhaObraChange,
  onItemChange,
  disabled = false,
  className,
}) => {
  const [foOpen, setFoOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [folhasObras, setFolhasObras] = useState<FolhaObra[]>([]);
  const [loading, setLoading] = useState(true);
  const [foSearchValue, setFoSearchValue] = useState("");
  const [itemSearchValue, setItemSearchValue] = useState("");

  const supabase = createBrowserClient();

  // Fetch work orders with items
  useEffect(() => {
    const fetchFolhasObras = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("folhas_obras")
          .select(
            `
            *,
            items_base!inner(
              *,
              designer_items!inner(paginacao)
            )
          `,
          )
          .eq("items_base.designer_items.paginacao", true)
          .not("numero_orc", "is", null)
          .neq("numero_orc", 0)
          .order("numero_fo", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching folhas obras:", error);
          return;
        }

        if (data) {
          setFolhasObras(data);
        }
      } catch (err) {
        console.error("Error loading folhas obras:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFolhasObras();
  }, [supabase]);

  // Get filtered work orders
  const filteredFolhasObras = useMemo(() => {
    if (!foSearchValue) return folhasObras;

    return folhasObras.filter(
      (fo) =>
        fo.numero_fo?.toLowerCase().includes(foSearchValue.toLowerCase()) ||
        fo.nome_campanha?.toLowerCase().includes(foSearchValue.toLowerCase()) ||
        fo.cliente?.toLowerCase().includes(foSearchValue.toLowerCase()),
    );
  }, [folhasObras, foSearchValue]);

  // Get selected work order
  const selectedFolhaObra = folhasObras.find((fo) => fo.id === folhaObraId);

  // Get available items for selected work order
  const availableItems = useMemo(() => {
    if (!selectedFolhaObra?.items_base) return [];

    // Items are already filtered by paginacao = true in the query
    return selectedFolhaObra.items_base.filter(
      (item) =>
        !itemSearchValue ||
        item.descricao?.toLowerCase().includes(itemSearchValue.toLowerCase()) ||
        item.codigo?.toLowerCase().includes(itemSearchValue.toLowerCase()),
    );
  }, [selectedFolhaObra, itemSearchValue]);

  // Get selected item
  const selectedItem = availableItems.find((item) => item.id === itemId);

  // Handle work order selection
  const handleFolhaObraSelect = (foId: string) => {
    onFolhaObraChange(foId);
    // Clear item selection when FO changes
    if (itemId) {
      onItemChange("");
    }
    setFoOpen(false);
    setFoSearchValue("");
  };

  // Handle item selection
  const handleItemSelect = (itemId: string) => {
    onItemChange(itemId);
    setItemOpen(false);
    setItemSearchValue("");
  };

  // Format FO display name
  const formatFODisplayName = (fo: FolhaObra) => {
    const parts = [fo.numero_fo, fo.nome_campanha].filter(Boolean);
    return parts.join(" - ");
  };

  // Format item display name
  const formatItemDisplayName = (item: ItemBase) => {
    const parts = [item.codigo, item.descricao].filter(Boolean);
    return parts.join(" - ");
  };

  // Get work order status
  const getFOStatus = (fo: FolhaObra) => {
    if (fo.concluido) return { label: "Concluído", color: "bg-green-500" };
    if (fo.data_saida && new Date(fo.data_saida) < new Date())
      return { label: "Atrasado", color: "bg-red-500" };
    return { label: "Em Andamento", color: "bg-blue-500" };
  };

  // Get item status
  const getItemStatus = (item: ItemBase) => {
    if (item.concluido) return { label: "Concluído", color: "bg-green-500" };
    return { label: "Pendente", color: "bg-orange-500" };
  };

  return (
    <div className={className}>
      {/* Work Order Selector */}
      <div>
        <Label htmlFor="folha-obra-selector">Folha de Obra</Label>
        <Popover open={foOpen} onOpenChange={setFoOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={foOpen}
              className="mt-1 w-full justify-between"
              disabled={disabled}
              id="folha-obra-selector"
            >
              {selectedFolhaObra ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">
                    {formatFODisplayName(selectedFolhaObra)}
                  </span>
                  <Badge className="flex-shrink-0">
                    {selectedFolhaObra.items_base?.length || 0} itens
                  </Badge>
                </div>
              ) : (
                <span>Selecionar folha de obra...</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[500px] p-0">
            <Command>
              <CommandInput
                placeholder="Pesquisar por FO, campanha ou cliente..."
                value={foSearchValue}
                onValueChange={setFoSearchValue}
              />
              <CommandEmpty>
                {loading
                  ? "Carregando..."
                  : "Nenhuma folha de obra encontrada."}
              </CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {filteredFolhasObras.map((fo) => {
                  const status = getFOStatus(fo);

                  return (
                    <CommandItem
                      key={fo.id}
                      value={fo.id}
                      onSelect={() => handleFolhaObraSelect(fo.id)}
                      className="flex items-center justify-between py-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center">
                        <Check
                          className={
                            folhaObraId === fo.id
                              ? "mr-2 h-4 w-4 opacity-100"
                              : "mr-2 h-4 w-4 opacity-0"
                          }
                        />
                        <FileText className="mr-2 h-4 w-4" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            {formatFODisplayName(fo)}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span>Cliente: {fo.cliente}</span>
                            <div className="flex items-center gap-1">
                              <div className={`h-2 w-2 ${status.color}`} />
                              <span>{status.label}</span>
                            </div>
                            <span>{fo.items_base?.length || 0} itens</span>
                          </div>
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Item Selector */}
      <div>
        <Label htmlFor="item-selector">Item</Label>
        <Popover open={itemOpen} onOpenChange={setItemOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={itemOpen}
              className="mt-1 w-full justify-between"
              disabled={disabled || !selectedFolhaObra}
              id="item-selector"
            >
              {selectedItem ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Package className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">
                    {formatItemDisplayName(selectedItem)}
                  </span>
                  {selectedItem.quantidade && (
                    <Badge className="flex-shrink-0">
                      Qtd: {selectedItem.quantidade}
                    </Badge>
                  )}
                </div>
              ) : (
                <span>
                  {selectedFolhaObra
                    ? "Selecionar item..."
                    : "Primeiro selecione uma FO"}
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[450px] p-0">
            <Command>
              <CommandInput
                placeholder="Pesquisar item..."
                value={itemSearchValue}
                onValueChange={setItemSearchValue}
              />
              <CommandEmpty>
                {!selectedFolhaObra
                  ? "Selecione uma folha de obra primeiro"
                  : "Nenhum item encontrado."}
              </CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {availableItems.map((item) => {
                  const status = getItemStatus(item);

                  return (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => handleItemSelect(item.id)}
                      className="flex items-center justify-between py-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center">
                        <Check
                          className={
                            itemId === item.id
                              ? "mr-2 h-4 w-4 opacity-100"
                              : "mr-2 h-4 w-4 opacity-0"
                          }
                        />
                        <Package className="mr-2 h-4 w-4" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            {formatItemDisplayName(item)}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            {item.quantidade && (
                              <span>Quantidade: {item.quantidade}</span>
                            )}
                            <div className="flex items-center gap-1">
                              <div className={`h-2 w-2 ${status.color}`} />
                              <span>{status.label}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {selectedFolhaObra && selectedItem && (
        <div className="border border-border bg-muted/20 p-3">
          <div className="text-sm">
            <div className="mb-1 font-medium">Seleção Atual:</div>

            <div>
              <div>
                <strong>FO:</strong> {formatFODisplayName(selectedFolhaObra)}
              </div>

              <div>
                <strong>Cliente:</strong> {selectedFolhaObra.cliente}
              </div>

              <div>
                <strong>Item:</strong> {formatItemDisplayName(selectedItem)}
              </div>
              {selectedItem.quantidade && (
                <div>
                  <strong>Quantidade:</strong> {selectedItem.quantidade}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
