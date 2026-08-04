type Props = {
  onClick: () => void;
  variant: "add" | "remove";
};

export default function IconButton({ onClick, variant }: Props) {
  const styles =
    variant === "add"
      ? "bg-emerald-600 hover:bg-emerald-500"
      : "bg-red-600 hover:bg-red-500";

  return (
    <button
      onClick={onClick}
      className={`h-8 w-8 flex items-center justify-center
        rounded-md text-white text-lg transition ${styles}`}
    >
      {variant === "add" ? "+" : "–"}
    </button>
  );
}
