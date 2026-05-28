import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

export const metadata = {
  title: "VivaSim — Premium AI Viva Simulator",
  description: "Prepare for your oral exams with realistic academic AI examiners.",
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
