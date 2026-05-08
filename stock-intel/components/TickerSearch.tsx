"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  onRemove?: () => void;
}

export default function TickerSearch({
  value,
  onChange,
  onSubmit,
  placeholder = "Enter ticker (e.g. NTSK)",
  onRemove,
}: Props) {
  const [input, setInput] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInput(value);
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const clean = input.trim().toUpperCase();
      if (clean) {
        onChange(clean);
        onSubmit(clean);
      }
    }
    if (e.key === "Escape") {
      onRemove?.();
    }
  }

  function handleBlur() {
    const clean = input.trim().toUpperCase();
    if (clean && clean !== value) {
      onChange(clean);
      onSubmit(clean);
    }
  }

  return (
    <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 focus-within:border-indigo-500 transition-colors">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="bg-transparent text-white text-sm font-mono w-28 outline-none placeholder:text-gray-600"
        maxLength={10}
        spellCheck={false}
        autoCapitalize="characters"
      />
      {onRemove && (
        <button
          onClick={onRemove}
          className="text-gray-500 hover:text-white text-xs ml-1 leading-none"
          aria-label="Remove ticker"
        >
          ×
        </button>
      )}
    </div>
  );
}
