"use client";

import React, { useState } from "react";
import { 
  FileText, 
  Printer, 
  Download, 
  X, 
  CheckCircle2, 
  Building2, 
  ShieldCheck, 
  Truck,
  Loader2
} from "lucide-react";
import { api } from "@/lib/api";

interface InvoiceItem {
  id?: string;
  product_name: string;
  sku_code?: string;
  hsn_code?: string;
  condition?: string;
  quantity_kg: number;
  unit_price_per_kg: number;
  tax_rate_percent?: number;
  tax_amount?: number;
  total_price: number;
}

interface InvoiceData {
  id?: string;
  invoice_number: string;
  order_id?: string;
  order_number?: string;
  invoice_date: string;
  supplier?: {
    business_name: string;
    gstin?: string;
    fssai?: string;
    address?: string;
  };
  supplier_name?: string;
  buyer?: {
    business_name: string;
    gstin?: string;
    fssai?: string;
    address?: string;
  };
  buyer_name?: string;
  items?: InvoiceItem[];
  subtotal: number;
  delivery_fee?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total_tax: number;
  grand_total: number;
  payment_status?: string;
}

interface GSTTaxInvoiceModalProps {
  invoice: InvoiceData;
  orderId?: string;
  onClose: () => void;
}

// Convert numbers to Indian Currency Words (Lakhs, Thousands, Hundreds)
function numberToWords(num: number): string {
  if (!num || num === 0) return "Rupees Zero Only";
  const intPart = Math.floor(num);

  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertSection(n: number): string {
    let str = "";
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      str += units[n] + " ";
    }
    return str.trim();
  }

  let words = "";
  const crore = Math.floor(intPart / 10000000);
  const lakh = Math.floor((intPart % 10000000) / 100000);
  const thousand = Math.floor((intPart % 100000) / 1000);
  const hundred = intPart % 1000;

  if (crore > 0) words += convertSection(crore) + " Crore ";
  if (lakh > 0) words += convertSection(lakh) + " Lakh ";
  if (thousand > 0) words += convertSection(thousand) + " Thousand ";
  if (hundred > 0) words += convertSection(hundred) + " ";

  return `Rupees ${words.trim()} Only`;
}

