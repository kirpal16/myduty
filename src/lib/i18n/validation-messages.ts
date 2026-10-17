/**
 * Project-wide mapping for form validation errors, Zod schema issues,
 * and server action status messages in Gujarati.
 */

export const VALIDATION_MESSAGES_GU: Record<string, string> = {
  // Duty Form Validations
  "Select a duty type.": "ડ્યુટી પ્રકાર પસંદ કરો.",
  "Enter a start time.": "શરૂઆત સમય દાખલ કરો.",
  "Enter an end time.": "અંત સમય દાખલ કરો.",
  "End time must be after start time.": "અંત સમય શરૂઆત સમય પછીનો હોવો જોઈએ.",
  "Distance must be a number.": "અંતર એક સંખ્યા હોવી જોઈએ.",
  "Distance can't be negative.": "અંતર ઋણ ન હોઈ શકે.",
  "Amount must be a number.": "રકમ એક સંખ્યા હોવી જોઈએ.",
  "Amount can't be negative.": "રકમ ઋણ ન હોઈ શકે.",
  "Holiday allowance must be a number.": "રજાનું ભથ્થું એક સંખ્યા હોવી જોઈએ.",
  "Allowance can't be negative.": "ભથ્થું ઋણ ન હોઈ શકે.",
  "Bad day key.": "અમાન્ય દિવસ કી.",
  "This overlaps a duty you've already logged for that time.":
    "આ સમય માટે તમે પહેલેથી જ નોંધેલી ડ્યુટી સાથે ઓવરલેપ થાય છે.",
  "Shift timings overlap with each other on this day. Please adjust the hours.":
    "આ દિવસે શિફ્ટનો સમય એકબીજા સાથે ઓવરલેપ થાય છે. કૃપા કરીને કલાકોમાં ફેરફાર કરો.",

  // Leave Form Validations
  "Select a leave type.": "રજા પ્રકાર પસંદ કરો.",
  "Enter a start date.": "શરૂઆત તારીખ દાખલ કરો.",
  "Enter an end date.": "અંત તારીખ દાખલ કરો.",
  "End date must be on or after start date.": "અંત તારીખ શરૂઆત તારીખના દિવસે અથવા પછીની હોવી જોઈએ.",
  "A half-day request must be a single date.": "અડધા દિવસની રજાની અરજી એક જ તારીખ માટે હોવી જોઈએ.",
  "Select AM or PM for a half-day request.": "અડધા દિવસની અરજી માટે AM અથવા PM પસંદ કરો.",
  "Missing officer.": "કર્મચારી પસંદ કરેલ નથી.",
  "Missing leave type.": "રજા પ્રકાર પસંદ કરેલ નથી.",
  "Enter a year.": "વર્ષ દાખલ કરો.",
  "Year must be a whole number.": "વર્ષ પૂર્ણાંક હોવું જોઈએ.",
  "That year is outside the range this app keeps balances for.":
    "તે વર્ષ માન્ય શ્રેણીની બહાર છે.",
  "Enter a number of days.": "દિવસોની સંખ્યા દાખલ કરો.",
  "Days cannot be negative.": "દિવસો ઋણ ન હોઈ શકે.",
  "That is more days than a year holds.": "તે એક વર્ષના દિવસો કરતાં વધુ છે.",
  "Enter a maximum, or leave it blank.": "મહત્તમ મર્યાદા દાખલ કરો અથવા ખાલી રાખો.",
  "The maximum cannot be negative.": "મહત્તમ મર્યાદા ઋણ ન હોઈ શકે.",
  "That maximum looks wrong.": "મહત્તમ મર્યાદા અમાન્ય જણાય છે.",
  "Carried days cannot be negative.": "આગળ ખેંચેલ દિવસો ઋણ ન હોઈ શકે.",
  "The maximum accumulated balance cannot be negative.":
    "મહત્તમ સંચિત બેલેન્સ ઋણ ન હોઈ શકે.",
  "Give the leave type a name.": "રજાના પ્રકારને નામ આપો.",
  "A name needs at least 2 characters.": "નામમાં ઓછામાં ઓછા ૨ અક્ષરો હોવા જોઈએ.",
  "That name is too long.": "તે નામ ખૂબ લાંબુ છે.",
  "That code is too long.": "તે કોડ ખૂબ લાંબો છે.",
  "Choose a colour.": "રંગ પસંદ કરો.",

  // Auth Validations
  "Enter a valid email.": "માન્ય ઇમેઇલ દાખલ કરો.",
  "Password is required.": "પાસવર્ડ જરૂરી છે.",
  "Be at least 8 characters long.": "ઓછામાં ઓછા ૮ અક્ષર હોવા જોઈએ.",
  "Contain at least one letter.": "ઓછામાં ઓછો એક અક્ષર હોવો જોઈએ.",
  "Contain at least one number.": "ઓછામાં ઓછો એક અંક હોવો જોઈએ.",
  "Enter your full name.": "તમારું પૂરું નામ દાખલ કરો.",
  "Select a profile.": "પ્રોફાઇલ પસંદ કરો.",
  "Enter the 6-digit verification code.": "૬ અંકનો ચકાસણી કોડ દાખલ કરો.",
  "Verification code must be exactly 6 digits.": "ચકાસણી કોડ બરાબર ૬ અંકનો હોવો જોઈએ.",
  "Confirm your password.": "પાસવર્ડની પુષ્ટિ કરો.",
  "Passwords do not match.": "પાસવર્ડ મેળ ખાતા નથી.",

  // Profile & Settings Validations
  "Enter your name.": "તમારું નામ દાખલ કરો.",
  "Name must be at least 2 characters.": "નામમાં ઓછામાં ઓછા ૨ અક્ષર હોવા જોઈએ.",
  "Name cannot exceed 80 characters.": "નામ ૮૦ અક્ષરોથી વધુ ન હોઈ શકે.",
  "Phone number is too long.": "ફોન નંબર ખૂબ લાંબો છે.",
  "That phone number is too long.": "ફોન નંબર ખૂબ લાંબો છે.",
  "Enter a valid phone number.": "માન્ય ફોન નંબર દાખલ કરો.",
  "Enter a valid contact number.": "માન્ય સંપર્ક નંબર દાખલ કરો.",
  "Choose a valid department.": "માન્ય વિભાગ પસંદ કરો.",
  "Select a valid department.": "માન્ય વિભાગ પસંદ કરો.",
  "Designation is too long.": "હોદ્દો ખૂબ લાંબો છે.",
  "Buckle/Employee code is too long.": "બકલ / કર્મચારી કોડ ખૂબ લાંબો છે.",
  "Enter a valid date (YYYY-MM-DD).": "માન્ય તારીખ દાખલ કરો (YYYY-MM-DD).",
  "Enter a valid date of birth (YYYY-MM-DD).": "માન્ય જન્મ તારીખ દાખલ કરો (YYYY-MM-DD).",
  "Joining place is too long.": "જોડાવાનું સ્થળ ખૂબ લાંબુ છે.",
  "Current posting is too long.": "હાલનું પોસ્ટિંગ ખૂબ લાંબુ છે.",
  "Blood group is invalid.": "બ્લડ ગ્રુપ અમાન્ય છે.",
  "Emergency contact is too long.": "ઇમરજન્સી સંપર્ક નંબર ખૂબ લાંબો છે.",
  "Home district is too long.": "વતન જિલ્લો ખૂબ લાંબો છે.",
  "Bio/Achievements cannot exceed 2000 characters.": "બાયો/સિદ્ધિઓ ૨૦૦૦ અક્ષરોથી વધુ ન હોઈ શકે.",
  "Select an event type.": "ઇવેન્ટ પ્રકાર પસંદ કરો.",
  "Enter a title for this milestone.": "આ માઇલસ્ટોન માટે શીર્ષક દાખલ કરો.",
  "Title must be at least 2 characters.": "શીર્ષકમાં ઓછામાં ઓછા ૨ અક્ષર હોવા જોઈએ.",
  "Title cannot exceed 150 characters.": "શીર્ષક ૧૫૦ અક્ષરોથી વધુ ન હોઈ શકે.",
  "Department/Station is too long.": "વિભાગ/સ્ટેશન ખૂબ લાંબુ છે.",
  "Location/Place is too long.": "સ્થળ ખૂબ લાંબુ છે.",
  "From location is too long.": "ક્યાંથી સ્થળ ખૂબ લાંબુ છે.",
  "To location is too long.": "ક્યાં સુધી સ્થળ ખૂબ લાંબુ છે.",
  "Select a start date.": "શરૂઆત તારીખ પસંદ કરો.",
  "Enter a valid start date (YYYY-MM-DD).": "માન્ય શરૂઆત તારીખ દાખલ કરો (YYYY-MM-DD).",
  "Enter a valid end date (YYYY-MM-DD).": "માન્ય અંત તારીખ દાખલ કરો (YYYY-MM-DD).",
  "Description cannot exceed 2000 characters.": "વર્ણન ૨૦૦૦ અક્ષરોથી વધુ ન હોઈ શકે.",
  "Enter department name.": "વિભાગનું નામ દાખલ કરો.",
  "Department name must have at least 2 characters.": "વિભાગના નામમાં ઓછામાં ઓછા ૨ અક્ષર હોવા જોઈએ.",
  "Department name cannot exceed 80 characters.": "વિભાગનું નામ ૮૦ અક્ષરોથી વધુ ન હોઈ શકે.",
  "Enter an amount.": "રકમ દાખલ કરો.",
  "A rate cannot be negative.": "દર ઋણ ન હોઈ શકે.",
  "A salary rate cannot be negative.": "પગાર દર ઋણ ન હોઈ શકે.",
  "That rate looks wrong.": "દર અમાન્ય જણાય છે.",
  "Use a 24-hour time such as 10:00.": "૨૪-કલાકનો સમય વાપરો જેમ કે ૧૦:૦૦.",
  "Use a 24-hour time such as 18:00.": "૨૪-કલાકનો સમય વાપરો જેમ કે ૧૮:૦૦.",
  "Both shift times are needed.": "બંને શિફ્ટ સમય જરૂરી છે.",

  // Holiday & Admin Validations
  "Give the holiday a name.": "રજાનું નામ આપો.",
  "Choose a date.": "તારીખ પસંદ કરો.",
  "Choose a valid date.": "માન્ય તારીખ પસંદ કરો.",
  "Choose who this applies to.": "આ કોને લાગુ પડે છે તે પસંદ કરો.",
  "Choose the profile this holiday applies to.": "આ રજા જે પ્રોફાઇલને લાગુ પડે છે તે પસંદ કરો.",
  "That holiday no longer exists.": "તે રજા હવે અસ્તિત્વમાં નથી.",
  "Enter a code.": "કોડ દાખલ કરો.",
  "A code needs at least 2 characters.": "કોડમાં ઓછામાં ઓછા ૨ અક્ષરો હોવા જોઈએ.",
  "Use letters, numbers, spaces, hyphens or underscores only.":
    "માત્ર અક્ષરો, સંખ્યાઓ, જગ્યાઓ, હાઇફન અથવા અંડરસ્કોર વાપરો.",
  "Enter a name.": "નામ દાખલ કરો.",
  "Keep the description under 300 characters.": "વર્ણન ૩૦૦ અક્ષરોથી ઓછું રાખો.",
  "Choose the profile this duty type belongs to.": "આ ડ્યુટી પ્રકાર જે પ્રોફાઇલનો છે તે પસંદ કરો.",

  // Action / System Responses
  "Not authenticated": "પ્રમાણીકરણ થયેલ નથી.",
  "Permission denied.": "પરવાનગી નકારી.",
  "Required": "જરૂરી છે.",
  "Saved.": "સાચવવામાં આવ્યું.",
  "Failed to save.": "સાચવવામાં નિષ્ફળતા.",
  "Something went wrong.": "ક્ષતિ આવી. ફરી પ્રયાસ કરો.",
  "Profile updated successfully.": "પ્રોફાઇલ સફળતાપૂર્વક અપડેટ થઈ ગઈ.",
  "Leave type deleted.": "રજા પ્રકાર કાઢી નાખ્યો.",
  "Leave type enabled.": "રજા પ્રકાર સક્ષમ કર્યો.",
  "Leave type disabled.": "રજા પ્રકાર અક્ષમ કર્યો.",
  "Please provide a valid application date (YYYY-MM-DD).":
    "કૃપા કરીને માન્ય અરજી તારીખ (YYYY-MM-DD) દાખલ કરો.",
  "Applied days must be greater than 0.": "અરજી કરેલ દિવસો ૦ કરતાં વધુ હોવા જોઈએ.",
  "Please provide a valid 'Valid From' date (YYYY-MM-DD).":
    "કૃપા કરીને માન્ય શરૂઆત તારીખ દાખલ કરો.",
  "Please provide a valid 'Valid To' date (YYYY-MM-DD).":
    "કૃપા કરીને માન્ય અંત તારીખ દાખલ કરો.",
  "'Valid To' date cannot be before 'Valid From' date.":
    "અંત તારીખ શરૂઆત તારીખ પહેલાંની ન હોઈ શકે.",
  "Please provide a valid approval date.": "કૃપા કરીને માન્ય મંજૂરી તારીખ દાખલ કરો.",
  "Please enter the approving authority or office.":
    "કૃપા કરીને મંજૂર કરનાર અધિકારી અથવા કચેરી દાખલ કરો.",
  "Approved days must be greater than 0.": "મંજૂર દિવસો ૦ કરતાં વધુ હોવા જોઈએ.",
  "Leave classification not found in system.": "સિસ્ટમમાં રજા વર્ગીકરણ મળ્યું નથી.",
  "Special Leave application not found.": "વિશેષ રજા અરજી મળી નથી.",
  "Failed to save signature.": "સહી સાચવવામાં નિષ્ફળતા.",
  "Failed to save configuration": "રૂપરેખાંકન સાચવવામાં નિષ્ફળતા.",
};

