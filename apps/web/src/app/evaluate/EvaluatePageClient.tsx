'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import EvaluationOutput from '@/components/EvaluationOutput';

interface System { id: string; name: string; }

export default function EvaluatePage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [systems, setSystems] = useState<System[]>([]);
  const [systemId, setSystemId] = useState(searchParams.get('systemId') || '');
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<{ signals: any; result: any } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated') {
      fetch('/api/systems').then((r) => r.json()).then(setSystems);
:
