"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

import { PlusIcon } from "lucide-react"

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createBot } from "@/actions/bot"

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  job: z.string().min(1, "Job is required"),
  instructions: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function BotDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose?: () => void
}) {
  const { register, handleSubmit, formState: { errors} } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })
  const router = useRouter()

  const handleClose = () => {
    onClose?.()
    router.push("/")
  }

  const onSubmit = async (data: FormValues) => {
    const formData = new FormData()
    formData.set("name", data.name)
    formData.set("job", data.job)
    if (data.instructions) {
      formData.set("instructions", data.instructions)
    }

    const result = await createBot(formData)
    if (result.error) {
      // TODO: show error to user
    } else {
      handleClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose() }}>
      <DialogTrigger
        render={
          <Button
            variant="secondary"
            onClick={() => router.push("/?open=1")}
          />
        }
      >
        <PlusIcon data-icon="inline-start" />
        Create a new bot
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new bot</DialogTitle>
          <DialogDescription>Give your bot a name, job, and optional instructions.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input {...register("name")} className="mt-1 block w-full rounded-md border-input px-3 py-2" />
            {errors.name && <p className="mt-1 text-sm text-destructive">Name is required</p>}
          </div>

          <div>
            <label className="text-sm font-medium">Job</label>
            <input {...register("job")} className="mt-1 block w-full rounded-md border-input px-3 py-2" />
            {errors.job && <p className="mt-1 text-sm text-destructive">Job is required</p>}
          </div>

          <div>
            <label className="text-sm font-medium">Instructions (optional)</label>
            <textarea {...register("instructions")} className="mt-1 block w-full rounded-md border-input px-3 py-2 h-24 resize-y" />
          </div>
        </form>
      </DialogContent>

      <DialogFooter showCloseButton>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit">Create bot</Button>
      </DialogFooter>
    </Dialog>
  )
}

export default BotDialog