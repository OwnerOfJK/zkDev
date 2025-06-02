import { useState } from "react";

interface WebProofProps {
  className?: string;
}

export const WebProof = ({ className = "" }: WebProofProps) => {
  const [proof, setProof] = useState<string | null>(null);
  const [generatingProof, setGeneratingProof] = useState(false);
  const [provingProof, setProvingProof] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proveResult, setProveResult] = useState<any>(null);

  const generateProof = async () => {
    try {
      setGeneratingProof(true);
      setError(null);
      setProveResult(null);
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

  const proveProof = async () => {
    if (!proof) {
      setError("No proof available to prove");
      return;
    }

    try {
      setProvingProof(true);
      setError(null);
      console.log("Starting proof verification...");

      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/github/prove`;
      console.log("Making request to:", url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify({ webProof: proof }),
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`Failed to verify proof: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log("Received prove result:", data);
      setProveResult(data);
    } catch (error) {
      console.error("Detailed error in proveProof:", error);
      setError(error instanceof Error ? error.message : "Failed to verify proof");
    } finally {
      setProvingProof(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={generateProof} 
          disabled={generatingProof} 
          className={`btn btn-primary mr-4 relative overflow-hidden ${generatingProof ? 'animate-pulse' : 'animate-pulse-slow'}`}
        >
          <span className="relative z-10">
            {generatingProof ? "Generating Proof..." : "Generate Web Proof"}
          </span>
          {generatingProof && (
            <span className="absolute inset-0 bg-primary/20 animate-pulse"></span>
          )}
        </button>
        {proof && (
          <button 
            onClick={proveProof} 
            disabled={provingProof} 
            className={`btn btn-secondary relative overflow-hidden ${provingProof ? 'animate-pulse' : 'animate-pulse-slow'}`}
          >
            <span className="relative z-10">
              {provingProof ? "Verifying Proof..." : "Verify Proof"}
            </span>
            {provingProof && (
              <span className="absolute inset-0 bg-secondary/20 animate-pulse"></span>
            )}
          </button>
        )}
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

      {proveResult && (
        <div className="bg-success/10 text-success p-4 rounded-lg shadow mb-6">
          <h3 className="text-lg font-semibold mb-2">Verification Result</h3>
          <pre className="whitespace-pre-wrap break-all text-sm">
            {JSON.stringify(proveResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
