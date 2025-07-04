"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

export default function Home() {
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const handleScroll = () => {
      const mainElement = document.querySelector("main");
      if (!mainElement) return;

      const sections = ["home", "about"];
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
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
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
          <p className="text-foreground text-5xl font-black font-gotham text-left leading-tight tracking-tight">
            Hey! <br /> I&apos;m Ben Klosky.
          </p>
        </div>

        <div className="absolute top-96 mt-8 left-1/2 transform -translate-x-1/2 md:top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 z-10">
          <Image
            src="/ben.png"
            alt="Ben Klosky"
            width={640}
            height={640}
            className="w-72 h-72 md:w-96 md:h-96 object-contain rounded-full"
          />
        </div>

        {/* Navigation Menu */}
        <div className="fixed bottom-8 right-8 z-20">
          <nav className="flex flex-col space-y-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => scrollToSection("home")}
                className={`text-sm font-medium transition-all duration-300 ${
                  activeSection === "home"
                    ? "text-foreground opacity-100"
                    : "text-foreground opacity-40 hover:opacity-70"
                }`}
                aria-label="Go to home section"
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection("home")}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  activeSection === "home"
                    ? "bg-foreground opacity-100 scale-110"
                    : "bg-foreground opacity-40 hover:opacity-70"
                }`}
                aria-label="Go to home section"
              />
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => scrollToSection("about")}
                className={`text-sm font-medium transition-all duration-300 ${
                  activeSection === "about"
                    ? "text-foreground opacity-100"
                    : "text-foreground opacity-40 hover:opacity-70"
                }`}
                aria-label="Go to about section"
              >
                About
              </button>
              <button
                onClick={() => scrollToSection("about")}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  activeSection === "about"
                    ? "bg-foreground opacity-100 scale-110"
                    : "bg-foreground opacity-40 hover:opacity-70"
                }`}
                aria-label="Go to about section"
              />
            </div>
          </nav>
        </div>
      </section>

      {/* Second Section - Placeholder */}
      <section
        id="about"
        className="h-screen bg-background transition-colors duration-300 snap-start snap-always relative"
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-foreground text-4xl font-black font-gotham mb-8">
              About Me
            </h2>
            <p className="text-foreground text-lg max-w-2xl mx-auto px-6 leading-relaxed">
              This is a placeholder section. You can add your content here -
              perhaps information about your background, skills, projects, or
              whatever you&apos;d like to share.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
