import "./globals.css";

export const metadata = {
  title: "Log-Whisperer",
  description: "Intelligent Log Analysis & Anomaly Detection",
};

export const viewport = "width=device-width, initial-scale=1";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#0d6efd" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
