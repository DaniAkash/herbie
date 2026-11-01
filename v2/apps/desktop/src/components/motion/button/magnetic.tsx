// @ts-nocheck
/* Vendored from a component registry. Checking is off because upstream is
 * not written against this project's strict settings, and any fix here is
 * lost the next time `bun run ui:add` installs it. Do not edit; reinstall.
 */
"use client";

import { forwardRef } from "react";
import { Magnetic } from "../magnetic";
import { Button, type ButtonProps } from "./base";

export interface MagneticButtonProps extends ButtonProps {
  /** Magnetic pull strength. Default 0.25. */
  strength?: number;
  /** Class applied to the magnetic wrapper. */
  magneticClassName?: string;
}

export const MagneticButton = forwardRef<HTMLButtonElement, MagneticButtonProps>(function MagneticButton(
  { strength = 0.25, magneticClassName, children, ...rest },
  ref,
) {
  return (
    <Magnetic strength={strength} className={magneticClassName}>
      <Button ref={ref} {...rest}>
        {children}
      </Button>
    </Magnetic>
  );
});
