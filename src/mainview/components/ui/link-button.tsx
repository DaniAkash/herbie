import { Link, type LinkProps } from '@tanstack/react-router'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type LinkButtonProps = LinkProps &
  Omit<ComponentProps<'a'>, keyof LinkProps> &
  VariantProps<typeof buttonVariants>

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...(props as LinkProps)}
    />
  )
}
