import { useState } from "react";

interface WebProofProps {
  className?: string;
}

export const WebProof = ({ className = "" }: WebProofProps) => {
  const [proof, setProof] = useState<string | null>(null);
  const [generatingProof, setGeneratingProof] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateProof = async () => {
    try {
      setGeneratingProof(true);
      setError(null);
      console.log("Starting proof generation...");

      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/github/proof`;
      console.log("Making request to:", url);

      const response = await fetch(url, {
        credentials: "include",
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`Failed to generate proof: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log("Received proof data:", data);
      setProof(data.proof);
    } catch (error) {
      console.error("Detailed error in generateProof:", error);
      setError(error instanceof Error ? error.message : "Failed to generate proof");
    } finally {
      setGeneratingProof(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Web Proof</h2>
        <button onClick={generateProof} disabled={generatingProof} className="btn btn-primary">
          {generatingProof ? "Generating Proof..." : "Generate Web Proof"}
        </button>
      </div>

      {error && (
        <div className="bg-error/10 text-error p-4 rounded-lg shadow mb-6">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {proof && (
        <div className="bg-base-200 p-4 rounded-lg shadow mb-6">
          <h3 className="text-lg font-semibold mb-2">Generated Proof</h3>
          <pre className="whitespace-pre-wrap break-all text-sm">{proof}</pre>
        </div>
      )}
    </div>
  );
};
