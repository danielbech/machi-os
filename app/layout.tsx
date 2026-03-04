import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit, Fira_Code, Inter, Plus_Jakarta_Sans, Lora, IBM_Plex_Mono } from "next/font/google";
import { ThemeToaster } from "@/components/theme-toaster";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Flowie",
  description: "Custom Kanban-based project management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var m=localStorage.getItem("flowie-theme-mode");if(m==="light"||(m==="system"&&window.matchMedia("(prefers-color-scheme:light)").matches)){document.documentElement.classList.remove("dark")}var c=localStorage.getItem("flowie-theme-cache");if(c){var v=JSON.parse(c),s=document.documentElement.style;for(var k in v)s.setProperty(k,v[k])}}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} ${firaCode.variable} ${inter.variable} ${plusJakartaSans.variable} ${lora.variable} ${ibmPlexMono.variable} antialiased`}
      >
        {children}
        <ThemeToaster />
      </body>
    </html>
  );
}
