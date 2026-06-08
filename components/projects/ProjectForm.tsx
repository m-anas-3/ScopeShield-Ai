"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createProjectAction,
  updateProjectAction,
} from "@/lib/actions/projects";
import {
  projectSchema,
  type ProjectFormValues,
} from "@/lib/validations/project";
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

interface ProjectFormProps {
  mode?: "create" | "edit";
  projectId?: string;
  initialValues?: ProjectFormValues;
}

const emptyValues: ProjectFormValues = {
  name: "",
  client_name: "",
  original_scope: "",
  deliverables: "",
  exclusions: "",
  revision_limit: "",
  hourly_rate: "",
};

export function ProjectForm({
  mode = "create",
  projectId,
  initialValues,
}: ProjectFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: initialValues ?? emptyValues,
  });

  function onSubmit(values: ProjectFormValues) {
    startTransition(async () => {
      const result =
        mode === "edit" && projectId
          ? await updateProjectAction(projectId, values)
          : await createProjectAction(values);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(mode === "edit" ? "Project updated." : "Project created.");
      router.push(`/projects/${result.projectId}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Scope</CardTitle>
        <CardDescription>
          Capture the original agreement before locking it for AI checks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Website redesign" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Studio" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="original_scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Original Scope *</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-48"
                      placeholder="Paste the agreed scope, contract summary, or statement of work..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Include what is included, expected outcomes, and agreed boundaries.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                control={form.control}
                name="deliverables"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deliverables</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Landing page, brand guidelines, handoff notes..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="exclusions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exclusions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Copywriting, extra templates, rush work..."
                        {...field}
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
                name="revision_limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Revision Limit</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        placeholder="2"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hourly_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hourly Rate</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="125"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                <Save />
                {isPending
                  ? "Saving..."
                  : mode === "edit"
                    ? "Save Changes"
                    : "Save Project"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
