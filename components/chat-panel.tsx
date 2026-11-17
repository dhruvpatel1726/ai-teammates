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
import { DefaultChatTransport } from "ai"
import { MessageSquareIcon } from "lucide-react"
import { useMemo } from "react"

/** A single, in-memory AI conversation. Messages are not persisted. */
export function ChatPanel({
  chatId,
  botName,
}: {
  chatId: string
  botName?: string
}) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { chatId } }),
    [chatId]
  )
  const { messages, sendMessage, status, error, stop } = useChat({ transport })

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
