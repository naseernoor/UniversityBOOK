declare module "html2pdf.js" {
  type Html2PdfOptions = {
    margin?: number | number[];
    filename?: string;
    image?: {
      type?: "jpeg" | "png" | "webp";
      quality?: number;
    };
    html2canvas?: {
      scale?: number;
      useCORS?: boolean;
    };
    jsPDF?: {
      unit?: string;
      format?: string;
      orientation?: string;
    };
  };

  type Html2PdfWorker = {
    set: (options: Html2PdfOptions) => Html2PdfWorker;
    from: (element: HTMLElement | string) => Html2PdfWorker;
    save: () => Promise<void>;
  };

  const html2pdf: () => Html2PdfWorker;
  export default html2pdf;
}
