import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterMultiSelectProps {
  label: string;
  options: FilterOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  testId?: string;
}

export function FilterMultiSelect({
  label,
  options,
  values,
  onChange,
  placeholder = "Select...",
  searchable = false,
  testId,
}: FilterMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggleValue = (value: string) => {
    const exists = values.includes(value);
    const updated = exists ? values.filter((item) => item !== value) : [...values, value];
    onChange(updated);
  };

  const displayText = values.length === 0
    ? placeholder
    : values.length === 1
      ? options.find((option) => option.value === values[0])?.label ?? placeholder
      : `${values.length} selected`;

  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            data-testid={testId}
          >
            <span className="truncate">{displayText}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          {searchable ? (
            <Command>
              <CommandInput placeholder={`Search ${label.toLowerCase()}...`} data-testid={testId ? `${testId}-search` : undefined} />
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      onSelect={() => toggleValue(option.value)}
                      className="cursor-pointer"
                      data-testid={testId ? `${testId}-option-${option.value}` : undefined}
                    >
                      <Checkbox
                        checked={values.includes(option.value)}
                        className="mr-2"
                        data-testid={testId ? `${testId}-checkbox-${option.value}` : undefined}
                      />
                      {option.label}
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          values.includes(option.value) ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          ) : (
            <div className="p-2 max-h-64 overflow-y-auto">
              {options.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-2 py-2 px-2 hover:bg-accent rounded cursor-pointer"
                  onClick={() => toggleValue(option.value)}
                  data-testid={testId ? `${testId}-option-${option.value}` : undefined}
                >
                  <Checkbox
                    checked={values.includes(option.value)}
                    data-testid={testId ? `${testId}-checkbox-${option.value}` : undefined}
                  />
                  <span className="text-sm">{option.label}</span>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
