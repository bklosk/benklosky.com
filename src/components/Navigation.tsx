"use client";

interface NavigationProps {
  activeSection: string;
  scrollToSection: (sectionId: string) => void;
}

export default function Navigation({
  activeSection,
  scrollToSection,
}: NavigationProps) {
  return (
    <div className="fixed bottom-8 right-8 z-20">
      <nav className="flex flex-col space-y-3">
        {[
          { id: "home", label: "me" },
          { id: "stuff", label: "stuff" },
          { id: "jobs", label: "jobs" },
          { id: "work", label: "hire me" },
        ].map((section) => (
          <div key={section.id} className="flex items-center space-x-3">
            <button
              onClick={() => scrollToSection(section.id)}
              className={`text-sm font-sans font-extrabold transition-all duration-300 ${
                activeSection === section.id
                  ? "text-foreground opacity-100"
                  : "text-foreground opacity-40 hover:opacity-70"
              }`}
              aria-label={`Go to ${section.label.toLowerCase()} section`}
            >
              {section.label}
            </button>
            <button
              onClick={() => scrollToSection(section.id)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                activeSection === section.id
                  ? "bg-foreground opacity-100 scale-110"
                  : "bg-foreground opacity-40 hover:opacity-70"
              }`}
              aria-label={`Go to ${section.label.toLowerCase()} section`}
            />
          </div>
        ))}
      </nav>
    </div>
  );
}
