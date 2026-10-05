"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Printer,
  Check,
  Car,
  Building,
  User,
  FileText,
  CheckCircle2,
  RotateCcw,
  Shield,
  Eye,
  Globe,
  MapPin,
  FileEdit,
} from "lucide-react";
import { updateUserSettings } from "@/actions/settings";
import { useToast } from "@/components/ui/toast";
import type { UserSettings } from "@/lib/settings/getUserSettings";
import {
  toGujaratiNumerals,
  toAsciiNumerals,
  formatGujaratiBuckleNumber,
  transliterateToGujarati,
  formatGujaratiPoliceRank,
} from "@/lib/reports/gujaratiReportUtils";

export function PrintConfigPanel({
  settings,
  officerName,
  officerPost,
  officerPosting,
  employeeCode,
}: {
  settings: UserSettings;
  officerName: string;
  officerPost: string | null;
  officerPosting: string | null;
  employeeCode: string | null;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Header fields
  const [headerLine1, setHeaderLine1] = useState(
    settings.printHeaderLine1 || "ગુજરાત પોલીસ (GUJARAT POLICE)",
  );
  const [headerLine2, setHeaderLine2] = useState(
    settings.printHeaderLine2 || settings.printStationName || officerPosting || "QRT અરવલ્લી પોલીસ",
  );
  const [headerLine1En, setHeaderLine1En] = useState(
    settings.printHeaderLine1En || "Gujarat Police",
  );
  const [headerLine2En, setHeaderLine2En] = useState(
    settings.printHeaderLine2En || "Duty & Roster Records",
  );

  // Recipient & Station fields
  const [recipientTitle, setRecipientTitle] = useState(
    settings.printRecipientTitle || "પોલીસ સબ ઇન્સપેક્ટરશ્રી",
  );
  const [stationName, setStationName] = useState(
    settings.printStationName || officerPosting || "QRT અરવલ્લી પોલીસ",
  );

  const gujOfficerName = transliterateToGujarati(officerName) || officerName;
  const gujOfficerPost = formatGujaratiPoliceRank(officerPost) || (officerPost ?? "");
  const gujBuckleNo = formatGujaratiBuckleNumber(employeeCode, settings.printUseGujaratiDigits ?? true);
  const defaultSig = `${gujOfficerName}${gujOfficerPost ? `, ${gujOfficerPost}` : ""}${gujBuckleNo ? ` બ.નં. ${gujBuckleNo}` : ""}`;

  // Signatory & Footer fields
  const [signatoryName, setSignatoryName] = useState(() => {
    if (settings.printSignatoryName) {
      return (settings.printUseGujaratiDigits ?? true)
        ? toGujaratiNumerals(settings.printSignatoryName)
        : settings.printSignatoryName;
    }
    return defaultSig;
  });
  const [footerPlace, setFooterPlace] = useState(
    settings.printFooterPlace || (officerPosting?.split(",")[0] ?? "") || "અરવલ્લી",
  );
  const [footerNote, setFooterNote] = useState(settings.printFooterNote || "");

  // Options
  const [defaultVehicle, setDefaultVehicle] = useState<"private" | "government">(
    settings.printDefaultVehicle || "private",
  );
  const [useGujaratiDigits, setUseGujaratiDigits] = useState<boolean>(
    settings.printUseGujaratiDigits ?? true,
  );

  // Preview tab: "gu" for Gujarati letterhead, "en" for English letterhead
  const [previewTab, setPreviewTab] = useState<"gu" | "en">("gu");

  // Load any previously saved client-side configuration from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("duty_print_config");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.headerLine1 !== undefined) setHeaderLine1(saved.headerLine1);
        if (saved.headerLine2 !== undefined) setHeaderLine2(saved.headerLine2);
        if (saved.headerLine1En !== undefined) setHeaderLine1En(saved.headerLine1En);
        if (saved.headerLine2En !== undefined) setHeaderLine2En(saved.headerLine2En);
        if (saved.recipientTitle !== undefined) setRecipientTitle(saved.recipientTitle);
        if (saved.stationName !== undefined) setStationName(saved.stationName);
        if (saved.signatoryName !== undefined) setSignatoryName(saved.signatoryName);
        if (saved.footerPlace !== undefined) setFooterPlace(saved.footerPlace);
        if (saved.footerNote !== undefined) setFooterNote(saved.footerNote);
        if (saved.defaultVehicle !== undefined) setDefaultVehicle(saved.defaultVehicle);
        if (saved.useGujaratiDigits !== undefined) setUseGujaratiDigits(saved.useGujaratiDigits);
      }
    } catch { }
  }, []);

  const handleResetDefaults = () => {
    const defaultH1 = "ગુજરાત પોલીસ (GUJARAT POLICE)";
    const defaultH2 = officerPosting || "QRT અરવલ્લી પોલીસ";
    const defaultH1En = "Gujarat Police";
    const defaultH2En = "Duty & Roster Records";
    const defaultRec = "પોલીસ સબ ઇન્સપેક્ટરશ્રી";
    const defaultSta = officerPosting || "QRT અરવલ્લી પોલીસ";
    const defaultSig = `${gujOfficerName}${gujOfficerPost ? `, ${gujOfficerPost}` : ""}${gujBuckleNo ? ` બ.નં. ${gujBuckleNo}` : ""}`;
    const defaultPlace = (officerPosting?.split(",")[0] ?? "") || "અરવલ્લી";
    const defaultNote = "";

    setHeaderLine1(defaultH1);
    setHeaderLine2(defaultH2);
    setHeaderLine1En(defaultH1En);
    setHeaderLine2En(defaultH2En);
    setRecipientTitle(defaultRec);
    setStationName(defaultSta);
    setSignatoryName(defaultSig);
    setFooterPlace(defaultPlace);
    setFooterNote(defaultNote);
    setDefaultVehicle("private");
    setUseGujaratiDigits(true);

    try {
      localStorage.setItem(
        "duty_print_config",
        JSON.stringify({
          headerLine1: defaultH1,
          headerLine2: defaultH2,
          headerLine1En: defaultH1En,
          headerLine2En: defaultH2En,
          recipientTitle: defaultRec,
          stationName: defaultSta,
          signatoryName: defaultSig,
          footerPlace: defaultPlace,
          footerNote: defaultNote,
          defaultVehicle: "private",
          useGujaratiDigits: true,
        }),
      );
    } catch { }

    toast("પ્રિન્ટ સેટિંગ્સ મૂળ સ્થિતિમાં રીસેટ થઈ ગયા (Reset to defaults)");
  };

  const handleSave = () => {
    startTransition(async () => {
      const h1 = headerLine1.trim();
      const h2 = headerLine2.trim();
      const h1En = headerLine1En.trim();
      const h2En = headerLine2En.trim();
      const rec = recipientTitle.trim();
      const sta = stationName.trim();
      const sig = signatoryName.trim();
      const place = footerPlace.trim();
      const note = footerNote.trim();

      const formData = new FormData();
      formData.append("holidayDayRate", String(settings.holidayDayRate));
      formData.append("defaultShiftStart", settings.defaultShiftStart);
      formData.append("defaultShiftEnd", settings.defaultShiftEnd);
      formData.append("printRecipientTitle", rec);
      // Save configured station/office (fallback to headerLine2 if empty)
      formData.append("printStationName", sta || h2);
      formData.append("printSignatoryName", sig);
      formData.append("printDefaultVehicle", defaultVehicle);
      formData.append("printUseGujaratiDigits", useGujaratiDigits ? "true" : "false");

      // Persist all fields into localStorage so client report views and print modals receive them immediately
      try {
        localStorage.setItem(
          "duty_print_config",
          JSON.stringify({
            headerLine1: h1,
            headerLine2: h2,
            headerLine1En: h1En,
            headerLine2En: h2En,
            recipientTitle: rec,
            stationName: sta || h2,
            signatoryName: sig,
            footerPlace: place,
            footerNote: note,
            defaultVehicle,
            useGujaratiDigits,
          }),
        );
      } catch { }

      const res = await updateUserSettings(undefined, formData);
      if (res?.ok) {
        toast("પ્રિન્ટ હેડર અને ફૂટર કન્ફિગરેશન સેવ થઈ ગયું. (Print configuration saved)");
      } else {
        toast(res?.message || "Failed to save configuration", "error");
      }
    });
  };

  const handlePrintDemo = () => {
    // Open a print window demo of the configured letterhead
    const printWindow = window.open("", "_blank", "width=850,height=900");
    if (!printWindow) {
      toast("પોપઅપ બ્લોક થયેલ છે. કૃપા કરીને બ્રાઉઝરમાં પોપઅપ મંજૂર કરો.", "error");
      return;
    }

    const numFn = (s: string) =>
      useGujaratiDigits ? s.replace(/\d/g, (d) => "૦૧૨૩૪૫૬૭૮૯"[Number(d)]) : s;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>પ્રિન્ટ ટેમ્પલેટ ડેમો - ${headerLine1}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }
          body { font-family: system-ui, -apple-system, sans-serif; color: #000; margin: 0; padding: 20px; font-size: 12px; line-height: 1.5; }
          .header-row { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
          .logo { width: 64px; height: 64px; object-fit: contain; }
          .titles { text-align: center; flex: 1; margin: 0 16px; }
          .title-main { font-size: 18px; font-weight: bold; letter-spacing: 0.5px; margin: 0; }
          .title-sub { font-size: 13px; font-weight: 600; color: #222; margin: 4px 0 0 0; }
          .period-box { text-align: right; font-size: 11px; }
          .period-box strong { font-size: 13px; display: block; }
          .to-block { margin-bottom: 12px; font-size: 12px; }
          .subject { font-weight: bold; margin-bottom: 10px; font-size: 12px; }
          .salutation { margin-bottom: 12px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
          th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
          th { background: #f3f4f6; font-weight: bold; text-align: center; }
          .footer-row { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 12px; page-break-inside: avoid; }
          .sig-box { text-align: right; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        ${previewTab === "gu"
        ? `
          <div class="header-row">
            <img src="/Gujarat-police.png" class="logo" alt="Gujarat Police" />
            <div class="titles">
              <h1 class="title-main">${headerLine1}</h1>
              <p class="title-sub">${headerLine2}</p>
            </div>
            <div class="period-box">
              <span>રિપોર્ટ માસ:</span>
              <strong>${numFn("05/2026")}</strong>
            </div>
          </div>

          <div class="to-block">
            <p style="font-weight: bold; margin: 0;">પ્રતિ,</p>
            <p style="margin: 2px 0; font-weight: 600;">${recipientTitle}</p>
            <p style="margin: 0; color: #333;">${stationName}</p>
          </div>

          <div class="subject">
            વિષય: માહે- ${numFn("05/2026")} નું મુસાફરી ભથ્થાબીલ રજૂ કરવા બાબત.
          </div>

          <div class="salutation">
            <p style="margin: 0; font-weight: 600;">મહેરબાન સાહેબ,</p>
            <p style="margin: 4px 0 0 0; text-indent: 20px;">
              સવિનય જણાવવાનું કે હું નીચે સહી કરનાર ${signatoryName} માહે ${numFn("05/2026")} દરમિયાન કરેલ મુસાફરી ભથ્થાની વિગત નીચે મુજબ છે:
            </p>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35px;">અ.નં.</th>
                <th>મુસાફરી શરૂ તા.ટા.</th>
                <th>ક્યાંથી ક્યાં સુધી</th>
                <th>કારણ</th>
                <th style="width: 50px;">સ.વા./ખ.વા.</th>
                <th style="width: 50px; text-align: right;">કિ.મી.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align: center; font-weight: bold;">${numFn("1")}</td>
                <td>${numFn("12/05/2026 10:00")}</td>
                <td>મુખ્ય મથક &rarr; સેક્ટર ૨૫</td>
                <td>ઓફિસ વર્ક / બંદોબસ્ત</td>
                <td style="text-align: center;">${defaultVehicle === "private" ? "ખ.વા." : "સ.વા."}</td>
                <td style="text-align: right; font-weight: bold;">${numFn("25")}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer-row">
            <div>
              <p style="margin: 0;">તારીખ: ${numFn("31/05/2026")}</p>
              <p style="margin: 2px 0 0 0;">સ્થળ: ${footerPlace}</p>
              ${footerNote ? `<p style="margin: 4px 0 0 0; font-size: 10px; color: #555;">${footerNote}</p>` : ""}
            </div>
            <div class="sig-box">
              <p style="margin: 0; font-weight: bold;">લિ. સહી</p>
              <p style="margin: 2px 0 0 0; font-weight: bold;">${useGujaratiDigits ? toGujaratiNumerals(signatoryName) : signatoryName}</p>
            </div>
          </div>
        `
        : `
          <div class="header-row">
            <img src="/Gujarat-police.png" class="logo" alt="Gujarat Police" />
            <div class="titles">
              <h1 class="title-main">${headerLine1En}</h1>
              <p class="title-sub">${headerLine2En}</p>
            </div>
            <div class="period-box">
              <span>Report Period:</span>
              <strong>May 2026</strong>
            </div>
          </div>

          <div class="to-block">
            <p style="font-weight: bold; margin: 0;">To,</p>
            <p style="margin: 2px 0; font-weight: 600;">${recipientTitle}</p>
            <p style="margin: 0; color: #333;">${stationName}</p>
          </div>

          <div class="subject">
            Subject: Official Duty & Travelling Allowance Record (May 2026)
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35px;">#</th>
                <th>Date & Time</th>
                <th>Route</th>
                <th>Duty Details</th>
                <th style="width: 60px;">Vehicle</th>
                <th style="width: 60px; text-align: right;">Distance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align: center;">1</td>
                <td>12/05/2026 10:00</td>
                <td>Headquarters &rarr; Sector 25</td>
                <td>Special Bandobast / VIP Escort</td>
                <td style="text-align: center;">${defaultVehicle === "private" ? "Private" : "Govt"}</td>
                <td style="text-align: right; font-weight: bold;">25 km</td>
              </tr>
            </tbody>
          </table>

          <div class="footer-row">
            <div>
              <p style="margin: 0;">Date: 31/05/2026</p>
              <p style="margin: 2px 0 0 0;">Place: ${footerPlace}</p>
              ${footerNote ? `<p style="margin: 4px 0 0 0; font-size: 10px; color: #555;">${footerNote}</p>` : ""}
            </div>
            <div class="sig-box">
              <p style="margin: 0; font-weight: bold;">Signature</p>
              <p style="margin: 2px 0 0 0; font-weight: bold;">${signatoryName}</p>
            </div>
          </div>
        `
      }
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Main Actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div>
          <h2 className="text-base font-bold text-foreground sm:text-lg flex items-center gap-2">
            <Printer className="size-5 text-indigo-600 dark:text-indigo-400" />
            <span>રિપોર્ટ અને પ્રિન્ટ લેટરહેડ કન્ફિગરેશન (Print Template Configuration)</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            ગુજરાત પોલીસ સત્તાવાર લેટરહેડનું હેડર, ફૂટર, પ્રતિ અને સહીની વિગતો સંપાદિત (Edit) કરો. માત્ર લોગો ફિક્સ રહેશે.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            title="મૂળ સ્થિતિમાં રીસેટ કરો"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">રીસેટ (Reset)</span>
          </button>
          <button
            type="button"
            onClick={handlePrintDemo}
            title="પ્રિન્ટ ડેમો જુઓ"
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors cursor-pointer"
          >
            <Printer className="size-3.5" />
            <span>પ્રિન્ટ ડેમો (Test Print)</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-all hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (
              <span>સાચવી રહ્યા છીએ...</span>
            ) : (
              <>
                <Check className="size-4" />
                <span>સેવ કરો (Save Config)</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Column: Form Fields (7 cols) */}
        <div className="xl:col-span-6 space-y-5">
          {/* Section 1: Official Header */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Shield className="size-3.5 text-indigo-500" />
                <span>૧. લેટરહેડ હેડર વિગતો (Official Header)</span>
              </h3>
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                લોગો કાયમી (Logo Fixed)
              </span>
            </div>

            {/* Logo note block */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Gujarat-police.png"
                alt="Gujarat Police Logo"
                className="size-12 object-contain shrink-0 rounded-lg bg-white p-1 border border-slate-200"
              />
              <div className="min-w-0 flex-1 text-xs">
                <p className="font-bold text-foreground">ગુજરાત પોલીસ સત્તાવાર લોગો (Fixed)</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  આ લોગો લેટરહેડમાં ડાબી બાજુ ફિક્સ રહેશે. જમણી બાજુનું તમામ લખાણ નીચેથી બદલી શકાય છે.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  મુખ્ય મથાળું (Main Header Line 1 - Gujarati)
                </label>
                <input
                  type="text"
                  value={headerLine1}
                  onChange={(e) => setHeaderLine1(e.target.value)}
                  placeholder="ગુજરાત પોલીસ (GUJARAT POLICE)"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm font-semibold text-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  દા.ત. ગુજરાત પોલીસ (GUJARAT POLICE)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  પેટા મથાળું / એકમ / શાખા (Sub Header Line 2 - Gujarati)
                </label>
                <input
                  type="text"
                  value={headerLine2}
                  onChange={(e) => setHeaderLine2(e.target.value)}
                  placeholder="દા.ત. QRT અરવલ્લી પોલીસ અથવા વરાછા પોલીસ સ્ટેશન, સુરત"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm font-medium text-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  દા.ત. QRT અરવલ્લી પોલીસ (અથવા તમારી કચેરી/એકમનું નામ)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    અંગ્રેજી મુખ્ય સંસ્થા (English Header Line 1)
                  </label>
                  <input
                    type="text"
                    value={headerLine1En}
                    onChange={(e) => setHeaderLine1En(e.target.value)}
                    placeholder="Gujarat Police"
                    className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    અંગ્રેજી પેટા મથાળું (English Header Line 2)
                  </label>
                  <input
                    type="text"
                    value={headerLine2En}
                    onChange={(e) => setHeaderLine2En(e.target.value)}
                    placeholder="Duty & Roster Records"
                    className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Recipient Authority & Station */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-2 border-b border-border/60">
              <Building className="size-3.5 text-indigo-500" />
              <span>૨. પ્રતિ અને કચેરીનું સરનામું (Addressee & Office)</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                પ્રતિ (સત્તાધિકારીનો હોદ્દો / Recipient Authority)
              </label>
              <input
                type="text"
                value={recipientTitle}
                onChange={(e) => setRecipientTitle(e.target.value)}
                placeholder="દા.ત. પોલીસ સબ ઇન્સપેક્ટરશ્રી અથવા પો.ઇ.સા.શ્રી"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium sm:text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                દા.ત. પોલીસ સબ ઇન્સપેક્ટરશ્રી અથવા પો.ઇ.સા.શ્રી
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                પોલીસ સ્ટેશન / શાખા / કચેરી (Station / Branch / Office)
              </label>
              <input
                type="text"
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                placeholder="દા.ત. QRT અરવલ્લી પોલીસ અથવા વરાછા પોલીસ સ્ટેશન, સુરત શહેર"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium sm:text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Section 3: Signatory & Footer */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-2 border-b border-border/60">
              <User className="size-3.5 text-indigo-500" />
              <span>૩. સહી અને ફૂટર વિગતો (Signatory & Footer)</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                લિ. સહી વિગત (Signatory Name, Post & Badge No.)
              </label>
              <input
                type="text"
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
                placeholder="દા.ત. કિરપાલસિંહ દિલીપસિંહ, પો.હે.કો. બ.નં. ૧૬"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium sm:text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  સ્થળ (Footer Place / City / District)
                </label>
                <input
                  type="text"
                  value={footerPlace}
                  onChange={(e) => setFooterPlace(e.target.value)}
                  placeholder="દા.ત. અરવલ્લી અથવા સુરત"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  વધારાની ફૂટર નોંધ (Optional Footer Remark)
                </label>
                <input
                  type="text"
                  value={footerNote}
                  onChange={(e) => setFooterNote(e.target.value)}
                  placeholder="દા.ત. સત્તાવાર ઉપયોગ માટે"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Vehicle & Numerals */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-2 border-b border-border/60">
              <Car className="size-3.5 text-indigo-500" />
              <span>૪. વાહન અને આંકડાકીય પસંદગી (Vehicle & Numerals)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  ડિફોલ્ટ વાહન પ્રકાર (Default Vehicle)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDefaultVehicle("private")}
                    className={`flex items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${defaultVehicle === "private"
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                  >
                    <span>ખાનગી (ખ.વા.)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefaultVehicle("government")}
                    className={`flex items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${defaultVehicle === "government"
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                  >
                    <span>સરકારી (સ.વા.)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  અંકોનું સ્વરૂપ (Numerals)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUseGujaratiDigits(true);
                      setSignatoryName((prev) => toGujaratiNumerals(prev));
                    }}
                    className={`flex items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${useGujaratiDigits
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                  >
                    <span>ગુજરાતી (૧, ૨, ૩)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUseGujaratiDigits(false);
                      setSignatoryName((prev) => toAsciiNumerals(prev));
                    }}
                    className={`flex items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${!useGujaratiDigits
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                  >
                    <span>અંગ્રેજી (1, 2, 3)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Preview (5 cols) */}
        <div className="xl:col-span-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted border border-border/60">
              <button
                type="button"
                onClick={() => setPreviewTab("gu")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${previewTab === "gu"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <span>🇬🇺 ગુજરાતી લેટરહેડ</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("en")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${previewTab === "en"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <span>🇬🇧 અંગ્રેજી લેટરહેડ</span>
              </button>
            </div>

            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <CheckCircle2 className="size-3.5" /> લાઈવ પ્રિવ્યુ
            </span>
          </div>

          {/* Letterhead Preview Canvas */}
          <div className="rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-white p-5 sm:p-7 text-slate-900 shadow-lg font-sans text-xs leading-relaxed">
            {previewTab === "gu" ? (
              /* Gujarati Official Letterhead Preview */
              <div className="space-y-3">
                {/* Official Gujarat Police Header matching user specification */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/Gujarat-police.png"
                    alt="Gujarat Police"
                    className="h-16 w-16 object-contain shrink-0"
                  />
                  <div className="text-center flex-1 mx-3">
                    <h2 className="text-base sm:text-lg font-bold tracking-wide text-slate-900">
                      {headerLine1 || "ગુજરાત પોલીસ (GUJARAT POLICE)"}
                    </h2>
                    <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-0.5">
                      {headerLine2 || stationName || "QRT અરવલ્લી પોલીસ"}
                    </p>
                  </div>
                  <div className="text-right text-[11px] shrink-0">
                    <span className="block text-slate-500">રિપોર્ટ માસ:</span>
                    <strong className="text-xs font-bold text-slate-800">
                      {useGujaratiDigits ? "૦૫/૨૦૨૬" : "05/2026"}
                    </strong>
                  </div>
                </div>

                {/* To block */}
                <div className="space-y-0.5 border-b border-slate-200 pb-2.5 text-[11px]">
                  <p className="font-bold text-slate-900">પ્રતિ,</p>
                  <p className="font-semibold text-indigo-950">{recipientTitle}</p>
                  <p className="text-slate-700">{stationName}</p>
                </div>

                {/* Subject */}
                <div className="py-1 font-bold text-slate-900 border-b border-slate-100 text-[11px]">
                  <span>
                    વિષય: માહે- {useGujaratiDigits ? "૦૫/૨૦૨૬" : "05/2026"} નું મુસાફરી ભથ્થાબીલ રજૂ કરવા બાબત.
                  </span>
                </div>

                {/* Salutation */}
                <div className="py-1 text-[11px] text-slate-700">
                  <p className="font-semibold text-slate-900">મહેરબાન સાહેબ,</p>
                  <p className="indent-4 mt-0.5">
                    સવિનય જણાવવાનું કે હું નીચે સહી કરનાર {signatoryName} માહે{" "}
                    {useGujaratiDigits ? "૦૫/૨૦૨૬" : "05/2026"} દરમિયાન કરેલ મુસાફરી ભથ્થાની વિગત નીચે મુજબ છે:
                  </p>
                </div>

                {/* Table Preview */}
                <div className="overflow-x-auto my-2 border border-slate-300 rounded-sm">
                  <table className="w-full text-[10px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                        <th className="p-1 border-r border-slate-300 text-center w-8">અ.નં.</th>
                        <th className="p-1 border-r border-slate-300">મુસાફરી શરૂ તા.ટા.</th>
                        <th className="p-1 border-r border-slate-300">ક્યાંથી ક્યાં સુધી</th>
                        <th className="p-1 border-r border-slate-300">કારણ</th>
                        <th className="p-1 border-r border-slate-300 text-center">વાહન</th>
                        <th className="p-1 text-right">કિ.મી.</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700 divide-y divide-slate-200">
                      <tr>
                        <td className="p-1 text-center font-bold">{useGujaratiDigits ? "૧" : "1"}</td>
                        <td className="p-1">
                          {useGujaratiDigits ? "૧૨/૦૫/૨૦૨૬ ૧૦:૦૦" : "12/05/2026 10:00"}
                        </td>
                        <td className="p-1 font-medium">મુખ્ય મથક &rarr; સેક્ટર ૨૫</td>
                        <td className="p-1">બંદોબસ્ત / પેટ્રોલીંગ</td>
                        <td className="p-1 text-center font-semibold text-amber-700">
                          {defaultVehicle === "private" ? "ખ.વા." : "સ.વા."}
                        </td>
                        <td className="p-1 text-right font-bold text-slate-900">
                          {useGujaratiDigits ? "૨૫" : "25"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer Signature */}
                <div className="mt-5 pt-3 border-t border-slate-200 flex justify-between items-end text-[11px]">
                  <div className="space-y-0.5">
                    <p className="text-slate-600">
                      તારીખ: {useGujaratiDigits ? "૩૧/૦૫/૨૦૨૬" : "31/05/2026"}
                    </p>
                    <p className="text-slate-600 font-medium">
                      સ્થળ: {footerPlace || "અરવલ્લી"}
                    </p>
                    {footerNote && (
                      <p className="text-[10px] text-slate-500 italic mt-1">{footerNote}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">લિ. સહી</p>
                    <p className="font-semibold text-slate-800 pt-0.5">{signatoryName}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* English Official Letterhead Preview */
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/Gujarat-police.png"
                    alt="Gujarat Police"
                    className="h-16 w-16 object-contain shrink-0"
                  />
                  <div className="text-center flex-1 mx-3">
                    <h2 className="text-base sm:text-lg font-bold tracking-wide text-slate-900">
                      {headerLine1En || "Gujarat Police"}
                    </h2>
                    <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-0.5">
                      {headerLine2En || "Duty & Roster Records"}
                    </p>
                  </div>
                  <div className="text-right text-[11px] shrink-0">
                    <span className="block text-slate-500">Report Period:</span>
                    <strong className="text-xs font-bold text-slate-800">May 2026</strong>
                  </div>
                </div>

                <div className="space-y-0.5 border-b border-slate-200 pb-2.5 text-[11px]">
                  <p className="font-bold text-slate-900">To,</p>
                  <p className="font-semibold text-indigo-950">{recipientTitle}</p>
                  <p className="text-slate-700">{stationName}</p>
                </div>

                <div className="py-1 font-bold text-slate-900 border-b border-slate-100 text-[11px]">
                  Subject: Monthly Official Duty &amp; Travel Allowance Claim (May 2026)
                </div>

                <div className="overflow-x-auto my-2 border border-slate-300 rounded-sm">
                  <table className="w-full text-[10px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                        <th className="p-1 border-r border-slate-300 text-center w-8">#</th>
                        <th className="p-1 border-r border-slate-300">Date &amp; Time</th>
                        <th className="p-1 border-r border-slate-300">Route</th>
                        <th className="p-1 border-r border-slate-300">Purpose</th>
                        <th className="p-1 border-r border-slate-300 text-center">Vehicle</th>
                        <th className="p-1 text-right">Distance</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700 divide-y divide-slate-200">
                      <tr>
                        <td className="p-1 text-center font-bold">1</td>
                        <td className="p-1">12/05/2026 10:00</td>
                        <td className="p-1 font-medium">Headquarters &rarr; Sector 25</td>
                        <td className="p-1">Bandobast / Patrol</td>
                        <td className="p-1 text-center font-semibold text-amber-700">
                          {defaultVehicle === "private" ? "Private" : "Govt"}
                        </td>
                        <td className="p-1 text-right font-bold text-slate-900">25 km</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-200 flex justify-between items-end text-[11px]">
                  <div className="space-y-0.5">
                    <p className="text-slate-600">Date: 31/05/2026</p>
                    <p className="text-slate-600 font-medium">
                      Place: {footerPlace || "Aravalli"}
                    </p>
                    {footerNote && (
                      <p className="text-[10px] text-slate-500 italic mt-1">{footerNote}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">Signature</p>
                    <p className="font-semibold text-slate-800 pt-0.5">{signatoryName}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
