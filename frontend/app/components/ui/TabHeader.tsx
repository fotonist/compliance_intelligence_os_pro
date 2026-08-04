import TabBadge from "./TabBadge";

type Props = {
  title: string;
  badge: string;
  color:
    | "risk"
    | "control"
    | "task"
    | "evidence"
    | "intel";
};

export default function TabHeader({
  title,
  badge,
  color,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <TabBadge label={badge} color={color} />
      <span className="font-medium">
        {title}
      </span>
    </div>
  );
}