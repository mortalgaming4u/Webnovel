type Props = { percent: number };

export default function ProgressBar({ percent }: Props) {
  const p = Math.min(100, Math.max(0, Math.round(percent || 0)));
  return (
    <div className="w-full h-3 bg-gray-200 rounded overflow-hidden">
      <div className="h-full bg-brand" style={{ width: `${p}%`, transition: "width .25s ease" }} />
    </div>
  );
}