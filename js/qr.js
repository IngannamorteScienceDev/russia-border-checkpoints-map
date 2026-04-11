import qrcode from "./vendor/qrcode.mjs";

export function createQrSvgDataUri(text) {
  const qr = qrcode(0, "M");
  qr.addData(String(text || ""));
  qr.make();

  const svg = qr.createSvgTag({
    cellSize: 4,
    margin: 2,
    scalable: true,
    alt: "QR-код текущей ссылки"
  });

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
