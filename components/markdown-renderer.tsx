"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Lightweight, XSS-safe GitHub-Flavored Markdown renderer.
 * Formats headings, lists, blockquotes, inline formatting, and fenced code blocks with copy buttons.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlightCode(code: string, lang?: string): string {
  void lang;
  const escaped = escapeHtml(code);
  // Highlight keywords, strings, numbers, and comments safely
  return escaped
    .replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)/g, '<span class="tok-comment">$1</span>')
    .replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="tok-string">$1</span>')
    .replace(/\b(const|let|var|function|return|import|export|from|async|await|class|interface|type|public|private|if|else|switch|case|for|while|try|catch|throw|new|fn|mut|impl|struct|enum|pub|def)\b/g, '<span class="tok-keyword">$1</span>')
    .replace(/\b(true|false|null|undefined|None|Some|Ok|Err)\b/g, '<span class="tok-boolean">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="tok-number">$1</span>');
}

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  function copyToClipboard() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const highlightedHtml = highlightCode(code, language || "text");

  return (
    <div className="cb-code-block">
      <div className="cb-code-header">
        <span className="cb-code-lang">{language || "text"}</span>
        <button
          type="button"
          className="cb-code-copy-btn"
          onClick={copyToClipboard}
          title="Copy code to clipboard"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check size={12} className="copy-check" /> Copied!
            </>
          ) : (
            <>
              <Copy size={12} /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="cb-code-pre">
        <code
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          className={`lang-${language || "plain"}`}
        />
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ content, className = "" }: { content: string; className?: string }) {
  if (!content) return null;

  // Split content into blocks (code blocks vs text blocks)
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const blocks: Array<{ type: "code" | "markdown"; content: string; language?: string }> = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: "markdown",
        content: content.slice(lastIndex, match.index),
      });
    }
    blocks.push({
      type: "code",
      language: match[1] || "text",
      content: match[2].trimEnd(),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    blocks.push({
      type: "markdown",
      content: content.slice(lastIndex),
    });
  }

  function renderInline(text: string): string {
    let out = escapeHtml(text);
    // Bold: **text**
    out = out.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italic: *text* or _text_
    out = out.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Strikethrough: ~~text~~
    out = out.replace(/~~(.*?)~~/g, "<del>$1</del>");
    // Inline code: `code`
    out = out.replace(/`([^`]+)`/g, '<code class="cb-inline-code">$1</code>');
    // Links: [label](url) - only allowing safe http/https urls
    out = out.replace(
      /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="cb-markdown-link">$1</a>'
    );
    return out;
  }

  return (
    <div className={`cb-markdown-body ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === "code") {
          return <CodeBlock key={idx} code={block.content} language={block.language} />;
        }

        // Render text block paragraphs, headers, and lists
        const lines = block.content.split("\n");
        const elements: React.ReactNode[] = [];
        let listItems: string[] = [];

        function flushList(key: string) {
          if (listItems.length > 0) {
            elements.push(
              <ul key={key} className="cb-markdown-list">
                {listItems.map((item, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
                ))}
              </ul>
            );
            listItems = [];
          }
        }

        lines.forEach((line, lineIdx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            flushList(`list-${idx}-${lineIdx}`);
            return;
          }

          // Bulleted List
          if (/^[-*]\s+/.test(trimmed)) {
            listItems.push(trimmed.replace(/^[-*]\s+/, ""));
            return;
          }

          flushList(`list-${idx}-${lineIdx}`);

          // Headings
          if (trimmed.startsWith("### ")) {
            elements.push(
              <h4 key={lineIdx} className="cb-heading-3">
                {trimmed.replace(/^### /, "")}
              </h4>
            );
          } else if (trimmed.startsWith("## ")) {
            elements.push(
              <h3 key={lineIdx} className="cb-heading-2">
                {trimmed.replace(/^## /, "")}
              </h3>
            );
          } else if (trimmed.startsWith("# ")) {
            elements.push(
              <h2 key={lineIdx} className="cb-heading-1">
                {trimmed.replace(/^# /, "")}
              </h2>
            );
          } else if (trimmed.startsWith("> ")) {
            // Blockquote
            elements.push(
              <blockquote
                key={lineIdx}
                className="cb-blockquote"
                dangerouslySetInnerHTML={{ __html: renderInline(trimmed.replace(/^>\s*/, "")) }}
              />
            );
          } else {
            // Standard paragraph
            elements.push(
              <p
                key={lineIdx}
                className="cb-paragraph"
                dangerouslySetInnerHTML={{ __html: renderInline(trimmed) }}
              />
            );
          }
        });

        flushList(`list-end-${idx}`);

        return <div key={idx} className="cb-markdown-chunk">{elements}</div>;
      })}
    </div>
  );
}

