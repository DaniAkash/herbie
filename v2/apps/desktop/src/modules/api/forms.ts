import { createAgentBody } from '@bun/shared/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { type UseFormReturn, useForm } from 'react-hook-form'
import type { z } from 'zod'

/**
 * The forms, built where the sidecar's contract may be named.
 *
 * A form's rules are the route's rules, so they are not restated here: these
 * wrap the schemas the sidecar validates against. Building them in this
 * module rather than in the overlay is what keeps the overlay from reaching
 * across to the sidecar for a value, which is the boundary `modules/api`
 * exists to hold.
 *
 * Two types each, not one, because the schemas fill defaults: what the
 * fields hold has `brief` and `effort` optional, what comes out of the
 * resolver has them filled. One type for both makes useForm reject its own
 * resolver.
 */
export type AgentDraftInput = z.input<typeof createAgentBody>
export type AgentDraft = z.output<typeof createAgentBody>
export type AgentForm = UseFormReturn<AgentDraftInput, unknown, AgentDraft>

/** The six face colours, as the schema defines them. */
export type AgentColor = AgentDraft['color']

export function useAgentDraftForm(): AgentForm {
  return useForm<AgentDraftInput, unknown, AgentDraft>({
    resolver: zodResolver(createAgentBody),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      color: 'house',
      shape: 'squircle',
      brief: '',
      acpAgent: '',
      model: null,
      effort: 'medium',
      workspaceDir: null,
    },
  })
}
