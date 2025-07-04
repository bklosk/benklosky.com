"use client";

export default function JobsSection() {
  return (
    <section
      id="jobs"
      className="h-screen bg-background transition-colors duration-300 snap-start snap-always relative"
    >
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-foreground text-4xl font-black font-gotham mb-8">
            jobs i&apos;ve held
          </h2>
        </div>
      </div>
    </section>
  );
}
