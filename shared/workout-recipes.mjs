import { blankStep, stepTotals } from "./workout.mjs";

const rpe = (low, high = low) => ({
  metric: "rpe",
  low: String(low),
  high: String(high),
  basis: "예시 노력도 · 현재 능력과 회복 상태에 맞게 수정",
  date: "",
});
const timed = (
  name,
  seconds,
  low = 2,
  high = 4,
  type = "work",
  notes = "",
) => ({
  ...blankStep(type),
  name,
  min: seconds,
  max: seconds,
  intensity: rpe(low, high),
  notes,
});
const open = (name, notes, type = "recovery") => ({
  ...blankStep(type),
  name,
  end: "manual",
  min: null,
  max: null,
  intensity: rpe(2, 3),
  notes,
});
const repeat = (count, work, recovery) => ({
  ...blankStep("repeat"),
  name: `${count}회 반복`,
  count,
  children: [work, { ...recovery, condition: "between" }],
});
const warm = () => timed("편안한 워밍업", 600, 2, 3, "warmup");
const cool = () => timed("편안한 쿨다운", 600, 2, 3, "cooldown");
const bookend = (...steps) => [warm(), ...steps, cool()];
const recipe = (id, type, name, purpose, structure, build, extra = {}) => ({
  id,
  type,
  name,
  purpose,
  structure,
  build,
  ...extra,
});
export const workoutRecipes = [
  recipe(
    "easy",
    "easy",
    "기초 유산소",
    "대화 가능한 강도로 일관된 유산소 기반 쌓기",
    "편안한 지속주",
    () => [timed("대화 가능한 달리기", 1800)],
  ),
  recipe(
    "strides",
    "easy",
    "이지런 + 스트라이드",
    "편안한 달리기 후 짧게 리듬과 주법 점검",
    "이지런 → 4 × (20초 가속 + 충분한 회복)",
    () => [
      timed("이지런", 1200),
      repeat(
        4,
        timed("부드러운 가속 · 전력질주 아님", 20, 6, 7),
        timed("걷기 / 조깅 회복", 100, 1, 2, "recovery"),
      ),
      cool(),
    ],
  ),
  recipe(
    "recovery",
    "recovery",
    "회복 조깅",
    "피로를 더하지 않고 몸 상태 확인",
    "짧고 아주 편안한 지속주",
    () => [timed("회복 조깅", 1200, 1, 3)],
  ),
  recipe(
    "tempo",
    "tempo",
    "지속 템포",
    "통제된 역치 노력도 유지",
    "워밍업 → 지속 템포 → 쿨다운",
    () => bookend(timed("통제된 템포", 900, 6, 7)),
  ),
  recipe(
    "cruise",
    "tempo",
    "크루즈 인터벌",
    "회복을 끼워 넣고 반복 가능한 역치 노력도 축적",
    "워밍업 → 3 × (5분 + 회복 2분) → 쿨다운",
    () =>
      bookend(
        repeat(
          3,
          timed("크루즈 템포", 300, 6, 7),
          timed("조깅 회복", 120, 2, 3, "recovery"),
        ),
      ),
  ),
  recipe(
    "subthreshold",
    "tempo",
    "통제된 서브역치",
    "역치 아래의 통제된 노력도를 익히는 단일 세션",
    "워밍업 → 3 × (4분 + 회복 2분) → 쿨다운",
    () =>
      bookend(
        repeat(
          3,
          timed(
            "서브역치 노력 · 끝까지 통제",
            240,
            5,
            6,
            "work",
            "RPE만으로 LT2 이하를 확정할 수 없습니다. 호흡·회복과 확인된 개인 역치 기준을 함께 봅니다.",
          ),
          timed("조깅 회복", 120, 2, 3, "recovery"),
        ),
      ),
    {
      caution:
        "노르웨이 모델의 강도 통제 원칙을 참고한 예시입니다. 더블 역치나 주 3회 처방이 아니며, 강도 경험이 있는 러너가 조정해 사용합니다.",
    },
  ),
  recipe(
    "interval",
    "interval",
    "시간 인터벌",
    "짧은 고강도 구간과 회복을 분리",
    "워밍업 → 4 × (2분 + 회복 2분) → 쿨다운",
    () =>
      bookend(
        repeat(
          4,
          timed("통제된 빠른 달리기", 120, 7, 8),
          timed("조깅 회복", 120, 2, 3, "recovery"),
        ),
      ),
  ),
  recipe(
    "repetition",
    "repetition",
    "짧은 반복 · 충분한 회복",
    "속도 경쟁보다 자세와 리듬 유지",
    "워밍업 → 4 × (30초 + 회복 2분) → 쿨다운",
    () =>
      bookend(
        repeat(
          4,
          timed("자세를 유지하는 빠른 구간", 30, 7, 8),
          timed("충분한 걷기 / 조깅", 120, 1, 2, "recovery"),
        ),
      ),
  ),
  recipe(
    "marathon",
    "marathon",
    "마라톤 노력도 블록",
    "현재 감당할 수 있는 마라톤 노력도와 보급 점검",
    "워밍업 → 2 × (10분 + 회복 3분) → 쿨다운",
    () =>
      bookend(
        repeat(
          2,
          timed("마라톤 노력도", 600, 5, 6),
          timed("이지 조깅", 180, 2, 3, "recovery"),
        ),
      ),
  ),
  recipe(
    "long",
    "long",
    "이지 롱런",
    "오래 움직이는 능력과 익숙한 보급 연습",
    "편안한 지구력 지속주",
    () => [timed("편안한 롱런", 3600)],
    { fueling: "익숙한 제품·보급 시점·수분과 위장 반응을 기록하세요." },
  ),
  recipe(
    "progression",
    "long",
    "점진적 롱런",
    "후반에도 자세와 노력도 통제 확인",
    "편안한 시작 → 안정된 지속 → 통제된 후반 → 쿨다운",
    () => [
      timed("편안한 시작", 1200, 2, 3),
      timed("안정된 지속", 1200, 3, 4),
      timed("통제된 후반 · 전력 금지", 600, 4, 5),
      cool(),
    ],
    {
      caution:
        "누적 피로 아래의 지속 능력을 점검하는 예시입니다. 적응된 러너만 사용하고 후반 강도와 전체 시간을 동시에 올리지 마세요.",
    },
  ),
  recipe(
    "hill",
    "hill",
    "오르막 반복",
    "경사에서 노력도와 자세를 유지",
    "워밍업 → 4 × (오르막 1분 + 내려오기) → 쿨다운",
    () =>
      bookend(
        repeat(
          4,
          timed("오르막 · 페이스 대신 노력도", 60, 7, 8),
          open(
            "걸어서 / 조깅으로 내려오기",
            "출발 지점에 돌아오고 호흡이 회복되면 다음 반복",
          ),
        ),
      ),
    { terrain: "안전하고 익숙한 완만한 언덕 · 노면과 회수 경로 확인" },
  ),
  recipe(
    "uphill-me",
    "trail",
    "오르막 근지구력 · 하이킹",
    "급경사에서 지속 가능한 등반 동작 익히기",
    "워밍업 → 3 × (파워 하이킹 5분 + 회복) → 쿨다운",
    () =>
      bookend(
        repeat(
          3,
          timed(
            "무게 추가 없이 파워 하이킹",
            300,
            4,
            5,
            "work",
            "지속 가능한 걸음과 자세. 심박보다 다리 피로가 커지면 강도를 낮춥니다.",
          ),
          open(
            "완만한 경로로 회복",
            "출발 지점과 회복 상태를 확인한 뒤 재시작",
          ),
        ),
      ),
    {
      terrain: "안전한 오르막 또는 경사 트레드밀",
      caution:
        "기초와 근력 적응 후 사용하는 코스 특이 예시입니다. 중량 배낭·고강도 스텝업을 자동 처방하지 않습니다.",
    },
  ),
  recipe(
    "trail-course",
    "trail",
    "코스 특이 지구력",
    "달리기·하이킹·하강을 코스에 맞게 전환",
    "워밍업 → 달리기 → 하이킹 → 하강 제어 → 쿨다운",
    () => [
      warm(),
      timed("대화 강도의 트레일 달리기", 1200),
      timed("오르막 파워 하이킹", 600, 3, 4),
      timed(
        "완만한 하강 제어",
        300,
        2,
        3,
        "work",
        "시간은 상한입니다. 적절한 구간이 없으면 걷기로 대체합니다.",
      ),
      cool(),
    ],
    {
      terrain: "대회와 비슷한 노면 · 경사 · 회수 가능한 코스",
      fueling: "보급 위치, 제품, 수분, 위장 반응을 확인하세요.",
    },
  ),
  recipe(
    "downhill",
    "trail",
    "하강 기술 적응",
    "속도보다 발 디딤과 제동 제어 익히기",
    "워밍업 → 3 × (하강 1분 + 회복) → 쿨다운",
    () =>
      bookend(
        repeat(
          3,
          timed("완만한 하강 · 제어 우선", 60, 2, 3),
          open(
            "걸어서 돌아오기",
            "안전한 출발 지점으로 돌아오고 다리 상태 확인",
          ),
        ),
      ),
    {
      terrain: "익숙하고 완만한 하강 · 기술적 급경사 제외",
      caution:
        "낮은 심박이어도 편심성 부하는 큽니다. 다음 날 근육통을 확인하고 다른 핵심훈련을 추가하지 마세요.",
    },
  ),
  recipe(
    "run-hike",
    "trail",
    "런·하이크 지구력",
    "대화 가능한 노력도로 달리기와 걷기 전환",
    "4 × (달리기 8분 + 하이킹 2분)",
    () => [
      {
        ...blankStep("repeat"),
        name: "런·하이크 전환",
        count: 4,
        children: [
          timed("편안한 달리기", 480),
          timed("파워 하이킹 / 걷기", 120, 2, 4),
        ],
      },
    ],
    { terrain: "경사와 노면에 따라 전환 시점 조정" },
  ),
  recipe(
    "race",
    "race",
    "레이스 구간 전략",
    "초반 통제·중반 유지·후반 판단 기준 구분",
    "초반 → 중반 → 후반 (코스 지점으로 종료)",
    () => [
      open(
        "초반 · 여유 있게",
        "첫 기준 지점까지 · 실제 거리/보급소를 입력하세요.",
        "work",
      ),
      open(
        "중반 · 계획 유지",
        "후반 진입 지점까지 · 실제 거리/보급소를 입력하세요.",
        "work",
      ),
      open(
        "후반 · 상태에 따라 판단",
        "결승선까지 · 통증/보급 실패 시 감속 기준 작성",
        "work",
      ),
    ],
    {
      race: {
        kind: "race",
        role: "goal",
        strategy: "초반 여유, 중반 보급 유지, 후반 상태에 따라 판단",
        criteria: "호흡·통증·위장 반응·코스 상황",
        before: "새로운 자극을 줄이고 익숙한 루틴 유지",
        after: "보행·통증·수면·피로 확인 후 복귀",
        resultUse: "기록과 수행 과정을 분리해 다음 블록에 반영",
      },
    },
  ),
  recipe(
    "rest",
    "rest",
    "회복일",
    "다음 훈련을 위한 회복 확보",
    "달리기 없이 회복 상태 확인",
    () => [],
  ),
];
export function applyRecipe(session, id) {
  const r = workoutRecipes.find((r) => r.id === id);
  if (!r || r.type !== session.type)
    throw new Error("현재 종류에 맞는 훈련 구성을 선택하세요.");
  const steps = r.build();
  const totals = stepTotals(steps);
  const fixed = (key) =>
    totals[key].complete && totals[key].min === totals[key].max;
  return {
    ...session,
    title: session.title || r.name,
    distance: fixed("distance") ? totals.distance.min : null,
    duration: fixed("duration") ? totals.duration.min : null,
    workout: {
      ...session.workout,
      purpose: r.purpose,
      steps,
      amountBasis: r.type === "rest" ? "rest" : "steps",
      totalKind: fixed("duration") || fixed("distance") ? "exact" : "unknown",
      intensity: { metric: "none", low: "", high: "", basis: "", date: "" },
      terrain: r.terrain || session.workout?.terrain || "",
      fueling: r.fueling || session.workout?.fueling || "",
      evaluation: "목적 달성 여부, 실제 RPE, 통증과 다음 날 회복 확인",
      ...(r.race ? { race: r.race } : {}),
    },
  };
}
