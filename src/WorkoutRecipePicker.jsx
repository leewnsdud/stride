import React, { useState } from "react";
import { workoutRecipes, applyRecipe } from "../shared/workout-recipes.mjs";
export default function WorkoutRecipePicker({ session, onChange }) {
  const [selection, setSelection] = useState("");
  const [replace, setReplace] = useState(false);
  const available = workoutRecipes.filter((r) => r.type === session.type);
  const selected = available.find((r) => r.id === selection);
  const hasWork = !!(
    session.workout?.steps?.length ||
    session.duration ||
    session.distance ||
    session.workout?.purpose
  );
  return (
    <section className="recipe-picker">
      <small>DESIGN YOUR WORKOUT</small>
      <h3>이번 훈련에서 무엇을 연습할까요?</h3>
      <p className="helper">
        목적에 맞는 구성을 고른 뒤 시간·거리·강도를 조정하세요. 아래 수행량은
        개인 처방이 아닌 편집용 예시입니다.
      </p>
      <div
        className="recipe-options"
        role="group"
        aria-label="훈련 목적별 구성"
      >
        {available.map((r) => (
          <button
            type="button"
            key={r.id}
            aria-pressed={selected?.id === r.id}
            onClick={() => {
              setSelection(r.id);
              setReplace(false);
            }}
          >
            <strong>{r.name}</strong>
            <span>{r.purpose}</span>
            <small>{r.structure}</small>
          </button>
        ))}
      </div>
      {selected && (
        <div className="recipe-review">
          {selected.caution && <p>{selected.caution}</p>}
          {hasWork && (
            <label className="recipe-confirm">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />
              기존 단계·목적·전체 시간/거리를 이 구성으로 바꿀게요
            </label>
          )}
          <button
            type="button"
            className="button primary"
            disabled={hasWork && !replace}
            onClick={() => {
              onChange(applyRecipe(session, selected.id));
              setSelection("");
              setReplace(false);
            }}
          >
            선택한 구성으로 작성
          </button>
        </div>
      )}
    </section>
  );
}
