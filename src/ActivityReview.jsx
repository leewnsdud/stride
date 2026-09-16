import { ScenarioSelect, scenarioOptions } from "./CoachScope.jsx";
import React, { useState, useEffect, useRef } from "react";
import ReviewConversation from "./ReviewConversation.jsx";
export default function ActivityReview({
  item,
  api,
  ready,
  onConversationChange,
  onOpenCoach,
}) {
  const [reviews, setReviews] = useState([]),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState("auto");
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    api(`/activities/${item.id}/reviews`)
      .then((result) => {
        if (!cancelled) setReviews(result);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      alive.current = false;
    };
  }, [item.id, loadAttempt]);
  const generate = async () => {
    setPending(true);
    setError("");
    try {
      const review = await api(`/activities/${item.id}/reviews`, { scenario });
      if (alive.current) setReviews((xs) => [review, ...xs]);
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setPending(false);
    }
  };
  return (
    <section className="activity-review analysis-section" aria-busy={pending}>
      <div className="analysis-toolbar">
        <div>
          <small className="review-eyebrow">STRIDE COACH</small>
          <h3>이 달리기의 AI 리뷰</h3>
        </div>
        <button
          className="button primary"
          disabled={pending || loading || !!loadError || !ready}
          onClick={generate}
        >
          {pending
            ? "리뷰 작성 중…"
            : reviews.length
              ? "AI 리뷰 다시 작성"
              : "AI 리뷰 작성"}
        </button>
      </div>
      <div className="review-scenario">
        <ScenarioSelect
          value={scenario}
          onChange={setScenario}
          disabled={pending || loading}
        />
      </div>
      {pending && (
        <p role="status" className="review-pending">
          페이스와 심박, 구간별 수행을 함께 살펴보고 있습니다…
        </p>
      )}
      {error && (
        <p role="alert" className="analysis-notice">
          {error}
        </p>
      )}
      {loadError && (
        <div role="alert" className="analysis-notice">
          <p>저장된 리뷰를 불러오지 못했습니다. {loadError}</p>
          <button
            className="button"
            onClick={() => setLoadAttempt((n) => n + 1)}
          >
            리뷰 다시 불러오기
          </button>
        </div>
      )}
      {reviews[0] ? (
        <article>
          {reviews[0] && (
            <ReviewConversation
              key={reviews[0].id}
              review={reviews[0]}
              perspective={reviewPerspective(reviews[0])}
              item={item}
              api={api}
              disabled={pending}
              onConversationChange={onConversationChange}
              onOpenCoach={onOpenCoach}
            />
          )}
          {reviews[0].evidence && (
            <details className="review-evidence">
              <summary>리뷰에 사용한 기록</summary>
              <p>
                {reviews[0].scenario?.race
                  ? "레이스"
                  : reviews[0].scenario?.trail
                    ? "트레일러닝"
                    : "일반 러닝"}{" "}
                ·{" "}
                {reviews[0].evidence.plannedSession?.title
                  ? `연결된 훈련: ${reviews[0].evidence.plannedSession.title}`
                  : "연결된 훈련 없음"}
              </p>
              <p>
                상세 표본 {reviews[0].evidence.dataCoverage.sampleCount}개 · 랩{" "}
                {reviews[0].evidence.dataCoverage.lapCount}개
              </p>
              {!reviews[0].evidence.dataCoverage.hasDetailedSamples && (
                <p>상세 표본이 없어 요약 기록을 중심으로 검토했습니다.</p>
              )}
            </details>
          )}
        </article>
      ) : (
        !loading &&
        !pending && (
          <p className="analysis-empty">
            훈련 목적과 구간별 수행, 심박·지형을 함께 살펴봅니다. 리뷰는 이
            활동에 저장됩니다.
          </p>
        )
      )}
    </section>
  );
}

function reviewPerspective(review) {
  const selected =
    review.requestedScenario ||
    (review.scenario?.basis === "linked-plan-and-activity-type"
      ? "auto"
      : null);
  const label = scenarioOptions.find(([key]) => key === selected)?.[1];
  if (label) return label;
  if (review.scenario)
    return `${review.scenario.race ? "레이스 / 타임 트라이얼" : review.scenario.trail ? "트레일러닝" : "일반 러닝"}`;
  return "저장된 관점 없음";
}
