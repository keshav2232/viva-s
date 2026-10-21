"use client";

import { useEffect, useState } from "react";

export default function useSectionNavigation(ids) {
  const [active, setActive] = useState(ids.split(",")[0]);
  useEffect(() => {
    const sections = ids.split(",").map(id => document.getElementById(id)).filter(Boolean).sort((a, b) => a.compareDocumentPosition(b) & 4 ? -1 : 1);
    sections.forEach(section => section.setAttribute("tabindex", "-1"));
    function update() {
      let current = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 160) current = section;
      }
      if (current) {
        setActive(current.id);
        for (const section of sections) {
          document.querySelectorAll(`nav a[href="#${section.id}"]`).forEach(link => {
            if (section === current) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
          });
        }
      }
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [ids]);
  return active;
}
