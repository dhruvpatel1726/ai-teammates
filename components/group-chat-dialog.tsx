"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"

import { createGroupChat } from "@/actions/chat"
import { ChatAvatar } from "@/components/chat-avatar"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  createGroupChatSchema,
  type CreateGroupChatInput,
} from "@/db/schema"

type GroupBot = {
  id: string
  name: string
  job: string
  avatar: string
}

type GroupChatDialogProps = {
  bots: GroupBot[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the new chat ID so the sidebar can refresh its list. */
  onCreated: (chatId: string) => void
}

/** Minimal group-chat creation: a name and the bots that join it. */
function GroupChatDialog({
  bots,
  open,
  onOpenChange,
  onCreated,
}: GroupChatDialogProps) {
  const router = useRouter()
  const form = useForm<CreateGroupChatInput>({
    resolver: zodResolver(createGroupChatSchema),
    defaultValues: { name: "", botIds: [] },
  })
  const { errors, isSubmitting } = form.formState
  const selectedBotIds = useWatch({ control: form.control, name: "botIds" }) ?? []
  const selectedBots = bots.filter((bot) => selectedBotIds.includes(bot.id))

  function close() {
    onOpenChange(false)
    form.reset()
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await createGroupChat(values)

    if (result.error !== null) {
      toast.add({
        type: "error",
        title: "Could not create the group chat",
        description: result.error,
      })
      return
    }

    toast.add({
      type: "success",
      title: "Group chat created",
      description: `${values.name} is ready to chat.`,
    })
    close()
    onCreated(result.chatId)
    router.push(`/chats/${result.chatId}`)
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New group chat</DialogTitle>
          <DialogDescription>
            Name the chat and pick the bots that should join it.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <FieldGroup className="gap-4">
            {selectedBots.length > 0 && (
              <Field orientation="horizontal">
                <GroupChatAvatar
                  seeds={selectedBots.map((bot) => bot.avatar)}
                  className="size-10"
                />
                <FieldDescription>
                  {selectedBots.length} bot{selectedBots.length === 1 ? "" : "s"}{" "}
                  will join this chat.
                </FieldDescription>
              </Field>
            )}

            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="group-name">Group name</FieldLabel>
              <Input
                id="group-name"
                placeholder="Planning team"
                autoComplete="off"
                aria-invalid={!!errors.name}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={!!errors.botIds}>
              <FieldLabel>Members</FieldLabel>
              <FieldDescription>Pick at least two bots.</FieldDescription>
              <ToggleGroup
                multiple
                variant="outline"
                value={selectedBotIds}
                onValueChange={(value) =>
                  form.setValue("botIds", value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                className="flex-wrap justify-start"
              >
                {bots.map((bot) => (
                  <ToggleGroupItem key={bot.id} value={bot.id} aria-label={bot.name}>
                    <ChatAvatar seed={bot.avatar} className="size-5" />
                    {bot.name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldError errors={[errors.botIds]} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Spinner data-icon="inline-start" />}
                Create group chat
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { GroupChatDialog }
