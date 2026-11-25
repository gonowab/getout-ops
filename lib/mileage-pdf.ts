import { breakTextIntoLines, PageSizes, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { formatExpenseAmount } from "./expenses";
import { mileageRateOrePerKm, mileageTripKinds, type MileageTripKind } from "./mileage";

export type MileagePdfTrip = {
  travel_date: string;
  driver: string;
  purpose: string;
  origin: string;
  destination: string;
  trip_kind: MileageTripKind | null;
  distance_tenths: number;
  mileage_ore: number;
};

const kilometers = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });
const rate = mileageRateOrePerKm / 10;
const margin = 45;
const [width, height] = PageSizes.A4;
const contentWidth = width - margin * 2;
const ink = rgb(0.10, 0.13, 0.12);
const muted = rgb(0.31, 0.35, 0.33);
const border = rgb(0.82, 0.85, 0.83);

export async function createMileagePdf(trips: MileagePdfTrip[], generatedAt: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Milersättningsunderlag");
  pdf.setAuthor("GetOut Operations");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const characters = new Set(regular.getCharacterSet());
  const safe = (value: string) => Array.from(value.normalize("NFC").replace(/\s+/g, " "), (character) =>
    characters.has(character.codePointAt(0)!) ? character : "?").join("");

  let page = pdf.addPage(PageSizes.A4);
  let y = height - margin;
  function write(text: string, options: { size?: number; strong?: boolean; x?: number } = {}) {
    page.drawText(safe(text), { x: options.x ?? margin, y, size: options.size ?? 11, font: options.strong ? bold : regular, color: ink });
  }
  function heading() {
    write("Milersättningsunderlag", { size: 24, strong: true });
    y -= 24;
    write(`GO now AB  ·  Skapat ${generatedAt}  ·  ${trips.length} resor`, { size: 10 });
    y -= 26;
  }
  function newPage() {
    page = pdf.addPage(PageSizes.A4);
    y = height - margin;
    heading();
  }

  heading();
  for (const trip of trips) {
    const fieldLines = [`Syfte: ${trip.purpose}`, `Start: ${trip.origin}`, `Mål: ${trip.destination}`].flatMap((field) => {
      const measure = (text: string) => regular.widthOfTextAtSize(text, 11);
      return breakTextIntoLines(safe(field), [" "], contentWidth, measure)
        .flatMap((line) => measure(line) <= contentWidth ? [line] : breakTextIntoLines(line, [""], contentWidth, measure));
    });
    if (y - (56 + fieldLines.length * 15) < margin) newPage();
    page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: width - margin, y: y + 8 }, thickness: 0.65, color: border });
    y -= 9;
    write(`${trip.travel_date}  ·  ${trip.driver}`, { size: 12, strong: true });
    y -= 19;
    for (const line of fieldLines) {
      write(line);
      y -= 15;
    }
    const kind = trip.trip_kind ? mileageTripKinds[trip.trip_kind] : "Typ av resa ej registrerad";
    write(`${kind}  ·  ${kilometers.format(trip.distance_tenths / 10)} km  ·  ${rate} kr/mil  ·  ${formatExpenseAmount(trip.mileage_ore)}`, { strong: true });
    y -= 28;
  }

  if (y < margin + 40) newPage();
  const totalKm = trips.reduce((sum, trip) => sum + trip.distance_tenths, 0) / 10;
  const totalOre = trips.reduce((sum, trip) => sum + trip.mileage_ore, 0);
  page.drawLine({ start: { x: margin, y: y + 9 }, end: { x: width - margin, y: y + 9 }, thickness: 1, color: ink });
  y -= 10;
  write(`Totalt  ·  ${kilometers.format(totalKm)} km  ·  ${formatExpenseAmount(totalOre)}`, { size: 14, strong: true });

  const pages = pdf.getPages();
  pages.forEach((sheet, index) => {
    sheet.drawText(`GetOut Operations  |  Sida ${index + 1} av ${pages.length}`, { x: margin, y: 25, size: 9, font: regular, color: muted });
  });
  return pdf.save();
}
