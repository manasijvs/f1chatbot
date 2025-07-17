// page.tsx
"use client"
import Image from "next/image"
import f1logo from "./assets/f1logo.png"
import { Message } from "ai"
import Bubble from "./components/Bubble"
import LoadingBubble from "./components/LoadingBubble"
import PromptSuggestionRow from "./components/PromptSuggestionRow"
import { useChatStream } from "./useChatStream" // <-- new hook

const Home = () => {
  const {
    append,
    isLoading,
    messages,
    input,
    handleInputChange,
    handleSubmit
  } = useChatStream()

  const noMessages = !messages || messages.length === 0

  const handleprompt = (promptText: string) => {
    const msg: Message = {
      id: crypto.randomUUID(),
      content: promptText,
      role: "user"
    }
    append(msg)
  }

  return (
    <main>
      <Image src={f1logo} width="250" alt="f1logo" />
      <section className={noMessages ? "" : "populated"}>
        {noMessages ? (
          <>
            <p className="starter-text">
              F1GPT – Your Formula 1 AI Assistant. F1GPT is an AI-powered chatbot
              designed to answer all your Formula One–related questions in real time.
              Whether you're a fan, a journalist, or just curious, F1GPT provides
              up-to-date information on drivers, teams, races, records, and more.
            </p>
            <br />
            <PromptSuggestionRow onPromptClick={handleprompt} />
          </>
        ) : (
          <>
            {messages.map((message, index) => (
              <Bubble key={message.id} message={message} />
            ))}
            {isLoading && <LoadingBubble />}
          </>
        )}
        <form onSubmit={handleSubmit}>
          <input
            className="question-box"
            onChange={handleInputChange}
            value={input}
            placeholder="Ask Me Something..."
          />
          <input type="submit" />
        </form>
      </section>
    </main>
  )
}

export default Home
