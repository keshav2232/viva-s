/**
 * VivaSim - Presentation Deck & Slide Parser Service
 * Converts uploaded PDF presentation decks or slide text files into structured slides
 * with canvas image previews and extracted text for Gemini context evaluation.
 */

export const SlideParserService = {

  /**
   * Dynamically loads pdf.js from CDN if not already present on window.
   */
  async loadPdfJs() {
    if (typeof window === "undefined") return null;
    if (window.pdfjsLib) return window.pdfjsLib;

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error("Failed to load PDF processing library."));
      document.head.appendChild(script);
    });
  },

  /**
   * Parses an uploaded File (PDF or Text) into structured slides with preview images.
   * @param {File} file - Uploaded presentation deck file.
   * @returns {Promise<{ topic: string, slides: Array<{ page: number, title: string, text: string, previewUrl: string }> }>}
   */
  async parseDeck(file) {
    if (!file) throw new Error("No presentation file selected.");

    const fileName = file.name.replace(/\.[^/.]+$/, "");
    const isPdf = file.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      return await this.parsePdfFile(file, fileName);
    } else {
      return await this.parseTextFile(file, fileName);
    }
  },

  /**
   * Parses a PDF file using pdf.js into canvas data URLs and extracted page text.
   */
  async parsePdfFile(file, defaultTopic) {
    const pdfjsLib = await this.loadPdfJs();
    if (!pdfjsLib) throw new Error("PDF processing engine unavailable.");

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const slides = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);

      // 1. Render page to Canvas Data URL
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;
      const previewUrl = canvas.toDataURL("image/jpeg", 0.85);

      // 2. Extract Text Content
      const textContent = await page.getTextContent();
      const textItems = textContent.items.map(item => item.str.trim()).filter(s => s.length > 0);
      const rawText = textItems.join(" ");

      // Infer title from first line of text or fallback
      let title = textItems[0] || `Slide ${pageNum}`;
      if (title.length > 50) title = title.substring(0, 47) + "...";

      slides.push({
        page: pageNum,
        title: `Slide ${pageNum}: ${title}`,
        text: rawText || `[Visual Slide ${pageNum}: ${title}]`,
        previewUrl
      });
    }

    const topic = slides[0]?.title ? slides[0].title.replace(/^Slide 1:\s*/, "") : defaultTopic;

    return {
      topic: topic || defaultTopic,
      slides
    };
  },

  /**
   * Fallback text/markdown file slide parser.
   */
  async parseTextFile(file, defaultTopic) {
    const text = await file.text();
    const rawSections = text.split(/(?:---|\n(?=Slide \d+:?|\#\# Slide \d+))/i);

    const slides = rawSections
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map((sectionText, idx) => {
        const pageNum = idx + 1;
        const lines = sectionText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        const titleLine = lines[0] || `Slide ${pageNum}`;
        const cleanTitle = titleLine.replace(/^#+\s*/, "").replace(/^Slide \d+[:.-]?\s*/i, "");

        // Generate SVG data URL preview for text slide
        const svgPreview = this.generateSvgSlidePreview(pageNum, cleanTitle, lines.slice(1));

        return {
          page: pageNum,
          title: `Slide ${pageNum}: ${cleanTitle}`,
          text: sectionText,
          previewUrl: svgPreview
        };
      });

    return {
      topic: defaultTopic,
      slides: slides.length > 0 ? slides : this.getDefaultSampleSlides(defaultTopic)
    };
  },

  /**
   * Generates a sleek 16:9 SVG Data URL preview for text/fallback slides.
   */
  generateSvgSlidePreview(pageNum, title, bulletLines) {
    const bulletsHtml = bulletLines.slice(0, 4).map((line, i) => `
      <text x="80" y="${280 + i * 50}" fill="#e2e8f0" font-family="sans-serif" font-size="22">
        • ${line.substring(0, 60)}
      </text>
    `).join("");

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
        <rect width="1280" height="720" fill="#0f172a" />
        <rect x="40" y="40" width="1200" height="640" rx="16" fill="#1e293b" stroke="#334155" stroke-width="2"/>
        <text x="80" y="140" fill="#38bdf8" font-family="sans-serif" font-weight="bold" font-size="36">
          Slide ${pageNum}
        </text>
        <text x="80" y="200" fill="#f8fafc" font-family="sans-serif" font-weight="bold" font-size="40">
          ${title.substring(0, 50)}
        </text>
        ${bulletsHtml}
        <text x="1150" y="650" fill="#64748b" font-family="sans-serif" font-size="20">VivaSim Deck</text>
      </svg>
    `;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  },

  /**
   * Default sample slides for quick demo testing if no file uploaded.
   */
  getDefaultSampleSlides(topicName = "System Architecture & Scalability") {
    const sampleTitles = [
      "Executive Summary & Project Goals",
      "System Architecture & Data Flow",
      "Performance Benchmarks & Scaling Bottlenecks",
      "Future Roadmap & Deployment Strategy"
    ];

    return sampleTitles.map((title, idx) => {
      const pageNum = idx + 1;
      const bullets = [
        `Core objective and high-level architecture overview`,
        `Key components, database schema and caching layers`,
        `Performance metrics under 10k RPS load testing`,
        `Summary of trade-offs, security and next steps`
      ];
      return {
        page: pageNum,
        title: `Slide ${pageNum}: ${title}`,
        text: `Slide ${pageNum}: ${title}\n- ${bullets.join("\n- ")}`,
        previewUrl: this.generateSvgSlidePreview(pageNum, title, bullets)
      };
    });
  }
};
