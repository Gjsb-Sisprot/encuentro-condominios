'use client';

import dynamic from 'next/dynamic';

const JornadasContent = dynamic(
  () => import('@/components/JornadasContent'),
  { ssr: false }
);

export default function JornadasPage() {
  return <JornadasContent />;
}
