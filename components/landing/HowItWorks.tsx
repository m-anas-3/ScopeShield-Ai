const steps = [
  {
    label: "Create Project",
    text: "Save the original scope, deliverables, exclusions, rates, and revision terms.",
  },
  {
    label: "Paste Request",
    text: "Drop in the new client ask when Part 2 enables scope checks.",
  },
  {
    label: "Get Answer",
    text: "Receive the verdict, risk level, suggested action, and reply draft.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-y border-gray-200 bg-slate-50 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-bold tracking-normal text-slate-950">
            How it works
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.label} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg bg-[#534AB7] text-sm font-semibold text-white">
                {index + 1}
              </div>
              <h3 className="text-lg font-semibold text-slate-950">{step.label}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
