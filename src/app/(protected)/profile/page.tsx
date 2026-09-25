import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { PageHeader } from "@/components/ui/page-header";
import {
  OfficerProfileContainer,
  type OfficerProfileData,
} from "@/components/profile/officer-profile-container";
import type { TimelineEventItem } from "@/components/profile/timeline-event-modal";

export const metadata = {
  title: "Officer Career Profile — My Duty",
  description: "View and manage career milestones, postings, honours, and GST awards.",
};

export default async function ProfilePage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const supabase = await createClient();

  const [
    { data: userRow },
    { data: departments },
    { data: rawTimeline },
  ] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, full_name, avatar_url, employee_code, phone, role, status, designation, joining_date, joining_place, current_posting, date_of_birth, blood_group, emergency_contact, home_district, bio, department_id, departments(name)"
      )
      .eq("id", currentUser.id)
      .maybeSingle(),
    supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("officer_timeline")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("start_date", { ascending: false }),
  ]);

  const deptData = userRow?.departments as unknown as { name: string } | null;

  const officerData: OfficerProfileData = {
    id: currentUser.id,
    fullName: userRow?.full_name ?? currentUser.fullName,
    avatarUrl: userRow?.avatar_url ?? null,
    phone: userRow?.phone,
    email: currentUser.email,
    departmentId: userRow?.department_id ?? currentUser.departmentId,
    departmentName: deptData?.name ?? null,
    designation: userRow?.designation ?? null,
    employeeCode: userRow?.employee_code ?? null,
    joiningDate: userRow?.joining_date ?? null,
    joiningPlace: userRow?.joining_place ?? null,
    currentPosting: userRow?.current_posting ?? null,
    dateOfBirth: userRow?.date_of_birth ?? null,
    bloodGroup: userRow?.blood_group ?? null,
    emergencyContact: userRow?.emergency_contact ?? null,
    homeDistrict: userRow?.home_district ?? null,
    bio: userRow?.bio ?? null,
    role: currentUser.role,
    status: currentUser.status,
  };

  const timelineEvents = (rawTimeline ?? []) as unknown as TimelineEventItem[];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-3 py-6 sm:space-y-8 sm:px-6 lg:px-8 2xl:max-w-6xl">
      <PageHeader
        title="Officer Career Profile"
        subtitle="Chronological career milestones, postings, transfers, and official honours & awards."
      />

      <OfficerProfileContainer
        officer={officerData}
        departments={departments ?? []}
        timelineEvents={timelineEvents}
        canEdit={true}
      />
    </main>
  );
}
