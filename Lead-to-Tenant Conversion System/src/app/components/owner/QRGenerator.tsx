import { Download, Printer, QrCode as QrCodeIcon } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useState } from "react";

export function QRGenerator() {
  const [selectedHostel, setSelectedHostel] = useState<string>("block-1");

  const qrUrl = `https://sriadithyahostels.in/visit/${selectedHostel}`;

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-20 lg:pb-6">
      <div className="bg-[var(--brand-navy)] text-white px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-1">QR Code Generator</h1>
          <p className="text-white/70 text-sm">Generate visitor QR codes for your hostels</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-[var(--brand-navy)] mb-6">
              Configure QR Code
            </h2>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-[var(--deep-charcoal)] mb-2 block">
                  Select Hostel
                </label>
                <Select value={selectedHostel} onValueChange={setSelectedHostel}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block-1">Block 1</SelectItem>
                    <SelectItem value="block-2">Block 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--deep-charcoal)] mb-2 block">
                  Generated URL
                </label>
                <div className="bg-[var(--warm-ivory)] rounded-lg p-3 border border-[var(--border)]">
                  <code className="text-sm text-[var(--brand-navy)] font-mono break-all">
                    {qrUrl}
                  </code>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <Button className="w-full justify-start h-12 bg-[var(--brand-saffron)] hover:bg-[var(--brand-saffron)]/90">
                  <Download className="w-5 h-5 mr-3" />
                  Download QR Code (PNG)
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 border-2"
                >
                  <Printer className="w-5 h-5 mr-3" />
                  Print-ready PDF
                </Button>
              </div>

              <div className="bg-[var(--success-green)]/5 border border-[var(--success-green)]/20 rounded-lg p-4 mt-6">
                <div className="flex items-start gap-3">
                  <QrCodeIcon className="w-5 h-5 text-[var(--success-green)] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-[var(--success-green)] mb-1 text-sm">
                      Usage Instructions
                    </h4>
                    <p className="text-xs text-[var(--neutral-gray)] leading-relaxed">
                      Print this QR code and display it at your hostel entrance. When visitors scan
                      it, they'll be taken directly to your hostel's landing page and automatically
                      tracked as a lead.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="p-8">
              <h3 className="text-lg font-semibold text-[var(--brand-navy)] mb-6 text-center">
                QR Code Preview
              </h3>

              <div className="bg-white rounded-2xl p-8 border-4 border-[var(--brand-navy)] mb-4">
                <div className="aspect-square bg-[var(--brand-navy)] rounded-lg flex items-center justify-center">
                  <div className="grid grid-cols-8 gap-1 p-4">
                    {Array.from({ length: 64 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 ${
                          Math.random() > 0.5 ? "bg-white" : "bg-transparent"
                        }`}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-center">
                <h2
                  className="text-2xl font-bold text-[var(--brand-navy)] mb-2"
                  style={{ fontFamily: "var(--font-hero)" }}
                >
                  Sri Adithya
                </h2>
                <p className="text-[var(--neutral-gray)] font-medium">
                  {selectedHostel === "block-1" ? "Block 1" : "Block 2"}
                </p>
                <p className="text-sm text-[var(--neutral-gray)] mt-3">
                  Scan to explore rooms & facilities
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