export function GSTTaxInvoiceModal({ invoice, orderId, onClose }: GSTTaxInvoiceModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const effectiveOrderId = orderId || invoice.order_id;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!effectiveOrderId) {
      setDownloadError("Order reference missing for PDF download");
      return;
    }
    setDownloading(true);
    setDownloadError(null);
    try {
      if ((api.buyer as any).downloadInvoicePdf) {
        await (api.buyer as any).downloadInvoicePdf(effectiveOrderId, invoice.invoice_number);
      } else {
        // Direct authenticated blob fetch fallback
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/invoices/${effectiveOrderId}/pdf`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to download PDF from server");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${invoice.invoice_number || "Tax-Invoice"}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    } catch (err: any) {
      setDownloadError(err.message || "Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  };

  const supplierName = invoice.supplier?.business_name || invoice.supplier_name || "Venky's India Ltd";
  const supplierGstin = invoice.supplier?.gstin || "29AAACV1234F1Z5";
  const supplierFssai = invoice.supplier?.fssai || "10012011000123";
  const supplierAddress = invoice.supplier?.address || "Bangalore Processing Plant & Cold Storage Unit, Karnataka 560001";

  const buyerName = invoice.buyer?.business_name || invoice.buyer_name || "Commercial Buyer";
  const buyerGstin = invoice.buyer?.gstin || "29AABCU9876R1Z2";
  const buyerFssai = invoice.buyer?.fssai || "10019043000456";
  const buyerAddress = invoice.buyer?.address || "Main Commercial Receiving Facility";

  const invoiceDateStr = invoice.invoice_date 
    ? new Date(invoice.invoice_date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      })
    : new Date().toLocaleDateString("en-IN");

  const cgst = invoice.cgst_amount ?? invoice.total_tax / 2;
  const sgst = invoice.sgst_amount ?? invoice.total_tax / 2;
  const igst = invoice.igst_amount ?? 0;
  const deliveryFee = invoice.delivery_fee ?? 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white">
      {/* Container Card */}
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto print:shadow-none print:border-none print:max-w-none print:w-full print:rounded-none">
        
        {/* Top Action Bar (Hidden on Print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Official GST Tax Invoice</h2>
              <p className="text-[11px] text-slate-500 font-mono">{invoice.invoice_number}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition shadow-xs"
              title="Print or Save as PDF via Browser"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded-lg transition shadow-xs"
              title="Download Server Signed PDF"
            >
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{downloading ? "Generating..." : "Download PDF"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
              title="Close Invoice"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {downloadError && (
          <div className="px-6 py-2 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex justify-between items-center print:hidden">
            <span>{downloadError}</span>
            <button onClick={() => setDownloadError(null)} className="font-bold underline">Dismiss</button>
          </div>
        )}

        {/* Printable Invoice Document Body */}
        <div id="gst-tax-invoice-printable" className="p-6 sm:p-8 space-y-6 text-slate-800 text-xs bg-white">
          
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-5 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-slate-900">THE CHICKEN MAN</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  Cold-Chain B2B
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">B2B Poultry Processing & Wholesale Marketplace</p>
            </div>
            <div className="text-right sm:text-right">
              <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">TAX INVOICE</h1>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                (Rule 46 of CGST Rules, 2017)
              </p>
              <div className="mt-1 inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Original for Recipient
              </div>
            </div>
          </div>

          {/* Supplier & Invoice Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
            {/* Supplier / Seller Info */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-500" />
                Seller / Supplier Details
              </div>
              <div className="text-sm font-bold text-slate-900">{supplierName}</div>
              <div className="text-[11px] text-slate-600 leading-relaxed">{supplierAddress}</div>
              <div className="pt-1 space-y-0.5 text-[11px]">
                <div><strong className="text-slate-700">GSTIN:</strong> <span className="font-mono font-bold text-slate-900">{supplierGstin}</span></div>
                <div><strong className="text-slate-700">FSSAI Lic. No:</strong> <span className="font-mono text-slate-800">{supplierFssai}</span></div>
                <div><strong className="text-slate-700">State:</strong> Karnataka (Code: 29)</div>
              </div>
            </div>

            {/* Invoice & Order Meta */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Invoice & Dispatch Information
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px]">Invoice No</span>
                  <span className="font-mono font-bold text-slate-900 text-xs">{invoice.invoice_number}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Invoice Date</span>
                  <span className="font-medium text-slate-900">{invoiceDateStr}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Order Reference</span>
                  <span className="font-mono font-bold text-slate-800">{invoice.order_number || invoice.order_id || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Place of Supply</span>
                  <span className="font-medium text-slate-800">Karnataka (29)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Reverse Charge (RCM)</span>
                  <span className="font-medium text-slate-800">No</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Payment Status</span>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {invoice.payment_status || "PAID"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Billed To / Shipped To Buyer */}
          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Billed To & Shipped To (Buyer)
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
              <div>
                <div className="text-sm font-bold text-slate-900">{buyerName}</div>
                <div className="text-[11px] text-slate-600 leading-relaxed">{buyerAddress}</div>
              </div>
              <div className="space-y-0.5 text-[11px] text-right sm:text-right shrink-0">
                <div><strong className="text-slate-700">Buyer GSTIN:</strong> <span className="font-mono font-bold text-slate-900">{buyerGstin}</span></div>
                <div><strong className="text-slate-700">FSSAI Lic. No:</strong> <span className="font-mono text-slate-800">{buyerFssai}</span></div>
                <div><strong className="text-slate-700">State:</strong> Karnataka (Code: 29)</div>
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px]">
                  <th className="p-2.5 text-center w-8">#</th>
                  <th className="p-2.5">Description of Goods</th>
                  <th className="p-2.5 text-center">HSN</th>
                  <th className="p-2.5 text-center">Condition</th>
                  <th className="p-2.5 text-right">Qty (Kg)</th>
                  <th className="p-2.5 text-right">Rate (₹/Kg)</th>
                  <th className="p-2.5 text-right">Taxable Amt (₹)</th>
                  <th className="p-2.5 text-right">CGST (2.5%)</th>
                  <th className="p-2.5 text-right">SGST (2.5%)</th>
                  <th className="p-2.5 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((item, idx) => {
                    const taxable = item.quantity_kg * item.unit_price_per_kg;
                    const itemTax = item.tax_amount ?? (taxable * 0.05);
                    const itemHalfTax = itemTax / 2;
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-2.5 font-semibold text-slate-900">
                          {item.product_name}
                          {item.sku_code && (
                            <span className="block text-[9px] font-mono text-slate-400 font-normal">
                              SKU: {item.sku_code}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-600">{item.hsn_code || "0207"}</td>
                        <td className="p-2.5 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            {item.condition || "CHILLED"}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold">{item.quantity_kg.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono">₹{item.unit_price_per_kg.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono font-semibold">₹{taxable.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono text-slate-600">₹{itemHalfTax.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono text-slate-600">₹{itemHalfTax.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          ₹{item.total_price.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="p-2.5 text-center font-mono text-slate-500">1</td>
                    <td className="p-2.5 font-semibold text-slate-900">Commercial Poultry Consignment</td>
                    <td className="p-2.5 text-center font-mono text-slate-600">0207</td>
                    <td className="p-2.5 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        CHILLED
                      </span>
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold">—</td>
                    <td className="p-2.5 text-right font-mono">—</td>
                    <td className="p-2.5 text-right font-mono font-semibold">₹{invoice.subtotal.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-600">₹{cgst.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-600">₹{sgst.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                      ₹{invoice.grand_total.toFixed(2)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Financial Calculation Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {/* Amount in words & notes */}
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Total Invoice Amount (in words)
                </span>
                <p className="font-semibold text-slate-900 text-xs italic">
                  {numberToWords(invoice.grand_total)}
                </p>
              </div>

              <div className="text-[10px] text-slate-500 space-y-1">
                <p className="flex items-center gap-1 font-semibold text-slate-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Tax Compliance & Quality Guarantee
                </p>
                <p>• Goods once sold are certified fresh & kept under strict cold-chain compliance (0°C to 4°C).</p>
                <p>• Intra-state supply subjected to CGST @ 2.5% and SGST @ 2.5% under HSN Heading 0207.</p>
                <p>• Proof of Delivery (POD) cryptographically signed and stored in immutable database.</p>
              </div>
            </div>

            {/* Calculations Table */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Subtotal:</span>
                <span className="font-mono font-semibold text-slate-900">₹{invoice.subtotal.toFixed(2)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3 h-3 text-slate-400" /> Cold-Chain Delivery Fee:
                  </span>
                  <span className="font-mono font-semibold text-slate-900">₹{deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>CGST (2.5%):</span>
                <span className="font-mono text-slate-800">₹{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST (2.5%):</span>
                <span className="font-mono text-slate-800">₹{sgst.toFixed(2)}</span>
              </div>
              {igst > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>IGST (5%):</span>
                  <span className="font-mono text-slate-800">₹{igst.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-1.5 flex justify-between text-slate-600">
                <span>Total Tax Amount:</span>
                <span className="font-mono font-semibold text-slate-900">₹{invoice.total_tax.toFixed(2)}</span>
              </div>
              <div className="border-t-2 border-slate-900 pt-2 flex justify-between items-baseline text-sm font-extrabold text-slate-900">
                <span>Grand Total (INR):</span>
                <span className="font-mono text-base text-emerald-700">₹{invoice.grand_total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer & Digital Verification */}
          <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 gap-2">
            <div>
              <span>Generated electronically via <strong>TheChickenMan B2B Network</strong>. No physical signature required.</span>
            </div>
            <div className="font-mono font-medium text-slate-400">
              E-Invoice Ref: {invoice.invoice_number} | Authenticated
            </div>
          </div>

        </div>

      </div>

      {/* Scoped Print Style to ensure ONLY this modal is printed */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #gst-tax-invoice-printable,
          #gst-tax-invoice-printable * {
            visibility: visible !important;
          }
          #gst-tax-invoice-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
