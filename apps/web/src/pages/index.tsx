import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to V5000 home page
    router.replace('/v5000');
  }, [router]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
      <p>Redirecting to V5000...</p>
    </div>
  );
}

