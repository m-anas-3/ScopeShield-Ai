"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ShareLinkButton({ sharePath }: { sharePath: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = sharePath.startsWith("http")
      ? sharePath
      : `${window.location.origin}${sharePath}`;

    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button type="button" variant="outline" onClick={copyLink}>
      <Copy />
      {copied ? "Copied" : "Copy Share Link"}
    </Button>
  );
}
