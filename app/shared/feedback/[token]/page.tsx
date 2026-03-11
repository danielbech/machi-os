import { notFound } from "next/navigation";
import { loadFeedbackBoardByToken } from "@/lib/supabase/website-feedback";
import { SharedFeedbackClient } from "./client";

export default async function SharedFeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await loadFeedbackBoardByToken(token);

  if (!data) return notFound();

  return (
    <SharedFeedbackClient
      board={data.board}
      initialItems={data.items}
      clientName={data.clientName}
      clientLogoUrl={data.clientLogoUrl}
      token={token}
    />
  );
}
