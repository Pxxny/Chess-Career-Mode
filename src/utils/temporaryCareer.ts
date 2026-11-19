/** A fresh document is required so the fallback can never write to the real save slots. */
export const temporaryCareer = typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("temporary") === "1";
