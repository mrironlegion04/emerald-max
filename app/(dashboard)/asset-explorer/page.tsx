import AssetHierarchyGraph from '@/components/AssetHierarchyGraph';

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const { location } = await searchParams;

  return (
    <div className="w-full h-screen">
      <AssetHierarchyGraph location={location} />
    </div>
  );
}