import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

export type BotKind = 'remote_control' | 'special_purpose'

// Mutually-exclusive two-option picker. Uses the canonical
// FieldSet + RadioGroup + FieldLabel-wrapping-Field-with-FieldContent
// composition so a11y (radiogroup role + arrow-key nav) is handled by
// the primitives. The card-look comes automatically from FieldLabel's
// data-checked styling.
export function BotKindPicker({
  value,
  onChange,
  remoteControlTaken,
}: {
  value: BotKind
  onChange: (next: BotKind) => void
  remoteControlTaken: boolean
}) {
  return (
    <FieldSet>
      <FieldLegend variant="label">Bot type</FieldLegend>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as BotKind)}
      >
        <FieldLabel htmlFor="kind-special_purpose">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>Special Purpose</FieldTitle>
              <FieldDescription>
                Dedicated bot for a single conversation. You can have as many of
                these as you need — one per project.
              </FieldDescription>
            </FieldContent>
            <RadioGroupItem id="kind-special_purpose" value="special_purpose" />
          </Field>
        </FieldLabel>
        <FieldLabel
          htmlFor="kind-remote_control"
          data-disabled={remoteControlTaken || undefined}
        >
          <Field
            orientation="horizontal"
            data-disabled={remoteControlTaken || undefined}
          >
            <FieldContent>
              <FieldTitle>Remote Control</FieldTitle>
              <FieldDescription>
                {remoteControlTaken
                  ? 'You already have one Remote Control bot. Delete it first to add another.'
                  : 'Manage many conversations from one bot — /new, /list, /switch, /archive. Limit: one per user.'}
              </FieldDescription>
            </FieldContent>
            <RadioGroupItem
              id="kind-remote_control"
              value="remote_control"
              disabled={remoteControlTaken}
            />
          </Field>
        </FieldLabel>
      </RadioGroup>
    </FieldSet>
  )
}
