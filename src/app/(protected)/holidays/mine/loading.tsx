// /holidays/mine only redirects to /settings?tab=holidays. Without its own
// loading file the holidays LIST skeleton flashed first, then settings
// appeared — so show the settings shape straight away.
import { SettingsSkeleton } from "../../settings/loading";

export default function MyHolidaysLoading() {
  return <SettingsSkeleton />;
}
