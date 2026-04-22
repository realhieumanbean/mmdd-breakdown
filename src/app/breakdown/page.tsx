"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function BreakdownPage() {
  const params = useParams();
  const router = useRouter();
  
  // This extracts the specific version ID from the URL
  const versionId = params.id;

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center justify-center">
      <div className="text-center space-y-6 max-w-lg bg-white p-10 rounded-xl shadow-sm border border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900">Script Breakdown</h1>
        
        <div className="p-4 bg-gray-100 rounded-md">
          <p className="text-sm text-gray-500 font-mono">Loading data for Version ID:</p>
          <p className="text-md font-semibold text-gray-800 truncate mt-1">{versionId}</p>
        </div>

        <p className="text-gray-500 text-sm">
          This is a placeholder page. In Phase 3, this will be replaced with the split-screen Script Tagger and Element Board.
        </p>

        <Button onClick={() => router.push('/')} variant="outline" className="mt-4">
          ← Back to Dashboard
        </Button>
      </div>
    </div>
  );
}