import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly/parseOnly";
import remarkCjkStrike from "remark-cjk-friendly-gfm-strikethrough/parseOnly";
const h = React.createElement;
const components = {
  a: ({ href, children }) =>
    h("a", { href, target: "_blank", rel: "noopener noreferrer" }, children),
  table: ({ children }) =>
    h(
      "div",
      {
        className: "markdown-table",
        tabIndex: 0,
        role: "region",
        "aria-label": "표 · 가로로 스크롤",
      },
      h("table", null, children),
    ),
  // AI text may contain image URLs; don't fetch remote content automatically.
  img: ({ alt }) =>
    h("span", { className: "markdown-image-label" }, alt || "이미지"),
};
export default function Markdown({ children }) {
  return h(
    "div",
    { className: "markdown-content" },
    h(
      ReactMarkdown,
      { remarkPlugins: [remarkGfm, remarkCjkFriendly, remarkCjkStrike], skipHtml: true, components },
      String(children || ""),
    ),
  );
}
