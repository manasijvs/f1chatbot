import { useState } from "react";
import { Message } from "ai";

export function useChatStream() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);

  const handleInputChange = (e: any) => {
    setInput(e.target.value);
  };

  const append = async (message: Message) => {
    const updatedMessages = [...messages, message];
    setMessages(updatedMessages);
    setInput("");
    await fetchAndStream(updatedMessages);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input
    };

    await append(newMessage);
  };

  const fetchAndStream = async (allMessages: Message[]) => {
    const controller = new AbortController();
    setAbortCtrl(controller);

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: ""
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantReply = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const lines = chunkText.split("\n").filter((line) => line.startsWith("data:"));

        for (const line of lines) {
          const jsonStr = line.replace("data: ", "").trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const json = JSON.parse(jsonStr);
            const delta = json.choices?.[0]?.delta?.content ?? "";
            assistantReply += delta;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id ? { ...msg, content: assistantReply } : msg
              )
            );
          } catch (err) {
            console.error("Error parsing chunk", err);
          }
        }
      }
    } catch (err) {
      console.error("Streaming error:", err);
    } finally {
      setAbortCtrl(null);
    }
  };

  return {
    messages,
    input,
    isLoading: !!abortCtrl,
    handleInputChange,
    handleSubmit,
    append
  };
}
