/**
 * Bilingual translation utilities for Leave forms, summaries, and type badges.
 */

export function getTranslatedLeaveTypeName(name: string, isGujarati: boolean): string {
  if (!isGujarati) return name;
  const trimmed = (name || "").trim();
  const lower = trimmed.toLowerCase();

  if (lower === "cl") {
    return "કે. રજા (Casual Leave)";
  }
  if (lower === "casual leave" || lower === "casual") {
    return "કેઝ્યુઅલ રજા (Casual Leave)";
  }
  if (lower === "holiday leave" || lower === "holiday" || lower === "hl") {
    return "લાભ રજા (Holiday Leave)";
  }
  if (lower.includes("earned") || lower.includes("privilege") || lower === "pl" || lower === "el") {
    return "હક્ક રજા (Earned Leave)";
  }
  if (lower.includes("medical") || lower.includes("sick") || lower === "ml") {
    return "માંદગી / તબીબી રજા (Medical Leave)";
  }
  if (lower.includes("half pay") || lower.includes("commuted") || lower === "hpl") {
    return "અર્ધપગારી રજા (Half Pay Leave)";
  }
  if (lower.includes("maternity")) {
    return "પ્રસૂતિ રજા (Maternity Leave)";
  }
  if (lower.includes("paternity")) {
    return "પિતૃત્વ રજા (Paternity Leave)";
  }
  if (lower.includes("binpagari") || lower.includes("without pay") || lower === "lwp") {
    return "બિનપગારી રજા (Binpagari Leave)";
  }
  if (lower.includes("optional") || lower.includes("restricted") || lower === "rh" || lower === "oh") {
    return "મરજિયાત રજા (Optional Holiday)";
  }
  if (lower.includes("special") || lower === "spl") {
    return "ખાસ રજા (Special Leave)";
  }

  return trimmed;
}

export function getPureGujaratiLeaveTypeName(name: string): string {
  const trimmed = (name || "").trim();
  const lower = trimmed.toLowerCase();

  if (lower === "cl") {
    return "કે. રજા";
  }
  if (lower === "casual leave" || lower === "casual") {
    return "કેઝ્યુઅલ રજા";
  }
  if (lower === "holiday leave" || lower === "holiday" || lower === "hl") {
    return "લાભ રજા";
  }
  if (lower.includes("earned") || lower.includes("privilege") || lower === "pl" || lower === "el") {
    return "હક્ક રજા";
  }
  if (lower.includes("medical") || lower.includes("sick") || lower === "ml") {
    return "માંદગી રજા";
  }
  if (lower.includes("half pay") || lower.includes("commuted") || lower === "hpl") {
    return "અર્ધપગારી રજા";
  }
  if (lower.includes("maternity")) {
    return "પ્રસૂતિ રજા";
  }
  if (lower.includes("paternity")) {
    return "પિતૃત્વ રજા";
  }
  if (lower.includes("binpagari") || lower.includes("without pay") || lower === "lwp") {
    return "બિનપગારી રજા";
  }
  if (lower.includes("optional") || lower.includes("restricted") || lower === "rh" || lower === "oh") {
    return "મરજિયાત રજા";
  }
  if (lower.includes("special") || lower === "spl") {
    return "ખાસ રજા";
  }

  return trimmed;
}
