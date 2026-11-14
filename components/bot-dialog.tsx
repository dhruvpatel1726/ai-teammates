"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, ShuffleIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"

import { createBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { createBotSchema, type CreateBotInput } from "@/db/schema"

type BotDialogProps = {
  /** Open the dialog on first render, e.g. when the URL is `/?open=1`. */
  defaultOpen?: boolean
  /** Seed for the first face shown, so it matches the empty-state avatar. */
  defaultAvatarSeed: string
}

type BotPreset = Pick<CreateBotInput, "name" | "job" | "instructions">

const presets: Array<BotPreset & { label: string }> = [
  {
    label: "Research assistant",
    name: "Ada",
    job: "Research assistant",
    instructions:
      "Answer briefly, cite sources, and ask before running anything destructive.",
  },
  {
    label: "Code reviewer",
    name: "Grace",
    job: "Code reviewer",
    instructions:
      "Review changes for correctness first, then clarity. Flag risky edits before style nits.",
  },
  {
    label: "Writing editor",
    name: "Iris",
    job: "Writing editor",
    instructions:
      "Edit for clarity and tone, preserve the author's voice, and explain each substantive change.",
  },
  {
    label: "Tutor",
    name: "Milo",
    job: "Tutor",
    instructions:
      "Explain ideas step by step, check understanding, and end with a short practice question.",
  },
]

function BotDialog({ defaultOpen = false, defaultAvatarSeed }: BotDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(defaultOpen)

  const emptyValues: CreateBotInput = {
    name: "",
    job: "",
    instructions: "",
    avatar: defaultAvatarSeed,
  }

  const form = useForm<CreateBotInput>({
    resolver: zodResolver(createBotSchema),
    defaultValues: emptyValues,
  })

  const { errors, isSubmitting } = form.formState
  const avatarSeed = useWatch({ control: form.control, name: "avatar" })
  const selectedJob = useWatch({ control: form.control, name: "job" })

  function closeDialog() {
    setOpen(false)
    form.reset(emptyValues)
    // Drop the `?open=1` the empty state uses to deep-link into this dialog.
    if (window.location.search) {
      router.replace("/", { scroll: false })
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setOpen(true)
      return
    }

    closeDialog()
  }

  function applyPreset(preset: BotPreset) {
    form.setValue("name", preset.name, {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.setValue("job", preset.job, {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.setValue("instructions", preset.instructions, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  function shuffleFace() {
    form.setValue("avatar", crypto.randomUUID(), { shouldDirty: true })
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await createBot(values)

    if (result.error) {
      toast.add({
        type: "error",
        title: "Could not create the bot",
        description: result.error,
      })
      return
    }

    toast.add({
      type: "success",
      title: "Bot created",
      description: `${values.name} is ready to chat.`,
    })

    closeDialog()
    router.refresh()
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="secondary" />}>
        <PlusIcon data-icon="inline-start" />
        Create a new bot
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New bot</DialogTitle>
          <DialogDescription>
            Give it a face, a name, and a job to do.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.job}
                type="button"
                size="sm"
                variant={selectedJob === preset.job ? "secondary" : "outline"}
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <FieldGroup className="gap-4">
            <Field orientation="horizontal">
              <ChatAvatar seed={avatarSeed} className="size-12 rounded-full" />
              <FieldContent>
                <FieldTitle>Face</FieldTitle>
                <FieldDescription>
                  Shuffle until you find one you like.
                </FieldDescription>
              </FieldContent>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={shuffleFace}
              >
                <ShuffleIcon data-icon="inline-start" />
                Shuffle
              </Button>
            </Field>

            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="bot-name">Name</FieldLabel>
              <Input
                id="bot-name"
                placeholder="Ada"
                autoComplete="off"
                aria-invalid={!!errors.name}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={!!errors.job}>
              <FieldLabel htmlFor="bot-job">Job</FieldLabel>
              <Input
                id="bot-job"
                placeholder="Research assistant"
                autoComplete="off"
                aria-invalid={!!errors.job}
                {...form.register("job")}
              />
              <FieldError errors={[errors.job]} />
            </Field>

            <Field data-invalid={!!errors.instructions}>
              <FieldLabel htmlFor="bot-instructions">
                How it should work
              </FieldLabel>
              <Textarea
                id="bot-instructions"
                rows={4}
                placeholder="Answer briefly, cite sources, and ask before running anything destructive."
                aria-invalid={!!errors.instructions}
                {...form.register("instructions")}
              />
              <FieldError errors={[errors.instructions]} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner data-icon="inline-start" />}
              Create bot
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default BotDialog
