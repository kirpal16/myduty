import { OfficerProfileSkeleton } from "@/components/profile/officer-profile-skeleton";
import { PageHeader } from "@/components/ui/page-header";

export default function ProfileLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-3 py-6 sm:space-y-8 sm:px-6 lg:px-8 2xl:max-w-6xl">
      {/* The real header, word for word, so its line wrap cannot jump. */}
      <PageHeader
        title="Officer Career Profile"
        subtitle="Chronological career milestones, postings, transfers, and official honours & awards."
      />
      <OfficerProfileSkeleton />
    </main>
  );
}
