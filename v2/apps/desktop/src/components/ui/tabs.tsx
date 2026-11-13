import { Tabs as TabsPrimitive } from "@animate-ui/react/primitives/base-ui/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * Base UI types a tab value as `any`, which reads as an implicit any at every
 * call site under this project's settings. Every tab in the app is addressed
 * by a string, so that is the contract here.
 */
type TabsProps = Omit<
  TabsPrimitive.Root.Props,
  "value" | "defaultValue" | "onValueChange"
> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

function Tabs({
  className,
  orientation = "horizontal",
  onValueChange,
  ...props
}: TabsProps) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      onValueChange={(value: unknown) => onValueChange?.(String(value))}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
        /* The app's two shapes: a pill row above a panel, and a tight
         * segmented control. Both fill the selected tab with the accent, and
         * the animate-ui list copies that fill into the sliding highlight. */
        pill: "h-auto! gap-1 rounded-full bg-card p-1",
        segment: "h-auto! gap-0 rounded-lg bg-card p-0.5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        "group-data-[variant=pill]/tabs-list:h-auto group-data-[variant=pill]/tabs-list:flex-none group-data-[variant=pill]/tabs-list:rounded-full group-data-[variant=pill]/tabs-list:px-3.5 group-data-[variant=pill]/tabs-list:py-1.5 group-data-[variant=pill]/tabs-list:data-active:bg-primary group-data-[variant=pill]/tabs-list:data-active:text-primary-foreground",
        "group-data-[variant=segment]/tabs-list:h-auto group-data-[variant=segment]/tabs-list:flex-none group-data-[variant=segment]/tabs-list:rounded-md group-data-[variant=segment]/tabs-list:px-3.5 group-data-[variant=segment]/tabs-list:py-1.5 group-data-[variant=segment]/tabs-list:data-active:bg-primary group-data-[variant=segment]/tabs-list:data-active:text-primary-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
