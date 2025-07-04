"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function Home() {
  const [activeSection, setActiveSection] = useState("home");
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (isScrolling) return; // Don't update during programmatic scrolling

      const mainElement = document.querySelector("main");
      if (!mainElement) return;

      const sections = ["home", "stuff", "jobs"];
      const scrollPosition =
        mainElement.scrollTop + mainElement.clientHeight / 2;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const offsetTop = element.offsetTop;
          const height = element.offsetHeight;

          if (
            scrollPosition >= offsetTop &&
            scrollPosition < offsetTop + height
          ) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    const mainElement = document.querySelector("main");
    if (mainElement) {
      mainElement.addEventListener("scroll", handleScroll);
      return () => mainElement.removeEventListener("scroll", handleScroll);
    }
  }, [isScrolling]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      setIsScrolling(true); // Disable scroll handler
      setActiveSection(sectionId); // Update active section immediately
      element.scrollIntoView({ behavior: "smooth" });

      // Re-enable scroll handler after animation completes
      setTimeout(() => {
        setIsScrolling(false);
      }, 1000); // Adjust timing as needed
    }
  };

  return (
    <main
      className="h-screen overflow-y-scroll snap-y snap-mandatory snap-container"
      style={{ scrollSnapType: "y mandatory" }}
    >
      {/* First Section */}
      <section
        id="home"
        className="h-screen bg-background transition-colors duration-300 snap-start snap-always relative"
      >
        <div className="absolute top-24 left-14 md:left-10 md:top-32 z-10">
          <motion.p
            className="text-foreground text-5xl font-black font-gotham text-left leading-tight tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            Hey!
          </motion.p>
          <motion.p
            className="text-foreground text-5xl font-black font-gotham text-left leading-tight tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.8 }}
          >
            I&apos;m Ben Klosky.
          </motion.p>
        </div>

        <div className="absolute top-96 mt-32 left-1/2 transform -translate-x-1/2 md:top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 z-10">
          <div className="relative">
            <Image
              src="/ben.png"
              alt="Ben Klosky"
              width={640}
              height={640}
              className="w-72 h-72 md:w-96 md:h-96 object-contain rounded-full relative z-10"
            />
            <Image
              src="/bike.png"
              alt="Ben Klosky"
              width={640}
              height={640}
              className="w-72 h-72 md:w-96 md:h-96 object-contain rounded-full absolute top-1/3 left-3/4 transform -translate-x-1/2 -translate-y-1/2 rotate-[-50deg] z-0"
            />
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="fixed bottom-8 right-8 z-20">
          <nav className="flex flex-col space-y-3">
            {[
              { id: "home", label: "me" },
              { id: "stuff", label: "stuff" },
              { id: "jobs", label: "jobs" },
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
      </section>

      {/* Second Section - Placeholder */}
      <section
        id="stuff"
        className="h-screen bg-background transition-colors duration-300 snap-start snap-always relative"
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-foreground text-4xl font-black font-gotham mb-8">
              Stuff
            </h2>
            <p className="text-foreground text-lg max-w-2xl mx-auto px-6 leading-relaxed">
              This is a placeholder section. You can add your content here -
              perhaps information about your background, skills, projects, or
              whatever you&apos;d like to share.
            </p>
          </div>
        </div>
      </section>
      {/* Third Section - Jobs */}
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
    </main>
  );
}
