import "server-only";

/*
 * GetOut Operations → PostNord
 *
 * Bokar försändelser med PostNords Booking API (EDI-instruktion) och hämtar etiketter.
 * Allt skickas som PostNord Home Small Prio (tjänstekod 86, Sverige = Z12).
 *
 * Miljövariabler (Vercel):
 *   POSTNORD_API_KEY          – nyckeln från developer.postnord.com
 *   POSTNORD_CUSTOMER_NUMBER  – kundnumret (20991222)
 *   POSTNORD_SENDER_ADDRESS   – avsändaradress, t.ex. "Storgatan 1, 211 22 Malmö"
 *   POSTNORD_SENDER_NAME      – valfritt, standard "GO now AB"
 *   POSTNORD_PAPER_SIZE       – valfritt etikettformat (A4, A5, A6, LABEL), standard A4
 *   POSTNORD_APPLICATION_ID   – valfritt, standard 2758 (vårt applikations-ID från PostNord)
 *   POSTNORD_BOOKING          – "on" när testbokningen har kontrollerats. Innan dess bokas
 *                               inga riktiga försändelser, bara testetiketter (se testLabel).
 */

// Testmiljö: POSTNORD_BASE_URL=https://atapi2.postnord.com (med testnyckel)
const BASE = process.env.POSTNORD_BASE_URL?.trim() || "https://api2.postnord.com";
const SERVICE_CODE = "86"; // Home Small Prio
const ISSUER = "Z12"; // PostNord Sverige
const MAX_KG = 3;
// Etikettformat: A4, A5, A6, LABEL … (standard A4 = vanligt skrivarpapper)
const paperSize = () => process.env.POSTNORD_PAPER_SIZE?.trim().toUpperCase() || "A4";
const DEFAULT_KG = 0.25;
// Applikations-ID som PostNord tilldelat GetOut Operations (krävs för Booking API)
const applicationId = () => parseInt(process.env.POSTNORD_APPLICATION_ID?.trim() || "2758", 10);

/** Saknas något som behövs för att prata med PostNord alls (även testbokning)? */
export function postnordConfigProblem(): string | null {
  if (!process.env.POSTNORD_API_KEY) return "POSTNORD_API_KEY saknas i Vercel";
  if (!process.env.POSTNORD_CUSTOMER_NUMBER) return "POSTNORD_CUSTOMER_NUMBER saknas i Vercel";
  if (!process.env.POSTNORD_SENDER_ADDRESS) return "POSTNORD_SENDER_ADDRESS saknas i Vercel";
  return null;
}

export function isPostnordBookingEnabled() {
  return (
    process.env.POSTNORD_BOOKING === "on" &&
    Boolean(process.env.POSTNORD_API_KEY && process.env.POSTNORD_CUSTOMER_NUMBER && process.env.POSTNORD_SENDER_ADDRESS)
  );
}

export function postnordBookingStatus(): string | null {
  const problem = postnordConfigProblem();
  if (problem) return problem;
  if (process.env.POSTNORD_BOOKING !== "on") {
    return "Bokning slås på när testetiketten är kontrollerad (Inställningar → PostNord)";
  }
  return null;
}

/** "Storgatan 1, 211 22 Malmö" → { street, postalCode, city } */
function senderAddress() {
  const raw = (process.env.POSTNORD_SENDER_ADDRESS ?? "").trim();
  const m = raw.match(/^(.+?),\s*(\d{3})\s?(\d{2})\s+(.+)$/);
  if (!m) throw new Error('POSTNORD_SENDER_ADDRESS ska se ut som "Gatan 1, 123 45 Orten"');
  return { street: m[1].trim(), postalCode: `${m[2]}${m[3]}`, city: m[4].trim() };
}

const clean = (v: string | null | undefined) => (v ?? "").trim();

export type BookingOrder = {
  orderRef: string; // GO-1016
  shopifyName: string | null; // #1197
  name: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  email: string | null;
  phone: string | null;
  weightGrams: number | null;
};

export type BookingResult = { trackingNumber: string; bookingId: string | null; labelPdf: Buffer | null };

function bookingBody(o: BookingOrder, test: boolean) {
  const sender = senderAddress();
  const kg = Math.max(0.01, o.weightGrams ? o.weightGrams / 1000 : DEFAULT_KG);
  const weight = { value: Math.round(kg * 1000) / 1000, unit: "KGM" };
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const reference = [o.orderRef, o.shopifyName].filter(Boolean).join(" ");

  return {
    messageDate: now,
    messageFunction: "Instruction",
    messageId: `${o.orderRef}-${Date.now()}`,
    application: { applicationId: applicationId(), name: "GetOut Operations", version: "1.0" },
    // "Test" = testbokning enligt PostNord: etikett skapas men inget skickas på riktigt
    updateIndicator: test ? "Test" : "Original",
    shipment: [
      {
        shipmentIdentification: { shipmentId: "0" },
        dateAndTimes: { loadingDate: now },
        service: { basicServiceCode: SERVICE_CODE },
        numberOfPackages: { value: 1 },
        totalGrossWeight: weight,
        references: [{ referenceNo: reference.slice(0, 35), referenceType: "CU" }],
        parties: {
          consignor: {
            issuerCode: ISSUER,
            partyIdentification: { partyId: process.env.POSTNORD_CUSTOMER_NUMBER, partyIdType: "160" },
            party: {
              nameIdentification: { name: process.env.POSTNORD_SENDER_NAME?.trim() || "GO now AB" },
              address: {
                streets: [sender.street],
                postalCode: sender.postalCode,
                city: sender.city,
                countryCode: "SE",
              },
            },
          },
          consignee: {
            party: {
              nameIdentification: { name: o.name },
              address: {
                streets: [o.address],
                postalCode: o.postalCode.replace(/\s/g, ""),
                city: o.city,
                countryCode: o.country,
              },
              contact: {
                contactName: o.name,
                ...(o.email ? { emailAddress: o.email } : {}),
                ...(o.phone ? { phoneNo: o.phone, smsNo: o.phone } : {}),
              },
            },
          },
        },
        goodsItem: [
          {
            packageTypeCode: "PC",
            items: [
              {
                itemIdentification: { itemId: "0" }, // 0 = PostNord skapar kolli-ID
                grossWeight: weight,
              },
            ],
          },
        ],
      },
    ],
  };
}

