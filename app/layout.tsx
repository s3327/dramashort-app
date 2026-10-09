import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Fredoka, Plus_Jakarta_Sans } from "next/font/google";
import {
  ThemeProvider,
  THEME_COOKIE_NAME,
  DEFAULT_THEME,
  isValidTheme,
  getThemeColor,
  type SiteTheme,
} from "@/contexts/ThemeContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { DailyRewardProvider } from "@/contexts/DailyRewardContext";
import DailyCheckInModal from "@/components/rewards/DailyCheckInModal";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "DramaShort — Vertical dramas, daily",
  description:
    "Vertical dramas built for a 12-minute break — revenge, rebirth, forbidden marriages, repeat.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1C1220" },
    { media: "(prefers-color-scheme: light)", color: "#F3E7EA" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE_NAME)?.value;
  const initialTheme: SiteTheme =
    themeCookie && isValidTheme(themeCookie) ? themeCookie : DEFAULT_THEME;

  const colorScheme = initialTheme === "dark" ? "dark" : "light";
  const themeColor = getThemeColor(initialTheme);

  return (
    <html
      lang="en"
      data-theme={initialTheme}
      style={{ colorScheme }}
      className={`${fredoka.variable} ${jakarta.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content={themeColor} />
        {/* Pre-hydration sync script to prevent flash if user previously had theme in localStorage */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/${THEME_COOKIE_NAME}=([^;]+)/);if(!m){var s=localStorage.getItem('${THEME_COOKIE_NAME}');if(s&&['light','soft','dark'].indexOf(s)!==-1){document.documentElement.setAttribute('data-theme',s);document.documentElement.style.colorScheme=s==='dark'?'dark':'light';document.cookie='${THEME_COOKIE_NAME}='+s+';path=/;max-age=31536000;SameSite=Lax';}}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider initialTheme={initialTheme}>
          <AuthProvider>
            <FavoritesProvider>
              <DailyRewardProvider>
                {children}
                <DailyCheckInModal />
              </DailyRewardProvider>
            </FavoritesProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
