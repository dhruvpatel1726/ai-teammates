"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, ShuffleIcon, Trash2Icon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"

import { createBot, deleteBot, updateBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
import { PAID_FEATURE_ERROR_CODE } from "@/lib/billing"
import {
  BOT_CREATED_EVENT,
  BOT_DELETED_EVENT,
  BOT_UPDATED_EVENT,
} from "@/lib/chat-events"
import { usePaidFeature } from "@/lib/use-paid-feature"

type EditableBot = {
  id: string
  name: string
  job: string
  instructions: string | null
  avatar: string
}

type BotDialogProps = {
  /** Open the dialog on first render, e.g. when the URL is `/?open=1`. */
  defaultOpen?: boolean
  /** Seed for the first face shown, so it matches the empty-state avatar. */
  defaultAvatarSeed: string
  /** Notified whenever the dialog opens or closes, for external owners. */
  onOpenChange?: (open: boolean) => void
  /** Hide the built-in trigger when another control opens the dialog. */
  showTrigger?: boolean
  /** When supplied, the form edits this bot instead of creating a new one. */
  bot?: EditableBot
  /** Custom trigger, e.g. the settings button in a chat header. */
  trigger?: React.ReactElement
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

function BotDialog({
  defaultOpen = false,
  defaultAvatarSeed,
  onOpenChange,
  showTrigger = true,
  bot,
  trigger,
}: BotDialogProps) {
  const router = useRouter()
  const { showUpgradeToast } = usePaidFeature()
  const [open, setOpenState] = React.useState(defaultOpen)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const isEditing = !!bot

  function setOpen(nextOpen: boolean) {
    setOpenState(nextOpen)
    onOpenChange?.(nextOpen)
  }

  const defaultValues: CreateBotInput = bot
    ? {
        name: bot.name,
        job: bot.job,
        instructions: bot.instructions ?? "",
        avatar: bot.avatar,
      }
    : {
        name: "",
        job: "",
        instructions: "",
        avatar: defaultAvatarSeed,
      }

  const form = useForm<CreateBotInput>({
    resolver: zodResolver(createBotSchema),
    defaultValues,
  })

  const { errors, isSubmitting } = form.formState
  const avatarSeed = useWatch({ control: form.control, name: "avatar" })
  const selectedJob = useWatch({ control: form.control, name: "job" })

  function closeDialog(resetValues?: CreateBotInput) {
    setOpen(false)
    form.reset(resetValues ?? defaultValues)
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
    const result = bot
      ? await updateBot({ ...values, id: bot.id })
      : await createBot(values)

    if (result.error) {
      if ("code" in result && result.code === PAID_FEATURE_ERROR_CODE) {
        showUpgradeToast("bots")
        return
      }
      toast.add({
        type: "error",
        title: isEditing
          ? "Could not update the bot"
          : "Could not create the bot",
        description: result.error,
      })
      return
    }

    toast.add({
      type: "success",
      title: isEditing ? "Bot updated" : "Bot created",
      description: isEditing
        ? `${values.name}'s details were saved.`
        : `${values.name} is ready to chat.`,
    })

    // Reset to the saved values so reopening this same dialog after an edit
    // shows the updated bot instead of the props from before router.refresh().
    closeDialog(isEditing ? values : undefined)
    // The sidebar listens for both events so its chat list refreshes after a
    // create or an edit, whichever dialog instance was used.
    window.dispatchEvent(
      new Event(isEditing ? BOT_UPDATED_EVENT : BOT_CREATED_EVENT)
    )
    router.refresh()
  })

  const onDelete = async () => {
    if (!bot) return

    setIsDeleting(true)
    const result = await deleteBot({ id: bot.id })
    setIsDeleting(false)

    if (result.error) {
      toast.add({
        type: "error",
        title: "Could not delete the bot",
        description: result.error,
      })
      return
    }

    setDeleteOpen(false)
    setOpen(false)
    toast.add({
      type: "success",
      title: "Bot deleted",
      description: `${bot.name} was removed.`,
    })
    window.dispatchEvent(new Event(BOT_DELETED_EVENT))
    // The chat is gone, so never leave the user on its now-invalid URL.
    router.replace("/", { scroll: false })
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {showTrigger &&
        (trigger ? (
          <DialogTrigger render={trigger} />
        ) : (
          <DialogTrigger render={<Button variant="secondary" />}>
            <PlusIcon data-icon="inline-start" />
            Create a new bot
          </DialogTrigger>
        ))}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit bot" : "New bot"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this bot's face, name, and job."
              : "Give it a face, a name, and a job to do."}
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

          <DialogFooter className="sm:justify-between">
            {isEditing && bot && (
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={isDeleting}
                    />
                  }
                >
                  <Trash2Icon data-icon="inline-start" />
                  Delete bot
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this bot?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {bot.name} and its chat will be permanently removed. This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={isDeleting}
                      onClick={onDelete}
                    >
                      {isDeleting && <Spinner data-icon="inline-start" />}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Spinner data-icon="inline-start" />}
                {isEditing ? "Save changes" : "Create bot"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default BotDialog
