import IdqChat from './idq-chat.tsx';

export default async function IdqPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const { member } = await searchParams;
  if (!member) {
    return <p className="error">No member in context. Start at the beginning.</p>;
  }
  return <IdqChat memberId={member} />;
}
