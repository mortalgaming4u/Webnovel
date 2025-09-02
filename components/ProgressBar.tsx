export default function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-2 bg-gray-200 rounded mt-2">
      <div className="h-2 bg-green-500 rounded" style={{ width: `${progress}%` }} />
    </div>
  );
}
