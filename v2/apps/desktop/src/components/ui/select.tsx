import { Select as SelectPrimitive } from "@animate-ui/react/primitives/base-ui/select"
import { cn } from "cn"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

/**
 * Base UI reports a cleared selection as null. None of these selects offers a
 * way to clear one, so the handler is narrowed to the value that was picked
 * and a null is dropped rather than pushed at a caller that cannot hold it.
 */
function Select({
  onValueChange,
  ...props
}: Omit<SelectPrimitive.Root.Props<string>, "onValueChange"> & {
  onValueChange?: (value: string) => void
}) {
  return (
    <SelectPrimitive.Root
      data-slot="select"
      onValueChange={(value) => {
        if (value !== null) onValueChange?.(value)
      }}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors",
        "hover:border-(--color-border-strong) focus-visible:ring-2 focus-visible:ring-foreground/20",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="shrink-0 text-muted-foreground transition-transform data-[popup-open]:rotate-180">
        <ChevronDownIcon className="size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn(
        "truncate text-left data-[placeholder]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function SelectContent({
  className,
  children,
  sideOffset = 6,
  ...props
}: SelectPrimitive.Popup.Props & { sideOffset?: number }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        alignItemWithTrigger={false}
        sideOffset={sideOffset}
        className="z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "max-h-[min(16rem,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto rounded-xl bg-popover p-1 text-popover-foreground ring-1 ring-foreground/10 outline-none",
            className
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "flex w-full cursor-default items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-muted-foreground outline-none select-none",
        "data-highlighted:bg-muted data-highlighted:text-foreground data-selected:bg-muted data-selected:text-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="min-w-0 truncate">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="shrink-0">
        <CheckIcon className="size-3.5" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
