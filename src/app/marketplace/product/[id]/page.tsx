import { Suspense } from 'react';
import ProductDetail from './product-detail';
import Navbar from '@/components/marketplace/navbar';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <Navbar />
      <Suspense fallback={<div>Loading...</div>}>
        <ProductDetail productId={id} />
      </Suspense>
    </>
  );
}