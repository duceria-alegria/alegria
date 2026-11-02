"use client";

import {ThemeProvider as NextThemesProvider} from "next-themes";

// The brand palette is light-only; `.dark` tokens stay in globals.css for when a dark variant is designed.
export function ThemeProvider({children}: {children: React.ReactNode}) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="light"
            forcedTheme="light"
            enableSystem={false}
            disableTransitionOnChange
        >
            {children}
        </NextThemesProvider>
    );
}
