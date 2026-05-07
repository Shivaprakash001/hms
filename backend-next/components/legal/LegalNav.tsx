"use client"

import { useEffect, useState } from "react"

interface NavItem {
  id: string
  title: string
}

interface LegalNavProps {
  sections: NavItem[]
}

export default function LegalNav({ sections }: LegalNavProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "")
  const [elevated, setElevated] = useState(false)

  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 100)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: "-15% 0px -75% 0px", threshold: 0 }
    )

    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [sections])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    const offset = 72
    const y = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top: y, behavior: "smooth" })
    setActiveId(id)
  }

  return (
    <nav
      aria-label="Legal sections navigation"
      className={`sticky top-0 z-40 bg-white border-b border-slate-200 transition-shadow duration-200 ${
        elevated ? "shadow-sm" : ""
      }`}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <ul
          role="list"
          className="flex overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {sections.map(({ id, title }) => {
            const isActive = activeId === id
            return (
              <li key={id} role="listitem">
                <a
                  href={`#${id}`}
                  onClick={(e) => handleClick(e, id)}
                  aria-current={isActive ? "location" : undefined}
                  className={`
                    relative flex items-center py-4 px-5 text-sm font-medium whitespace-nowrap
                    transition-colors duration-150 border-b-2 focus-visible:outline-none
                    focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset
                    ${
                      isActive
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                    }
                  `}
                >
                  {title}
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
