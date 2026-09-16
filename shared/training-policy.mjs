export const POLICY_VERSION = "2026-09-v7";
export const methodLabels = {
  subthreshold: "통제된 서브역치 · 단일 세션",
  foundation: "기초 지구력 우선",
  pyramidal: "피라미달 · 저강도 중심",
  polarized: "폴라라이즈드 · 강도 분리",
};
export const policySources = [
  {
    id: "subelite-plans",
    title: "서브엘리트 마라톤 92개 계획 정량 분석 · 효능 시험 아님 (2024)",
    url: "https://pubmed.ncbi.nlm.nih.gov/38695978/",
  },
  {
    id: "trained-periodization",
    title: "숙련 러너 강도 분포 16주 비교 연구 (2022)",
    url: "https://pubmed.ncbi.nlm.nih.gov/34792817/",
  },
  {
    id: "utmb-course",
    title: "UTMB 공식 코스 · 실제 거리·고도 확인",
    url: "https://montblanc.utmb.world/races/UTMB",
  },
  {
    id: "norwegian",
    title: "노르웨이식 젖산 통제 역치 모델 · 리뷰 (2023)",
    url: "https://pubmed.ncbi.nlm.nih.gov/36900796/",
  },
  {
    id: "uphill-review",
    title: "오르막 훈련 메타분석 · 근거 확실성 낮음 (2026)",
    url: "https://pubmed.ncbi.nlm.nih.gov/42536523/",
  },
  {
    id: "graded",
    title: "상·하강 달리기 생리·역학 리뷰 (2025)",
    url: "https://pubmed.ncbi.nlm.nih.gov/41209300/",
  },
  {
    id: "mountain-me",
    title: "Uphill Athlete: 산악 근지구력 · 코칭 자료 (2026)",
    url: "https://uphillathlete.com/strength-training/muscular-endurance-for-mountain-athletes/",
  },
  {
    id: "prediction",
    title: "레크리에이션 러너의 기록 환산 한계 (2016)",
    url: "https://pubmed.ncbi.nlm.nih.gov/27570626/",
  },
  {
    id: "intensity",
    title: "거리 러너의 강도 분포·주기화 체계적 문헌고찰 (2022)",
    url: "https://pubmed.ncbi.nlm.nih.gov/35418513/",
  },
  {
    id: "distribution",
    title: "강도 분포와 측정 방법의 차이 (2022)",
    url: "https://pubmed.ncbi.nlm.nih.gov/34749417/",
  },
  {
    id: "taper",
    title: "지구력 종목 테이퍼 메타분석 (2023)",
    url: "https://pubmed.ncbi.nlm.nih.gov/37163550/",
  },
  {
    id: "load",
    title: "5,205명 러너의 단일 세션 거리 급증·부상 관찰연구 (2025)",
    url: "https://pubmed.ncbi.nlm.nih.gov/40623829/",
  },
  {
    id: "strength",
    title: "근력 훈련과 러닝 이코노미 메타분석 (2024)",
    url: "https://pubmed.ncbi.nlm.nih.gov/38165636/",
  },
  {
    id: "descent",
    title: "다운힐 적응·편심성 부담 리뷰 (2020)",
    url: "https://pubmed.ncbi.nlm.nih.gov/33037592/",
  },
  {
    id: "fuel",
    title: "ISSN 울트라 훈련·레이스 영양 입장문 (2019)",
    url: "https://pubmed.ncbi.nlm.nih.gov/31699159/",
  },
  {
    id: "vdot",
    title: "V.O2 E/M/T/I/R 훈련 목적 정의 · 코칭 자료",
    url: "https://vdoto2.com/learn-more/training-definitions",
  },
  {
    id: "trail",
    title: "Uphill Athlete: 기초에서 코스 특이성으로 · 코칭 자료",
    url: "https://uphillathlete.com/podcast/training-for-trail-running-base-training-to-course-specialization/",
  },
];
export const adjustmentRules = [
  "놓친 훈련은 몰아서 보충하지 않습니다. 다음 가능한 날에도 핵심 훈련 사이 최소 48시간을 유지합니다.",
  "같은 노력도에서 유난히 힘들거나 회복이 덜 됐다면 다음 핵심훈련을 이지런 또는 휴식으로 바꿉니다. 통증으로 보행·주법이 바뀌거나 질병 증상이 있으면 훈련을 중단하고 상태를 확인합니다.",
  "매주 활동 연결·RPE·수면·통증을 점검한 뒤 다음 블록을 재상담합니다. 결석한 주의 계획량을 다음 기준으로 사용하지 않습니다.",
  "심박 5존과 연구의 생리적 3존은 같지 않습니다. 강도는 현재 능력과 대화 가능 여부/RPE로 설정하며 목표 기록을 현재 훈련 페이스로 간주하지 않습니다.",
];

export const trailApproaches = {
  auto: "코스와 경험에 맞춰 추천",
  aerobic: "유산소 · 런/하이크 기반",
  uphill: "오르막 근지구력 · 파워 하이킹",
  course: "코스 특이성 · 하강 제어",
};
export const methodDescriptions = {
  foundation: "기초와 회복이 우선입니다. 편안한 달리기를 일관되게 반복합니다.",
  pyramidal:
    "저강도 중심에 역치 훈련을 제한적으로 배치합니다. 마라톤 목표에는 해당 노력도 연습을 더합니다.",
  polarized:
    "쉬운 달리기와 짧은 강한 구간을 분리합니다. 80/20을 강제하지 않습니다.",
  subthreshold:
    "노르웨이 모델의 강도 통제 원칙을 참고한 단일 세션입니다. 12주 이상 일관성·강도 경험·주 180분 이상이 필요하며 RPE만으로 실제 역치 이하를 보장하지 않습니다. 더블 역치를 처방하지 않습니다.",
};
