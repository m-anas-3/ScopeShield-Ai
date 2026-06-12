"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import {
  createChangeRequestAction,
  updateChangeRequestAction,
} from "@/lib/actions/change-requests";
import {
  changeRequestSchema,
  type ChangeRequestFormValues,
} from "@/lib/validations/change-request";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ChangeRequestFormProps {
  mode?: "create" | "edit";
  changeRequestId?: string;
  initialValues: ChangeRequestFormValues;
  cancelHref?: string;
}

function numberFromField(value: string | undefined) {
  const trimmed = (value ?? "").trim();

  if (trimmed.length === 0) {
    return null;
  }

  const numberValue = Number(trimmed);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function ChangeRequestForm({
  mode = "create",
  changeRequestId,
  initialValues,
  cancelHref,
}: ChangeRequestFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ChangeRequestFormValues>({
    resolver: zodResolver(changeRequestSchema),
    defaultValues: initialValues,
  });
  const watched = useWatch({ control: form.control });
  const fixedPrice = numberFromField(watched.fixed_price);
  const suppliedTotal = numberFromField(watched.estimated_total);
  const hourlyRate = numberFromField(watched.hourly_rate_snapshot);
  const maxHours = numberFromField(watched.estimated_hours_max);
  const currency = (watched.currency || "USD").toUpperCase();
  const previewTotal =
    fixedPrice ??
    suppliedTotal ??
    (hourlyRate !== null && maxHours !== null ? hourlyRate * maxHours : null);

  function onSubmit(values: ChangeRequestFormValues) {
    startTransition(async () => {
      const result =
        mode === "edit" && changeRequestId
          ? await updateChangeRequestAction(changeRequestId, values)
          : await createChangeRequestAction(values);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        mode === "edit"
          ? "Change request updated."
          : "Change request saved.",
      );
      router.push(`/change-requests/${result.changeRequestId}`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Change Request</CardTitle>
          <CardDescription>
            Prepare the client-ready summary, hours, and price.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <input type="hidden" {...form.register("project_id")} />
              <input type="hidden" {...form.register("scope_check_id")} />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Additional landing page work" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proposed Extra Work *</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-44" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="client_message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Original Client Request</FormLabel>
                    <FormControl>
                      <Textarea rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="estimated_hours_min"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Hours</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estimated_hours_max"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Hours</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-5 md:grid-cols-[1fr_120px]">
                <FormField
                  control={form.control}
                  name="hourly_rate_snapshot"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hourly Rate</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <Input
                          maxLength={3}
                          className="uppercase"
                          {...field}
                          onChange={(event) =>
                            field.onChange(event.target.value.toUpperCase())
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="estimated_total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Total</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fixed_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fixed Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Used as the displayed price when present.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                {cancelHref ? (
                  <Button type="button" variant="outline" asChild>
                    <a href={cancelHref}>Cancel</a>
                  </Button>
                ) : null}
                <Button type="submit" disabled={isPending}>
                  <Save />
                  {isPending
                    ? "Saving..."
                    : mode === "edit"
                      ? "Save Changes"
                      : "Save Change Request"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Pricing Snapshot</CardTitle>
          <CardDescription>Stored with this request.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Projected total</span>
            <span className="font-semibold text-slate-950">
              {formatCurrency(previewTotal, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Maximum hours</span>
            <span className="font-medium text-slate-950">
              {maxHours ?? "Not set"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Hourly rate</span>
            <span className="font-medium text-slate-950">
              {formatCurrency(hourlyRate, currency)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
