/** A fresh document is required so the fallback can never write to the real save slots. */
export const temporaryCareer = typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("temporary") === "1";


// Skip automatic resume for this document so a single stuck career cannot block the picker.
export const chooseCareer = typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("choose-career") === "1";
