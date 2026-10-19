/**
 * VivaSim - PDF & Document Extraction Service
 * Dynamically loads browser-safe PDF.js via CDN to parse uploaded syllabi.
 * Prevents Node-native compiled dependencies and supports PDF, TXT, and MD files.
 */

export const PDFExtractionService = {
  pdfjsLoaded: false,
  loadingPromise: null,

  /**
   * Loads the bundled pdf.js (pdfjs-dist 4.x, patched for CVE-2024-4367). It ships with the app,
   * so there is no third-party CDN script to trust. The worker is served from /public and must
   * match the installed pdfjs-dist version (re-copy it when upgrading the package).
   */
  loadPDFJS() {
    if (typeof window === "undefined") return Promise.reject(new Error("PDF reading needs a browser."));
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = import("pdfjs-dist/build/pdf.min.mjs")
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        this.pdfjsLoaded = true;
        return pdfjs;
      })
      .catch((e) => {
        this.loadingPromise = null;
        console.error("pdf.js failed to load:", e);
        throw new Error("Failed to load the PDF reader. Please try again.");
      });

    return this.loadingPromise;
  },

  /**
   * Extracts text from an uploaded file (PDF, TXT, or MD).
   * @param {File} file - The file object from input.
   * @returns {Promise<string>}
   */
  async extractText(file) {
    if (!file) throw new Error("No file provided");

    const MAX_BYTES = 10 * 1024 * 1024;
    const MAX_PAGES = 80;
    if (file.size > MAX_BYTES) throw new Error("File is too large. Please upload a file under 10 MB.");

    const extension = (file.name.split(".").pop() || "").toLowerCase();

    // 1. Text & Markdown Files
    if (extension === "txt" || extension === "md") {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (err) => reject(err);
        reader.readAsText(file);
      });
    }

    // 2. PDF Files
    if (extension === "pdf") {
      const pdfjs = await this.loadPDFJS();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
          try {
            const arrayBuffer = e.target.result;
            // isEvalSupported:false mitigates CVE-2024-4367 (arbitrary JS via crafted PDF fonts) in pdf.js < 4.2.67.
            const loadingTask = pdfjs.getDocument({ data: arrayBuffer, isEvalSupported: false });
            const pdf = await loadingTask.promise;
            
            let fullText = "";
            const totalPages = Math.min(pdf.numPages, MAX_PAGES);

            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map(item => item.str).join(" ");
              fullText += pageText + "\n";
            }
            
            resolve(fullText.trim());
          } catch (err) {
            reject(new Error("PDF parsing failed: " + (err && err.message ? err.message : "unreadable file")));
          }
        };

        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
      });
    }

    throw new Error("Unsupported file type: ." + extension);
  }
};
