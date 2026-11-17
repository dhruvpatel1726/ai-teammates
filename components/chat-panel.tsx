"use client"

import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input"
import { Badge } from "@/components/ui/badge"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import { useChat } from "@ai-sdk/react"
import type { TriggerChatTransport } from "@trigger.dev/sdk/chat"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import { type UIMessage } from "ai"
import { CheckIcon, ChevronDownIcon, MessageSquareIcon } from "lucide-react"
import { useCallback, useState } from "react"

import {
  loadChatTranscript,
  mintChatAccessToken,
  startChatSession,
} from "@/app/actions"
import type { teammateChat } from "@/trigger/chat"

type ChatBotOption = {
  id: string
  name: string
  job: string
  avatar: string
}

/** Read the bot a user message was addressed to from persisted message metadata. */
function recipientBotIdOf(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object") return undefined
  const botId = (metadata as { botId?: unknown }).botId
  return typeof botId === "string" ? botId : undefined
}

/** A single AI conversation, persisted by the agent's transcript storage. */
export function ChatPanel({
  chatId,
  kind,
  bots,
}: {
  chatId: string
  kind: "direct" | "group"
  bots: ChatBotOption[]
}) {
  const [selectedBotId, setSelectedBotId] = useState(bots[0]?.id ?? "")
  const selectedBot = bots.find((bot) => bot.id === selectedBotId) ?? bots[0]

  const transport = useTriggerChatTransport<typeof teammateChat>({
    task: "teammate-chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    // Kept live by the hook, so the first turn and later turns both carry the
    // bot the user currently selected.
    clientData: { botId: selectedBot?.id },
  })
  const { messages: initialMessages, isLoading } = useLoadTranscript(
    chatId,
    loadChatTranscript,
    { transport }
  )

  if (isLoading) return null

  return (
    <ChatView
      bots={bots}
      selectedBot={selectedBot}
      onSelectBot={setSelectedBotId}
      chatId={chatId}
      kind={kind}
      initialMessages={initialMessages}
      transport={transport}
    />
  )
}

function ChatView({
  chatId,
  kind,
  bots,
  selectedBot,
  onSelectBot,
  initialMessages,
  transport,
}: {
  chatId: string
  kind: "direct" | "group"
  bots: ChatBotOption[]
  selectedBot?: ChatBotOption
  onSelectBot: (botId: string) => void
  initialMessages: UIMessage[]
  transport: TriggerChatTransport
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const {
    messages,
    sendMessage,
    status,
    error,
    stop: aiStop,
  } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    resume: initialMessages.length > 0,
  })

  const stop = useCallback(() => {
    aiStop()
    void transport.stopGeneration(chatId)
  }, [aiStop, chatId, transport])

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text.trim()
    if (!text) return
    // The first argument's metadata is persisted on the message so the badge
    // can show whom it was addressed to. The options metadata is the per-turn
    // client data and wins over the transport's value on a fresh selection.
    void sendMessage(
      { text, metadata: { botId: selectedBot?.id } },
      { metadata: { botId: selectedBot?.id } }
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="relative min-h-0 flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              description="Send a message to start talking with your teammate."
              icon={<MessageSquareIcon className="size-6" />}
              title={selectedBot ? `Chat with ${selectedBot.name}` : "Start a conversation"}
            />
          ) : (
            messages.map((message) => {
              const recipient =
                kind === "group" && message.role === "user"
                  ? bots.find((bot) => bot.id === recipientBotIdOf(message.metadata))
                  : undefined

              return (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    {recipient && (
                      <Badge
                        className="gap-1.5 bg-background/60"
                        variant="outline"
                      >
                        <ChatAvatar
                          seed={recipient.avatar}
                          className="size-4 rounded-full"
                        />
                        {recipient.name}
                      </Badge>
                    )}
                    {message.parts.map((part, index) => {
                      if (part.type !== "text") return null
                      const key = `${message.id}-${index}`
                      return message.role === "assistant" ? (
                        <MessageResponse key={key}>{part.text}</MessageResponse>
                      ) : (
                        <p className="whitespace-pre-wrap" key={key}>
                          {part.text}
                        </p>
                      )
                    })}
                  </MessageContent>
                </Message>
              )
            })
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t p-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              placeholder={`Message ${selectedBot?.name ?? "your teammate"}...`}
            />
          </PromptInputBody>
          <PromptInputFooter>
            {bots.length > 1 && selectedBot && (
              <PromptInputTools>
                <ModelSelector open={pickerOpen} onOpenChange={setPickerOpen}>
                  <ModelSelectorTrigger
                    render={
                      <Button variant="ghost" size="sm" className="min-w-0" />
                    }
                  >
                    <ChatAvatar seed={selectedBot.avatar} className="size-5" />
                    <span className="max-w-24 truncate">{selectedBot.name}</span>
                    <ChevronDownIcon />
                  </ModelSelectorTrigger>
                  <ModelSelectorContent title="Choose a teammate">
                    <ModelSelectorInput placeholder="Search teammates..." />
                    <ModelSelectorList>
                      <ModelSelectorEmpty>No teammates found.</ModelSelectorEmpty>
                      <ModelSelectorGroup heading="Teammates">
                        {bots.map((bot) => (
                          <ModelSelectorItem
                            key={bot.id}
                            value={bot.id}
                            onSelect={() => {
                              onSelectBot(bot.id)
                              setPickerOpen(false)
                            }}
                          >
                            <ChatAvatar seed={bot.avatar} className="size-6" />
                            <span>{bot.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {bot.job}
                            </span>
                            {bot.id === selectedBot.id && (
                              <CheckIcon className="ml-2 size-4" />
                            )}
                          </ModelSelectorItem>
                        ))}
                      </ModelSelectorGroup>
                    </ModelSelectorList>
                  </ModelSelectorContent>
                </ModelSelector>
              </PromptInputTools>
            )}
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
        {error && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error.message}
          </p>
        )}
      </div>
    </div>
  )
}
