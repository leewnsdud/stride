// Single icon family and semantic aliases for the whole application.
import React from "react";
import { PencilSparkles, House as HomeLine, CalendarDays, ChartNoAxesCombined, Target as TargetLine, Settings, HeartPulse, SportShoe, Mountain } from "lucide-react";

const lineIcon = (Icon) => function LineIcon({ weight, ...props }) {
  return <Icon {...props} strokeWidth={1.8} />;
};
export const House = lineIcon(HomeLine);
export const CalendarBlank = lineIcon(CalendarDays);
export const ChartLineUp = lineIcon(ChartNoAxesCombined);
export const Target = lineIcon(TargetLine);
export const GearSix = lineIcon(Settings);

export const Heartbeat = lineIcon(HeartPulse);

// Keep activity symbols in the same Lucide family as the main navigation.
export const RunIcon = lineIcon(SportShoe);
export const Mountains = lineIcon(Mountain);
export function ActivityIcon({ activity, ...props }) {
  const Icon = activity?.type === "trail" ? Mountains : RunIcon;
  return <Icon {...props} />;
}
export function CoachIcon({ weight, ...props }) {
  return <PencilSparkles {...props} strokeWidth={1.8} />;
}
export {
  Archive,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
  ChartBar,
  ChatCircleDots,
  Check,
  CheckCircle,
  Clock,
  DownloadSimple,
  Flag,
  IconContext,
  Info,
  Leaf,
  Lightning,
  LinkSimple,
  PaperPlaneTilt,
  Path,
  PencilSimple,
  Plug,
  Plus,
  SignOut,
  Sparkle,
  Steps,
  Trash,
  TrendUp,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
