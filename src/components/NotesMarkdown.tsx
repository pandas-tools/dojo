"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * NotesMarkdown — renders a lesson's notes_markdown as styled HTML for the
 * dark notes surfaces (the desktop side panel and the mobile VideoNotesSheet).
 *
 * Employees should never see raw markdown syntax ("####", "**", "---"). Each
 * element is mapped to a restrained, panel-native treatment: headings are
 * quiet (no giant browser defaults), body is #f9fdff at 85% opacity, dividers
 * are hairline white, links inherit the arctic accent. The component owns the
 * text rhythm; callers only set width/scroll.
 */

const components: Components = {
  h1: ({ children }) => (
    <h2 className="mt-6 mb-2 text-[17px] font-semibold leading-[1.3] text-[#f9fdff] first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-6 mb-2 text-[15px] font-semibold leading-[1.3] text-[#f9fdff] first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-5 mb-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#f9fdff]/70 first:mt-0">
      {children}
    </h4>
  ),
  h4: ({ children }) => (
    <h5 className="mt-4 mb-1 text-[13px] font-semibold text-[#f9fdff]/80 first:mt-0">
      {children}
    </h5>
  ),
  p: ({ children }) => (
    <p className="my-3 text-[14px] leading-[22px] text-[#f9fdff]/85 first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[#f9fdff]">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-[#f9fdff]/75">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-arctic-haze underline underline-offset-2 hover:text-[#f9fdff]"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-arctic-haze first:mt-0 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:text-[#f9fdff]/45 first:mt-0 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="pl-1 text-[14px] leading-[22px] text-[#f9fdff]/85">
      {children}
    </li>
  ),
  hr: () => <hr className="my-5 border-0 border-t border-white/12" />,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-arctic-haze/60 pl-4 text-[14px] italic leading-[22px] text-[#f9fdff]/75">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12.5px] text-[#f9fdff]">
      {children}
    </code>
  ),
};

export default function NotesMarkdown({ children }: { children: string }) {
  return (
    <div className="text-[14px] leading-[22px] text-[#f9fdff]/85">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
