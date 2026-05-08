"use client";

export default function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="h-7 w-32 bg-gray-800 rounded mb-2" />
        <div className="h-4 w-48 bg-gray-800 rounded mb-6" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-20 bg-gray-800 rounded mb-1" />
              <div className="h-4 w-24 bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="h-4 w-24 bg-gray-800 rounded mb-4" />
        <div className="h-64 bg-gray-800 rounded" />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="h-4 w-40 bg-gray-800 rounded mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-800 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
