"use client";

import { useEffect } from "react";
import { toast } from "sonner";

interface CheckoutStatusToastProps {
  status?: string;
}

export function CheckoutStatusToast({ status }: CheckoutStatusToastProps) {
  useEffect(() => {
    if (!status) {
      return;
    }

    if (status === "success") {
      toast.success(
        "Checkout completed. Credits will appear after Stripe confirms payment.",
      );
    }

    if (status === "cancelled") {
      toast.info("Checkout cancelled. No credits were added or charged.");
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [status]);

  return null;
}
