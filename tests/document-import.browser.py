"""Regression checks for actual document parsing through Vite in Chromium."""
import asyncio
import base64
import io
import zipfile
from playwright.async_api import async_playwright


def docx():
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        archive.writestr("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        archive.writestr("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Photosynthesis converts light into energy.</w:t></w:r></w:p></w:body></w:document>')
    return output.getvalue()


def pdf():
    stream = b"BT /F1 12 Tf 50 750 Td (Photosynthesis converts light into energy.) Tj ET"
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>", b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"]
    data = b"%PDF-1.4\n"
    offsets = [0]
    for number, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data += str(number).encode() + b" 0 obj\n" + obj + b"\nendobj\n"
    start = len(data)
    data += b"xref\n0 6\n0000000000 65535 f \n"
    data += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:])
    return data + f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF".encode()


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 1800})
        await page.goto("http://localhost:8080/auth", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        for name, data in [("sample.txt", b"Photosynthesis converts light into energy."), ("sample.docx", docx()), ("sample.pdf", pdf())]:
            result = await page.evaluate("""async ([name, encoded]) => {
              const {readDocumentText} = await import('/src/lib/document-import.ts');
              const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
              return await readDocumentText(new File([bytes], name), 30000);
            }""", [name, base64.b64encode(data).decode()])
            assert result == "Photosynthesis converts light into energy.", (name, result)
            print(name, "extracted correctly")
        rejected = await page.evaluate("""async () => {
          const {readDocumentText} = await import('/src/lib/document-import.ts');
          try { await readDocumentText(new File(['x'.repeat(30001)], 'large.txt'), 30000); return false; }
          catch { return true; }
        }""")
        assert rejected, "Oversized text must not be silently truncated"
        print("Oversized document rejected before generation")
        await browser.close()


asyncio.run(main())