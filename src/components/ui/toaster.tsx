"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        unstyled: false,
        className: "font-sans",
        style: {
          background: "white",
          border: "1px solid #e4e4e7",
          color: "#18181b",
          borderRadius: "8px",
          fontSize: "14px",
        },
      }}
    />
  );
}
