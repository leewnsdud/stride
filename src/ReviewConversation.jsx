import React, { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown.mjs";
import { ArrowUp, ArrowUpRight } from "./icons.jsx";

export default function ReviewConversation({
  review,
  perspective,
  item,
  api,
  disabled,
  onConversationChange,
  onOpenCoach,
}) {
  const [thread, setThread] = useState(null);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const sending = useRef(false);
  const list = useRef(null);
  const [outgoing, setOutgoing] = useState("");
  const replies = (thread?.messages || []).filter(
    (message) => !message.reviewId,
  );
  useEffect(() => {
    if (replies.length || outgoing)
      list.current?.scrollTo({
        top: list.current.scrollHeight,
        behavior: "instant",
      });
  }, [replies.length, outgoing]);
  const endpoint = `/activities/${item.id}/reviews/${review.id}/conversation`;
  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    api(endpoint)
      .then((result) => {
        if (!cancelled) setThread(result);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, attempt]);
  const send = async (event) => {
    event.preventDefault();
    if (!question.trim() || sending.current || disabled || !thread || loadError)
      return;
    sending.current = true;
    setOutgoing(question.trim());
    setPending(true);
    setError("");
    try {
      await api("/coach", { question: question.trim(), reviewId: review.id });
      setQuestion("");
      try {
        setThread(await api(endpoint));
        setOutgoing("");
      } catch (e) {
        setLoadError(`답변은 저장되었습니다. ${e.message}`);
      }
      await onConversationChange?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setOutgoing("");
      sending.current = false;
      setPending(false);
    }
  };
  return (
    <section
      id="review-conversation-panel"
      className="review-conversation session-chat"
      aria-label="리뷰 대화"
    >
      <div className="review-conversation-heading">
        <div className="review-metadata">
          <span className="review-perspective-label">
            리뷰 관점: {perspective}
          </span>
          <span className="review-date">
            {new Date(review.createdAt).toLocaleDateString("ko-KR")} ·{" "}
            {review.model}
          </span>
        </div>
        <button
          type="button"
          className="text-button"
          disabled={pending || disabled}
          onClick={async () => {
            if (sending.current) return;
            sending.current = true;
            setPending(true);
            setError("");
            try {
              const conversation = await api(endpoint, {});
              await onConversationChange?.();
              onOpenCoach?.(conversation);
            } catch (e) {
              setError(e.message);
            } finally {
              sending.current = false;
              setPending(false);
            }
          }}
        >
          AI 코칭으로 이동 <ArrowUpRight size={18} />
        </button>
      </div>
      <div
        className="messages"
        ref={list}
        role="log"
        aria-label="활동 리뷰 대화"
        aria-live="polite"
        tabIndex={0}
      >
        <article className="message assistant">
          <span className="message-label">STRIDE COACH · {review.model}</span>
          {review.fallback && (
            <small className="message-scope">사용 한도로 Luna 전환</small>
          )}
          <Markdown>{review.text}</Markdown>
        </article>
        {replies.map((m) => (
          <article className={`message ${m.role}`} key={m.id}>
            {m.role === "assistant" && (
              <span className="message-label">
                STRIDE COACH{m.model ? ` · ${m.model}` : ""}
              </span>
            )}
            <Markdown>{m.text}</Markdown>
          </article>
        ))}
        {outgoing && (
          <article className="message user">
            <Markdown>{outgoing}</Markdown>
          </article>
        )}
        {outgoing && (
          <div className="coach-pending" role="status">
            리뷰와 질문을 함께 살펴보고 있습니다…
          </div>
        )}
      </div>
      {loadError && (
        <div role="alert">
          <p>{loadError}</p>
          <button className="button" onClick={() => setAttempt((n) => n + 1)}>
            대화 다시 불러오기
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="coach-error">
          {error}
        </p>
      )}
      {thread?.conversation?.archived ? (
        <p className="helper">
          보관된 대화입니다. AI 코칭 탭에서 복원하면 이어갈 수 있어요.
        </p>
      ) : (
        <form className="chat-input" onSubmit={send}>
          <textarea
            aria-label="리뷰에 이어서 질문"
            placeholder="이 리뷰에 대해 물어보세요…"
            rows={2}
            maxLength={2000}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={pending || disabled}
          />
          <button
            className="circle-button"
            aria-label="리뷰 질문 전송"
            disabled={
              !question.trim() || pending || disabled || !thread || !!loadError
            }
          >
            <ArrowUp size={20} />
          </button>
        </form>
      )}
    </section>
  );
}
