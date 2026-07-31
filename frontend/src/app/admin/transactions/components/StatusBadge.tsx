import clsx from "clsx";

interface Props {
  status: string;
}

export default function StatusBadge({ status }: Props) {
  const color = clsx(
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border",

    {
      "bg-emerald-500/10 border-emerald-500/30 text-emerald-400":
        status === "PAID" || status === "SUCCESS",

      "bg-yellow-500/10 border-yellow-500/30 text-yellow-400":
        status === "PENDING" || status === "PROCESSING",

      "bg-red-500/10 border-red-500/30 text-red-400":
        status === "FAILED",
    }
  );

  return <span className={color}>{status}</span>;
}