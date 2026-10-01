import { useEffect, useState } from "react";

/** Эвристика «это телефон/планшет»: грубый указатель + (сенсорный ввод или узкий экран). */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const touchUA = navigator.maxTouchPoints > 0 && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const narrow = window.innerWidth < 820;
  if (coarse && (touchUA || narrow)) return true;
  if (touchUA && narrow) return true;
  return false;
}

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(isMobileDevice);
  useEffect(() => {
    const onChange = () => setMobile(isMobileDevice());
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);
  return mobile;
}
