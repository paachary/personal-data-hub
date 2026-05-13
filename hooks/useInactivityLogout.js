import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

const TIMEOUT_MS = 5 * 60 * 1000;

export default function useInactivityLogout(onLogout) {
    const timerRef = useRef(null);
    const pathname = usePathname();

    const resetTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);

        // Do not start timer on auth pages
        if (pathname.startsWith("/auth")) return;

        timerRef.current = setTimeout(onLogout, TIMEOUT_MS);
    }, [onLogout, pathname]);

    useEffect(() => {
        // Do not attach listeners on auth pages
        if (pathname.startsWith("/auth")) return;

        const events = [
            "mousemove",
            "mousedown",
            "keydown",
            "scroll",
            "touchstart",
        ];
        events.forEach((e) => window.addEventListener(e, resetTimer));
        resetTimer();

        return () => {
            events.forEach((e) => window.removeEventListener(e, resetTimer));
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [resetTimer, pathname]);
}
