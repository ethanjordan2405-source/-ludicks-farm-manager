import './globals.css';

export const metadata = {
  title: 'Ludicks Farm Management',
  description: 'Ludicks Farm guest house and restaurant management system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
