import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoomRead",
  description: "Read the room before you're in it. A culture-check agent powered by Qloo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
