import CoachScope from "./CoachScope.jsx";
import { coachingSelectionError } from "../shared/coaching-selection.mjs";
import Markdown from "./Markdown.mjs";
import React, { useEffect, useRef, useState } from "react";
import {
  Trash,
  Plus,
  ChatCircleDots,
  PencilSimple,
  Archive,
  ArrowCounterClockwise,
  ArrowUp,
  ArrowsClockwise,
  CoachIcon,
} from "./icons.jsx";

export default function Coach({
  dataset,
  targetConversation,
  conversations,
  messages,
  api,
  refresh,
  connected,
  goals,
  activities,
  onSettings,
}) {
  const [selected, setSelected] = useState(() =>
    localStorage.getItem(`stride-chat-${dataset}`),
  );
  useEffect(() => {
    if (!targetConversation) return;
    setSelected(targetConversation.id);
    setArchived(targetConversation.archived);
  }, [targetConversation]);
  const [drafts, setDrafts] = useState({});
  const [scopes, setScopes] = useState({});
  const [archived, setArchived] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const list = useRef();
  const visible = conversations.filter((c) => !!c.archived === archived);
  const active = visible.find((c) => c.id === selected) || visible[0];
  const id = active?.id || "new";
  const question = drafts[id] || "";
  const history = messages.filter(
    (m) => active && m.conversationId === active.id,
  );
  const scope = scopes[id] ||
    [...history].reverse().find((m) => m.coachingScope)?.coachingScope || {
      kind: "none",
    };
  const scopeError = coachingSelectionError(scope, activities);
  const validScope = !scopeError;
  useEffect(() => {
    if (active) localStorage.setItem(`stride-chat-${dataset}`, active.id);
    else localStorage.removeItem(`stride-chat-${dataset}`);
    setEditing(false);
    setDeleting(null);
    setCollapsed(false);
  }, [active?.id, dataset]);
  useEffect(() => {
    list.current?.scrollTo({
      top: list.current.scrollHeight,
      behavior: "instant",
    });
  }, [id, history.length, pending]);
  async function run(fn) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }
  const draft = (value) => setDrafts((prev) => ({ ...prev, [id]: value }));
  const create = () =>
    run(async () => {
      const c = await api("/conversations", {});
      setArchived(false);
      setSelected(c.id);
    });
  const patch = (changes) =>
    run(async () => {
      await api(`/conversations/${active.id}`, changes, "PATCH");
      setEditing(false);
    });
  return (
    <section className="coach-workspace">
      <aside className="card conversation-sidebar" aria-label="코치 대화 목록">
        <button className="button primary" disabled={pending} onClick={create}>
          <Plus size={18} />새 대화
        </button>
        <div className="conversation-tabs">
          <button
            aria-pressed={!archived}
            disabled={pending}
            onClick={() => setArchived(false)}
          >
            대화
          </button>
          <button
            aria-pressed={archived}
            disabled={pending}
            onClick={() => setArchived(true)}
          >
            보관함
          </button>
        </div>
        <div className="conversation-list">
          {visible.length ? (
            visible.map((c) => (
              <button
                key={c.id}
                aria-current={active?.id === c.id ? "true" : undefined}
                aria-expanded={active?.id === c.id && !collapsed}
                aria-controls="coach-conversation-panel"
                disabled={pending}
                onClick={() => {
                  setCollapsed(active?.id === c.id ? !collapsed : false);
                  setSelected(c.id);
                  setError("");
                }}
              >
                <ChatCircleDots size={18} />
                <span>
                  <strong>{c.title}</strong>
                  <small>
                    {new Date(c.updatedAt).toLocaleDateString("ko-KR")}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <p className="helper">
              {archived
                ? "보관한 대화가 없습니다."
                : "새 주제로 대화를 시작해보세요."}
            </p>
          )}
        </div>
        <details className="coach-data-note">
          <summary>코치가 참고하는 기록</summary>
          <p>
            기록을 첨부하면 선택한 활동·기간의 기록, 연결된 훈련 목적을 함께
            살펴봅니다. 기록 없이 일반적인 질문도 할 수 있습니다. 대화 문맥은
            선택한 대화의 최근 30개 메시지만 사용합니다. GPS와 인증 키는 보내지
            않습니다.
          </p>
          <button className="text-button" onClick={onSettings}>
            {connected ? "구독 연결 설정" : "Codex 연결하기"}
          </button>
        </details>
      </aside>
      <div
        id="coach-conversation-panel"
        className="card chat session-chat"
        hidden={collapsed}
      >
        <div className="chat-header">
          <span className="avatar">
            <CoachIcon size={22} />
          </span>
          <div className="conversation-heading">
            {editing ? (
              <form
                className="rename-conversation"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (title.trim()) patch({ title: title.trim() });
                }}
              >
                <input
                  aria-label="대화 이름"
                  value={title}
                  maxLength={100}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
                <button
                  className="text-button"
                  disabled={pending || !title.trim()}
                >
                  저장
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setEditing(false)}
                >
                  취소
                </button>
              </form>
            ) : (
              <strong>
                {active?.title ||
                  (archived ? "보관한 대화" : "새로운 러닝 이야기")}
              </strong>
            )}
            <small>
              {active?.archived
                ? "보관된 대화 · 복원하면 이어서 대화할 수 있어요"
                : "Stride 코치 · 대화별로 기록과 문맥을 관리해요"}
            </small>
          </div>
          {active && !editing && (
            <div className="conversation-actions">
              <button
                className="icon-button"
                aria-label="대화 이름 변경"
                title="이름 변경"
                disabled={pending}
                onClick={() => {
                  setTitle(active.title);
                  setEditing(true);
                }}
              >
                <PencilSimple size={19} />
                <span>이름 변경</span>
              </button>
              <button
                className="icon-button"
                aria-label={archived ? "대화 복원" : "대화 보관"}
                title={archived ? "복원" : "보관"}
                disabled={pending}
                onClick={() => patch({ archived: !archived })}
              >
                {archived ? (
                  <ArrowCounterClockwise size={19} />
                ) : (
                  <Archive size={19} />
                )}
                <span>{archived ? "복원" : "보관"}</span>
              </button>
              <button
                className="icon-button danger-icon"
                aria-label="대화 삭제"
                title="삭제"
                disabled={pending}
                onClick={() => setDeleting(active.id)}
              >
                <Trash size={19} />
                <span>삭제</span>
              </button>
            </div>
          )}
        </div>
        {deleting && active?.id === deleting && (
          <div
            className="delete-conversation"
            role="group"
            aria-label="대화 삭제 확인"
          >
            <strong>‘{active.title}’ 대화를 삭제할까요?</strong>
            <p>이 대화의 모든 메시지가 삭제되며 되돌릴 수 없습니다.</p>
            <div className="row">
              <button
                className="button"
                disabled={pending}
                onClick={() => setDeleting(null)}
              >
                취소
              </button>
              <button
                className="button danger"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    await api(`/conversations/${deleting}`, null, "DELETE");
                    setDrafts((prev) => {
                      const next = { ...prev };
                      delete next[deleting];
                      return next;
                    });
                    setDeleting(null);
                    setSelected(null);
                  })
                }
              >
                대화 영구 삭제
              </button>
            </div>
          </div>
        )}
        <div
          className="messages"
          ref={list}
          role="log"
          aria-label="현재 코치 대화"
          aria-live="polite"
        >
          {!history.length ? (
            <div className="welcome">
              <ChatCircleDots size={38} />
              <h2>
                {archived
                  ? "대화를 안전하게 보관해요"
                  : "어떤 러닝 이야기를 나눌까요?"}
              </h2>
              <p>
                {archived
                  ? "보관함에서 이전 대화를 선택해주세요."
                  : "주제마다 새 대화를 만들고, 언제든 이어서 이야기하세요."}
              </p>
              {!archived && (
                <div className="suggestions">
                  {[
                    "편한 러닝의 강도는 어떻게 정할까?",
                    "다음 롱런은 어떻게 준비할까?",
                    "내 마라톤 목표에 맞춰 훈련을 점검해줘",
                  ].map((q) => (
                    <button key={q} disabled={pending} onClick={() => draft(q)}>
                      {q}
                      <ArrowUp size={15} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            history.map((m) => (
              <div className={`message ${m.role}`} key={m.id}>
                {m.role === "assistant" && (
                  <span className="message-label">
                    STRIDE COACH
                    {m.model ? ` · ${m.model} · ${m.effort || "medium"}` : ""}
                    {m.fallback ? " · 사용 한도로 Luna 전환" : ""}
                  </span>
                )}
                {m.coachingScope && (
                  <small className="message-scope">
                    {m.coachingScope.label || "최근 6주"}
                    {m.coachingScope.scenario &&
                    m.coachingScope.scenario !== "auto"
                      ? ` · ${{ road: "일반 러닝", race: "레이스", trail: "트레일" }[m.coachingScope.scenario]}`
                      : ""}
                  </small>
                )}
                <Markdown>{m.text}</Markdown>
              </div>
            ))
          )}
          {pending && (
            <div className="coach-pending" role="status">
              <ArrowsClockwise size={17} className="spin" />
              처리하고 있어요…
            </div>
          )}
        </div>
        {error && (
          <p className="coach-error" role="alert">
            {error}
          </p>
        )}
        {!archived && (
          <div className="coach-composer">
            {active?.reviewId ? (
              <div className="coach-review-context">
                <span>활동 리뷰에 이어서 질문하기</span>
                <p>원래 리뷰와 이 활동의 최신 기록을 함께 참고합니다.</p>
              </div>
            ) : (
              <CoachScope
                value={scope}
                onChange={(value) =>
                  setScopes((prev) => ({ ...prev, [id]: value }))
                }
                activities={activities}
                disabled={pending}
              />
            )}
            <form
              className="chat-input"
              onSubmit={(e) => {
                e.preventDefault();
                if (!question.trim() || pending || !validScope) return;
                run(async () => {
                  const result = await api("/coach", {
                    question,
                    scope,
                    ...(active ? { conversationId: active.id } : {}),
                  });
                  setScopes((prev) => ({
                    ...prev,
                    [result.conversationId]: scope,
                  }));
                  setSelected(result.conversationId);
                  setDrafts((prev) => ({ ...prev, [id]: "" }));
                });
              }}
            >
              <textarea
                aria-label="코치에게 질문"
                placeholder="러닝에 대해 물어보세요…"
                rows={2}
                maxLength={2000}
                value={question}
                disabled={pending}
                onChange={(e) => draft(e.target.value)}
              />
              <button
                aria-label="코치에게 전송"
                className="circle-button"
                disabled={pending || !question.trim() || !validScope}
              >
                <ArrowUp size={20} weight="bold" />
              </button>
            </form>
            {scopeError && (
              <p className="helper" role="status">
                {scopeError}
              </p>
            )}
          </div>
        )}
        <small className="chat-note">
          AI 답변은 참고용이며, 계획 변경은 직접 검토하고 적용하세요.
        </small>
      </div>
    </section>
  );
}
