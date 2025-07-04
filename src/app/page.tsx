"use client";

import { useState, useEffect } from "react";
import HomeSection from "@/components/HomeSection";
import StuffSection from "@/components/StuffSection";
import JobsSection from "@/components/JobsSection";
import HireMeSection from "@/components/HireMeSection";
import Navigation from "@/components/Navigation";

export default function Home() {
  const [activeSection, setActiveSection] = useState("home");
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (isScrolling) return; // Don't update during programmatic scrolling

      const mainElement = document.querySelector("main");
      if (!mainElement) return;

      const sections = ["home", "stuff", "jobs", "work"];
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
      <HomeSection />
      <StuffSection />
      <JobsSection />
      <HireMeSection />
      <Navigation
        activeSection={activeSection}
        scrollToSection={scrollToSection}
      />
    </main>
  );
}
