import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-surface text-ink shadow-btn hover:bg-inset aria-expanded:bg-hover",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",

        /* The app's own pills, on Herbie's surface ramp. `secondary` is the
         * resting state of nearly every action in the app, which is why it
         * reads as a raised surface rather than a fill. */
        primary:
          "bg-ink text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] hover:opacity-90",
        accent:
          "bg-accent text-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-accent-ink",
        success:
          "bg-green text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] hover:brightness-95",
        /* Filled, but as a recessed well rather than a colour: for the quieter
         * half of a pair where a transparent button would read as absent. */
        soft: "bg-hover-2 text-ink hover:bg-line-strong",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        /* The three pill sizes. Explicit symmetric padding on `md` rather than
         * a fixed height, so its top and bottom spacing is always equal. */
        xs: "h-7 gap-1 rounded-full px-2.5 text-[12px] leading-none font-normal active:scale-[0.96] [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-[27px] gap-1.5 rounded-full px-3 text-[13px] leading-none active:scale-[0.96] [&_svg:not([class*='size-'])]:size-3.5",
        md: "gap-2 rounded-full px-4 py-[9px] text-sm leading-none active:scale-[0.96]",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
