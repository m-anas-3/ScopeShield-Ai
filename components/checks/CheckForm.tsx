"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, SearchCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { checkSchema, type CheckFormValues } from "@/lib/validations/check";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface CheckFormProps {
  projectId: string;
  projectName: string;
}

export function CheckForm({ projectId, projectName }: CheckFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const inFlightIdempotencyKey = useRef<string | null>(null);
  const form = useForm<CheckFormValues>({
    resolver: zodResolver(checkSchema),
    defaultValues: {
      project_id: projectId,
      client_request: "",
      urgency: undefined,
      client_tone: undefined,
      extra_notes: "",
    },
  });

  async function onSubmit(values: CheckFormValues) {
    if (inFlightIdempotencyKey.current) {
      return;
    }

    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    inFlightIdempotencyKey.current = idempotencyKey;
    setIsLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          project_id: projectId,
          client_request: values.client_request,
          urgency: values.urgency,
          client_tone: values.client_tone,
          extra_notes: values.extra_notes,
        }),
      });

      const result = (await response.json()) as { id?: string; error?: string };

      if (response.status === 402) {
        toast.error("You have run out of credits. Please upgrade.");
        inFlightIdempotencyKey.current = null;
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        toast.error(result.error ?? "Analysis failed. Please try again.");
        inFlightIdempotencyKey.current = null;
        setIsLoading(false);
        return;
      }

      if (!result.id) {
        toast.error("Analysis failed. Please try again.");
        inFlightIdempotencyKey.current = null;
        setIsLoading(false);
        return;
      }

      router.push(`/checks/${result.id}`);
    } catch {
      toast.error("Could not reach the analysis service. Please try again.");
      inFlightIdempotencyKey.current = null;
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="client_request"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-4">
                <FormLabel>Client Request</FormLabel>
                <span className="text-xs text-muted-foreground">
                  {field.value.length}/2000
                </span>
              </div>
              <FormControl>
                <Textarea
                  rows={5}
                  placeholder="Paste the client message or describe what they are asking for..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            control={form.control}
            name="urgency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Urgency{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select urgency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="client_tone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Client Tone{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="pushy">Pushy</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="extra_notes"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-4">
                <FormLabel>
                  Additional Notes{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </FormLabel>
                <span className="text-xs text-muted-foreground">
                  {(field.value ?? "").length}/500
                </span>
              </div>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Any extra context that might help the analysis..."
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <SearchCheck />
            )}
            {isLoading ? "Analyzing..." : "Analyze Scope"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Each analysis uses 8 credits · {projectName}
          </p>
        </div>
      </form>
    </Form>
  );
}
