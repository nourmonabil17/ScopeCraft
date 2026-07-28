export const metadata = {
  title: "ScopeCraft",
  description: "Turn an idea into a structured product plan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
