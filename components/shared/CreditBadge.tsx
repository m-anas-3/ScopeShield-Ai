import { Coins } from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface CreditBadgeProps {
  credits: number;
}

export function CreditBadge({ credits }: CreditBadgeProps) {
  return (
    <Badge variant="secondary" className="gap-1.5 border border-gray-200 bg-white">
      <Coins className="h-3.5 w-3.5 text-[#534AB7]" />
      {credits} credits
    </Badge>
  );
}
