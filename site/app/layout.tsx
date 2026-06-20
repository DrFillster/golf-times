import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dallas Open Tee Times",
  description:
    "Live open tee times at 4 public golf courses in the Dallas area — Irving, Prairie Lakes, Golf Ranch Richardson, Duck Creek. Polled directly from TeeItUp.",
  openGraph: {
    title: "Dallas Open Tee Times",
    description: "Live tee times at 4 public Dallas golf courses.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}