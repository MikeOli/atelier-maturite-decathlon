"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (!navigator.clipboard) {
      setError(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setError(false);
    } catch {
      setError(true);
      setCopied(false);
    } finally {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        setError(false);
      }, 2000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
        {copied ? "Copié !" : "Copier le lien"}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied
          ? "Lien copié dans le presse-papier."
          : error
            ? "Impossible de copier le lien."
            : ""}
      </span>
      {error && (
        <span className="text-sm text-red-500">Échec de la copie</span>
      )}
    </div>
  );
}
