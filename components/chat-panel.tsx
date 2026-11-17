"use client"

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
} from "@/components/ai-elements/prompt-input"
import { useChat } from "@ai-sdk/react"
import type { TriggerChatTransport } from "@trigger.dev/sdk/chat"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import { type UIMessage } from "ai"
import { MessageSquareIcon } from "lucide-react"
import { useCallback } from "react"

import {
  loadChatTranscript,
  mintChatAccessToken,
  startChatSession,
} from "@/app/actions"
import type { teammateChat } from "@/trigger/chat"

/** A single AI conversation, persisted by the agent's transcript storage. */
export function ChatPanel({
  chatId,
  botName,
}: {
  chatId: string
  botName?: string
}) {
  const transport = useTriggerChatTransport<typeof teammateChat>({
    task: "teammate-chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId }) => startChatSession({ chatId }),
  })
  const { messages: initialMessages, isLoading } = useLoadTranscript(
    chatId,
    loadChatTranscript,
    { transport }
  )

  if (isLoading) return null

  return (
    <ChatView
      botName={botName}
      chatId={chatId}
      initialMessages={initialMessages}
      transport={transport}
    />
  )
}

function ChatView({
  chatId,
  botName,
  initialMessages,
  transport,
}: {
  chatId: string
  botName?: string
  initialMessages: UIMessage[]
  transport: TriggerChatTransport
}) {
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
    void sendMessage({ text })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="relative min-h-0 flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              description="Send a message to start talking with your teammate."
              icon={<MessageSquareIcon className="size-6" />}
              title={botName ? `Chat with ${botName}` : "Start a conversation"}
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
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
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t p-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              placeholder={`Message ${botName ?? "your teammate"}...`}
            />
          </PromptInputBody>
          <PromptInputFooter>
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
