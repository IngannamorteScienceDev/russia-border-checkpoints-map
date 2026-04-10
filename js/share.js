function copyWithLegacyTextarea(text) {
  if (typeof document?.createElement !== "function" || !document.body) return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);

  if (typeof textarea.select === "function") textarea.select();
  if (typeof textarea.setSelectionRange === "function") textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;

  if (typeof document.execCommand === "function") {
    copied = document.execCommand("copy");
  }

  document.body.removeChild(textarea);
  return copied;
}

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_error) {
    // Fall through to legacy copy fallback.
  }

  return copyWithLegacyTextarea(text);
}
