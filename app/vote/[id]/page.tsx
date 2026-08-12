import { VoteView } from "@/components/vote/vote-view";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function VoteDetailPage({ params }: Props) {
  const { id } = await params;
  return <VoteView voteId={id} />;
}
