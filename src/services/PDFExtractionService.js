/**
 * VivaSim - PDF & Document Extraction Service
 * Dynamically loads browser-safe PDF.js via CDN to parse uploaded syllabi.
 * Prevents Node-native compiled dependencies and supports PDF, TXT, and MD files.
 */

export const PDFExtractionService = {
  pdfjsLoaded: false,
  loadingPromise: null,

  /**
   * Dynamically injects the PDF.js CDN script. Safe for SSR.
   */
  loadPDFJS() {
    if (typeof window === "undefined") return Promise.reject("window-undefined");
    if (window.pdfjsLib) {
      this.pdfjsLoaded = true;
      return Promise.resolve(window.pdfjsLib);
    }
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
      script.onload = () => {
        window.pdfjsLib = window.pdfjsLib || window["pdfjs-dist/build/pdf"];
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
        this.pdfjsLoaded = true;
        resolve(window.pdfjsLib);
      };
      script.onerror = (e) => {
        this.loadingPromise = null;
        reject("Failed to load PDF.js from CDN: " + e);
      };
      document.head.appendChild(script);
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

    const extension = file.name.split(".").pop().toLowerCase();

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
            const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            
            let fullText = "";
            const totalPages = pdf.numPages;

            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map(item => item.str).join(" ");
              fullText += pageText + "\n";
            }
            
            resolve(fullText.trim());
          } catch (err) {
            reject("PDF parsing failed: " + err.message);
          }
        };

        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
      });
    }

    throw new Error("Unsupported file type: ." + extension);
  }
};
