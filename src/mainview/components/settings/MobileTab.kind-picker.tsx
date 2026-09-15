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
      <FieldDescription>
        Both reach every conversation once topics are on. The difference is
        where messages go when they are not.
      </FieldDescription>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as BotKind)}
      >
        <FieldLabel htmlFor="kind-special_purpose">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>Special Purpose</FieldTitle>
              <FieldDescription>
                Starts pointed at one conversation. With topics on it still
                reaches every conversation, one per thread. Have as many as you
                like, one per project.
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
                  : 'Every conversation from one bot, each in its own Telegram topic. Limit: one per user.'}
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
