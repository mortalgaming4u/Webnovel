import Sidebar from "../components/Sidebar";
import Reader from "../components/Reader";

export default function Home() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Reader />
      </div>
    </div>
  );
}
