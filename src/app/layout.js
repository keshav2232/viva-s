import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

export const metadata = {
  description: "Build confidence for vivas and job interviews with adaptive AI practice, your own topics, and focused feedback.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