/**
 * Translates an error message to Gujarati if the language is "gu",
 * with support for exact matches and common dynamic patterns.
 */
export function translateErrorMessage(
  message: string | null | undefined,
  lang: string = "en",
): string {
  if (!message) return "";
  if (lang !== "gu") return message;

  const trimmed = message.trim();

  // 1. Exact match lookup
  if (VALIDATION_MESSAGES_GU[trimmed]) {
    return VALIDATION_MESSAGES_GU[trimmed];
  }

  // 2. Dynamic pattern matching
  if (trimmed.startsWith("Approved days (") && trimmed.includes("cannot exceed applied days")) {
    return trimmed
      .replace("Approved days (", "મંજૂર દિવસો (")
      .replace(") cannot exceed applied days (", ") અરજી કરેલ દિવસો (")
      .replace(").", ") કરતાં વધી ન શકે.");
  }

  if (trimmed.startsWith("Please select an approved ") && trimmed.endsWith(" sanction.")) {
    const sanction = trimmed
      .replace("Please select an approved ", "")
      .replace(" sanction.", "");
    return `કૃપા કરીને મંજૂર થયેલ ${sanction} મંજૂરી પસંદ કરો.`;
  }

  if (trimmed.startsWith("Selected ") && trimmed.endsWith(" sanction is not approved.")) {
    const sanction = trimmed
      .replace("Selected ", "")
      .replace(" sanction is not approved.", "");
    return `પસંદ કરેલ ${sanction} મંજૂરી માન્ય/મંજૂર થયેલ નથી.`;
  }

  if (trimmed.startsWith("Officer ") && trimmed.includes("permanently removed")) {
    return trimmed
      .replace("Officer ", "અધિકારી ")
      .replace(
        " and all associated data have been permanently removed.",
        " અને તમામ સંબંધિત માહિતી કાયમી ધોરણે કાઢી નાખવામાં આવી છે.",
      );
  }

  if (trimmed.startsWith("Fix the day-by-day breakdown first.")) {
    return trimmed.replace(
      "Fix the day-by-day breakdown first.",
      "પહેલા દિવસ મુજબની વિગતો સુધારો.",
    );
  }

  // Default fallback to original string
  return message;
}
