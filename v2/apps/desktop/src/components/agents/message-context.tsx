// @ts-nocheck
/* Vendored from a component registry. Checking is off because upstream is
 * not written against this project's strict settings, and any fix here is
 * lost the next time `bun run ui:add` installs it. Do not edit; reinstall.
 */
"use client";

import { createContext } from "react";

export type MessageSide = "start" | "end";

export const MessageSideContext = createContext<MessageSide | undefined>(
  undefined,
);
