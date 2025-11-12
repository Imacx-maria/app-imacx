import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
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

export interface CreatableComboboxOption {
  value: string;
  label: string;
}

interface CreatableComboboxProps {
  value: string;
  displayLabel?: string;
  onChange: (value: string) => void;
  onCreateNew: (inputValue: string) => Promise<CreatableComboboxOption | null>;
  options: CreatableComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  createMessage?: string;
  allowCreate?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  className?: string;
  buttonClassName?: string;
}

export const CreatableCombobox: React.FC<CreatableComboboxProps> = ({
  value,
  displayLabel,
  onChange,
  onCreateNew,
  options,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  createMessage = "Create",
  allowCreate = true,
  disabled = false,
  loading = false,
  error = null,
  className = "",
  buttonClassName = "",
}) => {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);

  const selectedOption = options.find((option) => option.value === value);

  // Debug log when value or selectedOption changes
  React.useEffect(() => {
    if (value && !selectedOption) {
      console.warn("?? ComboBox: value provided but no matching option found", {
        value,
        optionsCount: options.length,
        sampleOptions: options
          .slice(0, 3)
          .map((o) => ({ value: o.value, label: o.label })),
      });
    }
  }, [value, selectedOption, options]);

  // Find by matching value from options, but also support displaying a value that's not in the list
  const findOptionByValue = React.useMemo(() => {
    return options.find((option) => option.value === value);
  }, [value, options]);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchValue.toLowerCase()),
  );

  const exactMatch = filteredOptions.find(
    (option) => option.label.toLowerCase() === searchValue.toLowerCase(),
  );

  const showCreateOption =
    allowCreate && searchValue.trim() && !exactMatch && !isCreating;

  const handleCreateNew = async () => {
    if (!searchValue.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const newOption = await onCreateNew(searchValue.trim());
      if (newOption) {
        onChange(newOption.value);
        setSearchValue("");
        setOpen(false);
      }
    } catch (error) {
      console.error("Error creating new option:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              !selectedOption && "text-muted-foreground",
              buttonClassName,
            )}
            disabled={disabled || loading}
          >
            {selectedOption ? (
              <span className="truncate uppercase" title={selectedOption.label}>
                {selectedOption.label.length > 14
                  ? `${selectedOption.label.substring(0, 14)}...`
                  : selectedOption.label}
              </span>
            ) : displayLabel ? (
              // If displayLabel is provided, show it even if value isn't in options
              <span className="truncate uppercase" title={displayLabel}>
                {displayLabel.length > 14
                  ? `${displayLabel.substring(0, 14)}...`
                  : displayLabel}
              </span>
            ) : value ? (
              // If value exists but not found in options, try to display it anyway
              <span className="truncate uppercase text-muted-foreground">
                Value exists
              </span>
            ) : (
              placeholder
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="max-h-[300px] w-full p-0 z-[10000]"
          align="start"
          side="bottom"
          sideOffset={4}
          avoidCollisions={true}
          collisionPadding={8}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={setSearchValue}
              className="uppercase"
            />
            <div className="max-h-[250px] overflow-y-auto">
              <CommandEmpty>
                {showCreateOption ? (
                  <div className="p-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={handleCreateNew}
                      disabled={isCreating}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      <span>{createMessage} &quot;</span>
                      <span className="uppercase">{searchValue}</span>
                      <span>&quot;</span>
                    </Button>
                  </div>
                ) : (
                  "No results found."
                )}
              </CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                      setSearchValue("");
                    }}
                    className="uppercase"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      {error && (
        <div className="mt-1 flex items-center gap-1 text-sm text-destructive">
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default CreatableCombobox;
