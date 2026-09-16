export function coachingSelectionError(scope, activities) {
  if (
    scope.kind === "activity" &&
    !activities.some((a) => a.id === scope.activityId)
  )
    return "검토할 달리기 기록을 다시 선택하세요.";
  if (scope.kind === "period") {
    const start = Date.parse(scope.start),
      end = Date.parse(scope.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end)
      return "시작일과 종료일을 확인하세요.";
    if (end - start > 91 * 86400000)
      return "한 번에 최대 92일을 검토할 수 있습니다. 기간을 줄여주세요.";
  }
  return "";
}
