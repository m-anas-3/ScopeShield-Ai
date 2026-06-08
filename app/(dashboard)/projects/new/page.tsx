import { ProjectForm } from "@/components/projects/ProjectForm";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-normal text-slate-950">
          New Project
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add the agreed scope before scope checks are enabled in Part 2.
        </p>
      </div>
      <ProjectForm />
    </div>
  );
}
