import "./globals.css";

export const metadata = {
  title: "Log-Whisperer",
  description: "Incident-aware log and anomaly dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
