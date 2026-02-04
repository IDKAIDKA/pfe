
import * as docx from "docx";
import mammoth from "mammoth";
import { jsPDF } from "jspdf";

// External globals
declare const pdfjsLib: any;

export const parseFile = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'doc') {
    throw new Error("عذراً، ملفات .doc غير مدعومة. يرجى استخدام .docx أو نسخ النص مباشرة.");
  }

  try {
    if (extension === 'txt') {
      return await file.text();
    } else if (extension === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value || "";
    } else if (extension === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument(new Uint8Array(arrayBuffer));
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
      }
      return fullText;
    }
  } catch (error) {
    throw new Error("فشل استخراج النص.");
  }
  return '';
};

export const exportAsDocx = async (paragraphs: string[], fileName: string) => {
  // Use namespace to avoid "not found" named export errors in ESM
  const d: any = docx;
  
  // Robust property extraction to handle potential esm.sh wrapping
  const Document = d.Document || (d.default && d.default.Document);
  const Packer = d.Packer || (d.default && d.default.Packer);
  const Paragraph = d.Paragraph || (d.default && d.default.Paragraph);
  const TextRun = d.TextRun || (d.default && d.default.TextRun);
  const AlignmentType = d.AlignmentType || (d.default && d.default.AlignmentType);

  if (!Document || !Packer || !Paragraph || !TextRun) {
    throw new Error("Could not initialize docx library components properly.");
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs.map(p => new Paragraph({
          children: [new TextRun({ text: p, size: 28, font: "Arial" })],
          spacing: { after: 400, line: 400 },
          // Use enum if available, otherwise fallback to string literal
          alignment: AlignmentType ? AlignmentType.RIGHT : "right",
          bidirectional: true
        })),
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nossos_${fileName.split('.')[0] || 'document'}.docx`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportAsPdf = async (paragraphs: string[], fileName: string) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  // Simple PDF export for Arabic logic
  doc.setFont("helvetica", "normal");
  let y = 20;
  paragraphs.forEach(p => {
    const lines = doc.splitTextToSize(p, 180);
    if (y + (lines.length * 7) > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, 195, y, { align: 'right' });
    y += (lines.length * 7) + 10;
  });
  doc.save(`nossos_${fileName.split('.')[0] || 'document'}.pdf`);
};
