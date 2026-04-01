import QRCode from "qrcode";

export async function qrDataUrl(text: string, size = 640) {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: size,
    errorCorrectionLevel: "M",
    color: {
      dark: "#1f7a5a",
      light: "#ffffff",
    },
  });
}
