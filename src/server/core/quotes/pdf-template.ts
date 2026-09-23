/**
 * Gabarit HTML du PDF d'un devis (§F.2, §G.8) — rendu par Chromium
 * (server/core/pdf). Document autonome (styles en ligne, pas de ressource
 * externe), `dir="rtl"` posé sur `<html>` en arabe pour un rendu correct des
 * lettres liées. Pur, sans I/O : n'importe pas "server-only" pour rester
 * testable directement.
 */
import { formatMoney } from "@/server/core/money";

export type QuotePdfItem = {
  title: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: bigint;
  lineTotal: bigint;
};

export type QuotePdfInstallment = {
  label: string;
  percent: number | null;
  amount: bigint | null;
};

export type QuotePdfData = {
  number: string;
  title: string;
  locale: string;
  currency: string;
  sentAt: Date;
  validUntil: Date | null;
  introduction: string | null;
  terms: string | null;
  subtotal: bigint;
  discountTotal: bigint;
  taxTotal: bigint;
  total: bigint;
  items: QuotePdfItem[];
  installments: QuotePdfInstallment[];
  brandName: string;
  legalName: string | null;
  clientDisplayName: string;
  clientAddress: string | null;
};

const COPY = {
  fr: {
    quote: "Devis",
    date: "Date",
    validUntil: "Valable jusqu'au",
    client: "Client",
    item: "Désignation",
    quantity: "Qté",
    unitPrice: "Prix unitaire",
    lineTotal: "Total",
    subtotal: "Sous-total",
    discountTotal: "Remise",
    taxTotal: "Taxes",
    total: "Total TTC",
    installments: "Échéances de paiement",
    terms: "Conditions",
  },
  en: {
    quote: "Quote",
    date: "Date",
    validUntil: "Valid until",
    client: "Client",
    item: "Item",
    quantity: "Qty",
    unitPrice: "Unit price",
    lineTotal: "Total",
    subtotal: "Subtotal",
    discountTotal: "Discount",
    taxTotal: "Tax",
    total: "Total",
    installments: "Payment schedule",
    terms: "Terms",
  },
  ar: {
    quote: "عرض سعر",
    date: "التاريخ",
    validUntil: "صالح حتى",
    client: "العميل",
    item: "البند",
    quantity: "الكمية",
    unitPrice: "سعر الوحدة",
    lineTotal: "الإجمالي",
    subtotal: "المجموع الفرعي",
    discountTotal: "الخصم",
    taxTotal: "الضريبة",
    total: "الإجمالي",
    installments: "جدول الدفعات",
    terms: "الشروط",
  },
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildQuotePdfHtml(data: QuotePdfData): string {
  const copy = COPY[data.locale as keyof typeof COPY] ?? COPY.fr;
  const dir = data.locale === "ar" ? "rtl" : "ltr";
  const money = (amount: bigint) => formatMoney(amount, data.currency, data.locale);

  const itemsRows = data.items
    .map(
      (item) => `
      <tr>
        <td>
          <div class="item-title">${escapeHtml(item.title)}</div>
          ${item.description ? `<div class="item-desc">${escapeHtml(item.description)}</div>` : ""}
        </td>
        <td class="num">${item.quantity}${item.unit ? ` ${escapeHtml(item.unit)}` : ""}</td>
        <td class="num">${money(item.unitPrice)}</td>
        <td class="num strong">${money(item.lineTotal)}</td>
      </tr>`,
    )
    .join("");

  const installmentsRows = data.installments
    .map(
      (installment) => `
      <tr>
        <td>${escapeHtml(installment.label)}</td>
        <td class="num">${installment.amount != null ? money(installment.amount) : `${installment.percent}%`}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="${data.locale}" dir="${dir}">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Tahoma, sans-serif; color: #0B1220; font-size: 13px; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
  .brand { font-size: 20px; font-weight: 700; color: #1D4ED8; }
  .doc-title { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
  .meta { color: #6B7280; font-size: 12px; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 24px; }
  .party h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6B7280; margin: 0 0 4px; }
  .party p { margin: 0; line-height: 1.5; }
  .intro { margin-bottom: 20px; line-height: 1.6; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { text-align: start; font-size: 11px; text-transform: uppercase; color: #6B7280; border-bottom: 1px solid #E5E7EB; padding: 6px 4px; }
  td { padding: 8px 4px; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
  .num { text-align: end; white-space: nowrap; }
  .strong { font-weight: 600; }
  .item-title { font-weight: 500; }
  .item-desc { color: #6B7280; font-size: 12px; margin-top: 2px; }
  .totals { width: 260px; margin-inline-start: auto; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .total { border-top: 1px solid #0B1220; margin-top: 6px; padding-top: 8px; font-weight: 700; font-size: 15px; }
  .terms { margin-top: 24px; line-height: 1.6; white-space: pre-wrap; color: #374151; }
  .terms h3 { font-size: 12px; text-transform: uppercase; color: #6B7280; margin-bottom: 6px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${escapeHtml(data.brandName)}</div>
      ${data.legalName ? `<div class="meta">${escapeHtml(data.legalName)}</div>` : ""}
    </div>
    <div style="text-align: end;">
      <p class="doc-title">${copy.quote} ${escapeHtml(data.number)}</p>
      <p class="meta">${copy.date} : ${data.sentAt.toLocaleDateString(data.locale)}</p>
      ${data.validUntil ? `<p class="meta">${copy.validUntil} : ${data.validUntil.toLocaleDateString(data.locale)}</p>` : ""}
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>${copy.client}</h3>
      <p>${escapeHtml(data.clientDisplayName)}</p>
      ${data.clientAddress ? `<p>${escapeHtml(data.clientAddress)}</p>` : ""}
    </div>
  </div>

  <p style="font-size:15px;font-weight:600;margin-bottom:8px;">${escapeHtml(data.title)}</p>
  ${data.introduction ? `<div class="intro">${escapeHtml(data.introduction)}</div>` : ""}

  <table>
    <thead>
      <tr>
        <th>${copy.item}</th>
        <th class="num">${copy.quantity}</th>
        <th class="num">${copy.unitPrice}</th>
        <th class="num">${copy.lineTotal}</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>${copy.subtotal}</span><span>${money(data.subtotal)}</span></div>
    <div class="row"><span>${copy.discountTotal}</span><span>-${money(data.discountTotal)}</span></div>
    <div class="row"><span>${copy.taxTotal}</span><span>${money(data.taxTotal)}</span></div>
    <div class="row total"><span>${copy.total}</span><span>${money(data.total)}</span></div>
  </div>

  ${
    data.installments.length > 0
      ? `<table>
    <thead><tr><th colspan="2">${copy.installments}</th></tr></thead>
    <tbody>${installmentsRows}</tbody>
  </table>`
      : ""
  }

  ${data.terms ? `<div class="terms"><h3>${copy.terms}</h3>${escapeHtml(data.terms)}</div>` : ""}
</body>
</html>`;
}