type Fault = { explanationText?: string; faultCode?: string };
type BookingResponse = {
  bookingResponse?: {
    bookingId?: string;
    idInformation?: {
      status?: string;
      ids?: { idType?: string; value?: string }[];
      errorResponse?: { message?: string; compositeFault?: { faults?: Fault[] } };
    }[];
  };
  handlingResponse?: { message?: string; compositeFault?: { faults?: Fault[] } };
  labelPrintout?: { printout?: { data?: string; dataValue?: string } }[];
  message?: string;
};

function faultText(r: { message?: string; compositeFault?: { faults?: Fault[] } } | undefined) {
  const faults = r?.compositeFault?.faults?.map((f) => f.explanationText ?? f.faultCode).filter(Boolean) ?? [];
  return [r?.message, ...faults].filter(Boolean).join("; ");
}

/**
 * Bokar en försändelse hos PostNord och returnerar kolli-ID (spårningsnumret) och etiketten.
 * Med test: true görs en testbokning (updateIndicator "Test"), som fungerar innan bokning slagits på.
 */
export async function bookShipment(o: BookingOrder, opts: { test?: boolean } = {}): Promise<BookingResult> {
  const test = opts.test === true;
  if (test) {
    const problem = postnordConfigProblem();
    if (problem) throw new Error(problem);
  } else if (!isPostnordBookingEnabled()) {
    throw new Error(postnordBookingStatus() ?? "Bokning är inte påslagen");
  }
  for (const [label, v] of [
    ["namn", o.name],
    ["adress", o.address],
    ["postnummer", o.postalCode],
    ["ort", o.city],
  ] as const) {
    if (!clean(v)) throw new Error(`${o.orderRef}: mottagarens ${label} saknas`);
  }

  if (o.weightGrams && o.weightGrams > MAX_KG * 1000) {
    throw new Error(`${o.orderRef}: ${o.weightGrams / 1000} kg är för tungt för Home Small (max ${MAX_KG} kg)`);
  }

  // Etiketten skapas också, men vi hämtar den separat när den ska skrivas ut
  const url = new URL("/rest/shipment/v3/edi/labels/pdf", BASE);
  url.searchParams.set("apikey", process.env.POSTNORD_API_KEY!);
  url.searchParams.set("paperSize", paperSize());

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(bookingBody(o, test)),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as BookingResponse;
  const info = json.bookingResponse?.idInformation?.[0];
  const errorText = faultText(info?.errorResponse) || faultText(json.handlingResponse) || json.message;

  if (!res.ok) throw new Error(`PostNord (${res.status}): ${errorText || "okänt fel"}`);

  const ids = info?.ids ?? [];
  const item = ids.find((i) => /item/i.test(i.idType ?? "")) ?? ids[0];
  if (!item?.value) throw new Error(`PostNord gav inget kolli-ID${errorText ? `: ${errorText}` : ""}`);
  const label = json.labelPrintout?.map((l) => l.printout?.data ?? l.printout?.dataValue).find(Boolean);
  return {
    trackingNumber: item.value,
    bookingId: json.bookingResponse?.bookingId ?? null,
    labelPdf: label ? Buffer.from(label, "base64") : null,
  };
}

/** Testbokning till oss själva (avsändaradressen), enligt PostNords råd. Ger etiketten som PDF. */
export async function testLabel(): Promise<BookingResult> {
  const problem = postnordConfigProblem();
  if (problem) throw new Error(problem);
  const sender = senderAddress();
  const name = process.env.POSTNORD_SENDER_NAME?.trim() || "GO now AB";
  return bookShipment(
    {
      orderRef: "TEST",
      shopifyName: null,
      name,
      address: sender.street,
      postalCode: sender.postalCode,
      city: sender.city,
      country: "SE",
      email: null,
      phone: null,
      weightGrams: 120,
    },
    { test: true },
  );
}

/** PDF med etiketter för ett eller flera kolli-ID */
export async function fetchLabels(trackingNumbers: string[]): Promise<Buffer> {
  if (!process.env.POSTNORD_API_KEY) throw new Error("POSTNORD_API_KEY saknas i Vercel");
  const url = new URL("/rest/shipment/v3/labels/ids/pdf", BASE);
  url.searchParams.set("apikey", process.env.POSTNORD_API_KEY);
  url.searchParams.set("paperSize", paperSize());
  url.searchParams.set("multiPDF", "false");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(trackingNumbers.map((id) => ({ id }))),
    cache: "no-store",
  });
  type Printout = { printout?: { data?: string; dataValue?: string } };
  const json = (await res.json().catch(() => null)) as Printout[] | { labelPrintout?: Printout[] } | null;
  if (!res.ok) throw new Error(`PostNord kunde inte skapa etiketterna (${res.status})`);

  const list = Array.isArray(json) ? json : (json?.labelPrintout ?? []);
  const data = list.map((l) => l.printout?.data ?? l.printout?.dataValue).find(Boolean);
  if (!data) throw new Error("PostNord skickade ingen etikett");
  return Buffer.from(data, "base64");
}
